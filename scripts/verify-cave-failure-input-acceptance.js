// Saved current-runtime evidence;fresh browser execution is a separate command.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive, acceptedRuntimeSource } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const record = await json("reference/cave-failure-input-acceptance.json");
assert.equal(record.kind, "cave-failure-input-acceptance");
assert.equal(record.nativeComparison, false);
await originalGame();
await checkArtifacts(record.artifacts);
const scenario = await json(record.artifacts.scenario.path);
assert.equal(scenario.kind, "cave-failure-input-port-regression");
assert.equal(scenario.expectedCheckpointCount, 11);
assert.equal(scenario.requiredEventCount, 454);
await checkArtifacts(scenario.artifacts);
await validateProducerArchive(scenario.producer);
const standard = await json(record.artifacts.standardScenario.path);
for (const [root, path, count, events, producer] of [
  [record.consumer, record.artifacts.result.path, 11, 454, scenario.producer],
  [record.standardConsumer, record.artifacts.standardResult.path, 85, 5071, standard.producer],
]) {
  const source = await validateProducerArchive(root), result = await json(path);
  for (const [file, hash] of Object.entries(source.files))
    if (acceptedRuntimeSource(file)) assert.equal(sha(await readFile(file)), hash, "Changed accepted runtime " + file);
  assert.equal(result.completed, true); assert.equal(result.accepted, true);
  assert.equal(result.nativeComparison, false); assert.equal(result.sourceCommit, source.commit);
  assert.equal(result.producer, producer);
  assert.equal(result.checked, count); assert.equal(result.consumed, events);
  assert.equal(result.restart, true); assert.equal(result.semanticNegatives, 1);
  await checkArtifacts(result.artifacts);
}
assert.equal(standard.kind, "standard-full-campaign-port-regression");
await checkArtifacts(standard.artifacts);
await validateProducerArchive(standard.producer);
const negative = await json(record.artifacts.setupNegatives.path);
assert.equal(negative.completed, true);
assert.deepEqual(negative.checks, ["zero-checkpoints", "missing-fixture", "corrupt-fixture"]
  .map((kind) => ({ kind, rejected: true, exitCode: 1 })));
const setup = await validateProducerArchive(record.setupSource);
assert.equal(setup.files["scripts/verify-cave-failure-input-setup-negative.js"], record.setupCheckerSha256);
await validateProducerArchive(record.beforeSource);
const before = await json(record.artifacts.before.path);
assert.equal(before.find((c) => c.name === "after-p").state.systemOverlay.kind, "pause");
const after = await json(scenario.artifacts["campaign-checkpoints"].path);
assert.equal(after.find((c) => c.name === "after-p").state.systemOverlay, null);
assert.equal(after.find((c) => c.name === "pause").state.expeditionResult.remaining, 133);
for (const [path, count] of [[record.artifacts.units.path, 194], [record.artifacts.boundaries.path, 46]]) {
  const log = await readFile(path, "utf8");
  assert.match(log, new RegExp("tests " + count + "\\b"));
  assert.match(log, new RegExp("pass " + count + "\\b"));
  assert.match(log, /fail 0\b/); assert.match(log, /skipped 0\b/);
}
assert.match(await readFile(record.artifacts.build.path, "utf8"), /built in/);
const sourceCheck = spawnSync(process.execPath, ["scripts/verify-cave-failure-input-source.js"], { encoding: "utf8" });
assert.equal(sourceCheck.status, 0, sourceCheck.stderr);
console.log("Cave failure acceptance verified:11 exact state/image checkpoints,454 DOM events,Pause/Quit-No/fresh Fire/map/retry/Restart and one omission negative;unchanged Standard85 checkpoints/5071 events;194 units,46 boundary checks,three setup negatives and build. Muted port regression,not native timing/audio parity.");
