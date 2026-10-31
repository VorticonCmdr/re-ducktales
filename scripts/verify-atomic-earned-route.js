// Recheck the saved acceptance and current loaded source. Repeat actual browser
// execution with the manifest's repeat command; this command validates its receipt.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json,
  checkArtifacts,
  checkSource,
  sha,
} from "./lib/local-scenario-source.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/atomic-earned-route.json");
assert.equal(m.expectedCheckpointCount, 18);
assert.equal(m.requiredEventCount, 486);
assert.equal(m.negativeControls, 1);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
const loaded = (p) =>
  p.startsWith("src/") ||
  p.startsWith("scripts/") ||
  p.startsWith("tests/") ||
  [
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.js",
    "vite.campaign.config.js",
    "reference/build.json",
  ].includes(p);
const source = await checkSource(m.consumerRoot, loaded);
assert.equal(source.commit, m.sourceCommit);
await checkSource(m.captureRoot, loaded);
const result = await json(m.consumerRoot + "/result.json"),
  status = await json(m.captureRoot + "/capture-status.json"),
  events = await json(m.inputStream),
  checks = await json(m.expectedOutputs);
assert.equal(result.completed, true);
assert.equal(result.checked, 18);
assert.equal(result.consumed, 486);
assert.equal(result.restart, true);
assert.equal(result.negativeControls, 1);
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.restart, true);
assert.equal(status.checkpoints, 18);
assert.equal(status.events, 486);
assert.equal(events.length, 486);
assert.equal(checks.length, 18);
assert.equal(checks.at(-1).eventCount, events.length);
assert.equal(checks[0].state.briefing.variant, 7);
const charge = checks.find((c) => c.name === "charge-keys-ignored").state;
assert.equal(charge.systemOverlay, null);
assert.equal(charge.atomicTransport.phase, "charge");
assert.equal(charge.atomicTransport.success, true);
const last = checks.at(-1).state;
assert.equal(last.scene, "cave");
assert.equal(last.cave.room, 18);
assert.equal(last.money, 3450);
assert.equal(last.campaign.day, 6);
assert.equal(last.campaign.atomicAvailable, true);
assert.equal(last.systemOverlay, null);
assert.deepEqual(m.exclusions, []);
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.fittedInputs, []);
console.log(
  "Saved earned atomic browser acceptance verified:18 exact state/image checkpoints,486 events,Restart,1 selection negative;current loaded source unchanged.",
);
