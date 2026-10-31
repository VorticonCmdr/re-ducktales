// Validate saved evidence without confusing it with a fresh browser execution.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { json, checkArtifacts, sha } from "./lib/local-scenario-source.js";
import { validateProducerArchive, acceptedRuntimeSource } from "./lib/consumer-provenance.js";

const full = process.argv.includes("--full");
const record = await json(full ? "reference/standard-wages-full-acceptance.json" : "reference/standard-wages-acceptance.json");
assert.equal(record.kind, full ? "standard-full-campaign-saved-port-regression" : "standard-wages-saved-port-regression");
await checkArtifacts(record.artifacts);
const scenario = await json(record.artifacts.scenario.path);
assert.equal(scenario.kind, full ? "standard-full-campaign-port-regression" : "standard-cave-safari-port-regression");
assert.equal(scenario.nativeComparison, false);
assert.equal(scenario.difficulty, 1);
assert.equal(scenario.physicalKeyboard, true);
assert.equal(scenario.expectedCheckpointCount, full ? 85 : 36);
assert.equal(scenario.requiredEventCount, full ? 5071 : 3177);
await checkArtifacts(scenario.artifacts);
await validateProducerArchive(scenario.producer);
const consumer = await validateProducerArchive(record.consumer);
for (const [path, hash] of Object.entries(consumer.files))
  if (acceptedRuntimeSource(path))
    assert.equal(sha(await readFile(path)), hash, "Changed accepted game runtime " + path);
const result = await json(record.artifacts.result.path);
assert.equal(result.completed, true);
assert.equal(result.accepted, true);
assert.equal(result.nativeComparison, false);
assert.equal(result.sourceCommit, consumer.commit);
assert.equal(result.producer, scenario.producer);
assert.equal(result.scope, scenario.scope);
assert.equal(result.checked, scenario.expectedCheckpointCount);
assert.equal(result.consumed, scenario.requiredEventCount);
assert.equal(result.semanticNegatives, 1);
assert.equal(result.restart, true);
await checkArtifacts(result.artifacts);
const negative = await json(record.artifacts["setup-negatives"].path);
assert.equal(negative.completed, true);
assert.deepEqual(negative.checks, ["zero-checkpoints", "missing-fixture", "corrupt-fixture"]
  .map((kind) => ({ kind, rejected: true, exitCode: 1 })));
if (full) {
  const setup = await validateProducerArchive(record.setupSource);
  assert.equal(setup.files["scripts/verify-standard-wages-route.js"],
    record.setupCheckerSha256, "Different archived setup checker");
  const checks = await json(scenario.artifacts["campaign-checkpoints"].path), final = checks.at(-1).state;
  assert.equal(checks.length, 85);
  assert.equal(final.scene, "ending");
  assert.equal(final.ending.ready, true);
  assert.equal(final.ending.won, false);
  assert.equal(final.campaign.day, 31);
  assert.equal(final.campaign.banked, 10250);
  assert.equal(final.campaign.rival.banked, 36000);
  assert.equal(final.cave.outcome.code, 1);
  assert.equal(final.jungle.outcome.code, 1);
  assert.equal(final.mountain.outcome.code, 1);
  assert.equal(final.jungle.lives, 3);
  assert.equal(final.mountain.lives, 3);
  assert.ok(final.photography.photos.includes(final.photography.target));
  console.log("Saved full Standard playthrough verified:85 exact browser state/image checkpoints,5071 events,all four expedition families,day31 defeat cover,Restart,one semantic and three setup negatives. Winning Standard routes,credits and native timing parity remain unverified by this route.");
  process.exit(0);
}
const diagnostic = await json(record.artifacts.diagnostic.path);
assert.equal(diagnostic.mode, "EXPLORATORY diagnostic");
assert.equal(diagnostic.consumed, 3177);
assert.equal(diagnostic.checked, 36);
assert.equal(diagnostic.rendered, 2568);
assert.equal(diagnostic.state.scene, "map");
assert.equal(diagnostic.state.campaign.day, 13);
assert.equal(diagnostic.state.campaign.banked, 3900);
console.log("Saved Standard day13 route verified:36 exact browser state/image checkpoints,3177 DOM events,race-loss recovery,target photo,$3900 banked,Restart and1 semantic negative;3 setup negatives. This prefix alone does not establish a full Standard campaign or original timing parity.");
