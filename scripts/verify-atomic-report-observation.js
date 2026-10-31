// Validates a preserved browser observation. This is NOT independent replay.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json,
  checkArtifacts,
  checkSource,
  sha,
} from "./lib/local-scenario-source.js";
import { originalGame } from "../tests/helpers/original-game.js";
const manifest = await json("reference/atomic-report-observation.json");
assert.equal(
  manifest.evidence,
  "observed-browser-only;not independent replay or native report timing",
);
assert.equal(
  sha(await readFile(manifest.buildManifest)),
  manifest.buildManifestSha256,
);
await originalGame();
await checkArtifacts(manifest.artifacts);
const root = manifest.artifacts["probe.json"].path.replace(/\/probe.json$/, "");
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") ||
    p.startsWith("tests/browser/helpers/") ||
    [
      "scripts/lib/carlsbad-browser.js",
      "reference/build.json",
      "vite.campaign.config.js",
      "index.html",
    ].includes(p),
);
const probe = await json(manifest.artifacts["probe.json"].path),
  notes = probe.notes;
assert.equal(probe.idle, 6);
assert.equal(probe.restart, true);
assert.equal(notes.length, manifest.expectedObservationCount);
assert.ok(notes.length > 0);
const get = (name) => {
  const rows = notes.filter((n) => n.name === name);
  assert.equal(rows.length, 1, "Missing/repeated observation " + name);
  return rows[0].state;
};
assert.equal(get("cave-entry").briefing.variant, 7);
assert.equal(get("award").money, 3400);
assert.equal(get("unlock").campaign.atomicAvailable, true);
const report = get("misdirection");
assert.equal(report.atomicTransport.phase, "report");
assert.equal(report.atomicTransport.roll, 0);
assert.equal(report.atomicTransport.seed, 6900);
assert.equal(report.atomicTransport.target, 1);
assert.equal(report.atomicTransport.inputPolls, 1);
assert.equal(report.systemOverlay, null);
const paused = get("report-pause"),
  resumed = get("pause-resumed");
assert.equal(paused.systemOverlay.kind, "pause");
assert.equal(paused.atomicTransport.waitingForInputPoll, true);
assert.equal(paused.atomicTransport.remaining, 413);
assert.equal(resumed.systemOverlay, null);
assert.equal(resumed.atomicTransport.remaining, 413);
assert.equal(resumed.atomicTransport.inputPolls, 2);
assert.equal(get("report-quit").systemOverlay.kind, "quit");
assert.equal(get("quit-no-resumed").systemOverlay, null);
assert.equal(get("quit-no-resumed").atomicTransport.inputPolls, 3);
const arrived = get("arrival"),
  child = get("second-entry");
assert.equal(arrived.atomicTransport.outcome.misdirected, true);
assert.equal(arrived.atomicTransport.outcome.target, 1);
assert.equal(arrived.atomicTransport.inputPolls, 4);
assert.equal(child.scene, "jungle");
assert.equal(child.campaign.day, 6);
assert.equal(child.money, 3400);
assert.equal(child.systemOverlay, null);
assert.deepEqual(manifest.memoryInjections, []);
assert.deepEqual(manifest.fittedInputs, []);
console.log(
  "Earned atomic report browser observation verified;Pause/Quit-No/Fire and Restart observed,not independent replay or native timing acceptance.",
);
