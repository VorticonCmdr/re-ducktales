// Validate saved evidence without confusing it with a fresh browser execution.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { json, checkArtifacts, sha } from "./lib/local-scenario-source.js";
import { validateProducerArchive, acceptedRuntimeSource } from "./lib/consumer-provenance.js";

const record = await json("reference/standard-wages-acceptance.json");
assert.equal(record.kind, "standard-wages-saved-port-regression");
await checkArtifacts(record.artifacts);
const scenario = await json(record.artifacts.scenario.path);
assert.equal(scenario.kind, "standard-cave-safari-port-regression");
assert.equal(scenario.nativeComparison, false);
assert.equal(scenario.difficulty, 1);
assert.equal(scenario.physicalKeyboard, true);
assert.equal(scenario.expectedCheckpointCount, 36);
assert.equal(scenario.requiredEventCount, 3177);
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
const diagnostic = await json(record.artifacts.diagnostic.path);
assert.equal(diagnostic.mode, "EXPLORATORY diagnostic");
assert.equal(diagnostic.consumed, 3177);
assert.equal(diagnostic.checked, 36);
assert.equal(diagnostic.rendered, 2568);
assert.equal(diagnostic.state.scene, "map");
assert.equal(diagnostic.state.campaign.day, 13);
assert.equal(diagnostic.state.campaign.banked, 3900);
console.log("Saved Standard route verified:36 exact browser state/image checkpoints,3177 DOM events,race-loss recovery,target photo,$3900 banked,Restart and1 semantic negative;3 setup negatives. Full Standard campaign and original timing remain unverified.");
