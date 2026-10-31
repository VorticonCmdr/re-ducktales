// Validates the saved independent report replay. Repeat execution via manifest.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json,
  sha,
  checkArtifacts,
  checkSource,
} from "./lib/local-scenario-source.js";
import { acceptedRuntimeSource } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/atomic-earned-report.json");
assert.equal(m.expectedCheckpointCount, 23);
assert.equal(m.requiredEventCount, 492);
assert.equal(m.negativeControls, 2);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
const source = await checkSource(m.consumerRoot, acceptedRuntimeSource);
assert.equal(source.commit, m.sourceCommit);
await checkSource(m.captureRoot, acceptedRuntimeSource);
const result = await json(m.consumerRoot + "/result.json"),
  status = await json(m.captureRoot + "/capture-status.json"),
  events = await json(m.inputStream),
  checks = await json(m.expectedOutputs);
assert.equal(result.completed, true);
assert.equal(result.report, true);
assert.equal(result.checked, 23);
assert.equal(result.consumed, 492);
assert.equal(result.negativeControls, 2);
assert.equal(result.restart, true);
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.route, "report");
assert.equal(status.checkpoints, 23);
assert.equal(status.events, 492);
assert.equal(status.restart, true);
assert.equal(events.length, 492);
assert.equal(checks.length, 23);
assert.equal(checks.at(-1).eventCount, 492);
const point = (name) => {
  const rows = checks.filter((c) => c.name === name);
  assert.equal(rows.length, 1);
  return rows[0].state;
};
assert.equal(point("unlock").campaign.atomicAvailable, true);
assert.equal(point("charge-keys-ignored").systemOverlay, null);
const report = point("misdirection");
assert.equal(report.atomicTransport.phase, "report");
assert.equal(report.atomicTransport.seed, 6900);
assert.equal(report.atomicTransport.roll, 0);
assert.equal(report.atomicTransport.inputPolls, 1);
assert.equal(report.atomicTransport.target, 1);
assert.equal(report.systemOverlay, null);
const paused = point("report-pause"),
  waiting = point("pause-waiting"),
  resumed = point("pause-resumed");
assert.equal(paused.systemOverlay.kind, "pause");
assert.equal(waiting.systemOverlay.phase, "waiting");
assert.equal(
  paused.atomicTransport.remaining,
  waiting.atomicTransport.remaining,
);
assert.equal(
  waiting.atomicTransport.remaining,
  resumed.atomicTransport.remaining,
);
assert.equal(resumed.systemOverlay, null);
assert.equal(resumed.atomicTransport.inputPolls, 2);
assert.equal(point("report-quit").systemOverlay.kind, "quit");
assert.equal(point("quit-no-resumed").systemOverlay, null);
assert.equal(point("quit-no-resumed").atomicTransport.inputPolls, 3);
const final = checks.at(-1).state;
assert.equal(final.scene, "jungle");
assert.equal(final.campaign.location, 1);
assert.equal(final.campaign.day, 6);
assert.equal(final.money, 3400);
assert.equal(final.atomicTransport.inputPolls, 4);
assert.equal(final.atomicTransport.outcome.misdirected, true);
assert.equal(final.systemOverlay, null);
const success = await json(m.successRegression.consumerRoot + "/result.json");
assert.equal(success.completed, true);
assert.equal(success.report, false);
assert.equal(success.checked, 18);
assert.equal(success.consumed, 486);
assert.equal(success.negativeControls, 1);
assert.equal(success.restart, true);
const successSource = await checkSource(
  m.successRegression.consumerRoot,
  acceptedRuntimeSource,
);
assert.equal(successSource.commit, m.successRegression.sourceCommit);
assert.deepEqual(m.exclusions, []);
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.fittedInputs, []);
console.log(
  "Earned atomic report acceptance verified:23 exact state/image checkpoints,492 DOM events,Pause/Quit-No/Fire,redirected jungle entry,Restart,and2 omission negatives;current game runtime unchanged.",
);
