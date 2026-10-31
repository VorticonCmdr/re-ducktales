// Current earned-treasure browser segment, explicitly not a winning campaign.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive, acceptedRuntimeSource } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const record = await json(process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/current-earned-acceptance.json");
assert.equal(record.kind, "current-earned-treasure-acceptance");
assert.equal(record.nativeComparison, false);
assert.equal(record.winningCampaign, false);
await originalGame(); await checkArtifacts(record.artifacts);
async function current(root) {
  const source = await validateProducerArchive(root);
  for (const [p, h] of Object.entries(source.files))
    if (acceptedRuntimeSource(p)) assert.equal(sha(await readFile(p)), h, "Changed accepted runtime " + p);
  const actual = (await readdir("src", { recursive: true, withFileTypes: true }))
    .filter((d) => d.isFile()).map((d) => `${d.parentPath}/${d.name}`).sort();
  assert.deepEqual(actual, Object.keys(source.files).filter((p) => p.startsWith("src/")).sort());
  return source;
}
const m = await json(record.artifacts.scenario.path);
assert.equal(m.kind, "current-winning-valid-prefix");
assert.equal(m.lastCheckpoint, "bank-25");
assert.equal(m.expectedCheckpointCount, 129);
assert.equal(m.requiredEventCount, 6511);
assert.equal(m.partialRestore, false);
assert.deepEqual(m.injections, []); assert.deepEqual(m.fittedInputs, []);
assert.deepEqual(m.comparison.exclusions, []);
await checkArtifacts(m.artifacts); await current(m.producer);
const all = await json(m.artifacts.checkpoints.path), points = all.slice(0, 129);
assert.equal(points.length, 129); assert.equal(points.at(-1).name, "bank-25");
assert.equal(points.at(-1).eventCount, 6511);
assert.equal(new Set(points.map((p) => p.name)).size, points.length);
assert.equal(points.at(-1).state.scene, "bank");
assert.equal(points.at(-1).state.campaign.day, 25);
assert.equal(points.at(-1).state.campaign.banked, 27050);
assert.equal(points.at(-1).state.money, 0);
// Preserve the unsuccessful producer tail honestly rather than certifying it.
assert.equal(all.at(-1).name, "failure");
assert.equal(all.at(-1).state.ending.won, false);
assert.equal(all.at(-1).state.ending.rivalBanked, 36000);
const consumer = await current(record.consumer), result = await json(record.artifacts.result.path);
assert.equal(result.sourceCommit, consumer.commit);
assert.equal(result.completed, true); assert.equal(result.accepted, true);
assert.equal(result.nativeComparison, false); assert.equal(result.producer, m.producer);
assert.equal(result.checked, 129); assert.equal(result.consumed, 6511);
assert.equal(result.semanticNegatives, 1); assert.equal(result.restart, true);
await checkArtifacts(result.artifacts);
const source = await current(record.checksRoot), checks = await json(record.artifacts.checks.path);
assert.equal(checks.sourceCommit, source.commit); assert.equal(checks.completed, true);
await checkArtifacts(checks.artifacts);
const negatives = JSON.parse(await readFile(checks.artifacts["setup-negatives.log"].path, "utf8"));
assert.equal(negatives.completed, true);
assert.deepEqual(negatives.checks, ["zero-checkpoints", "missing-fixture", "corrupt-fixture"]
  .map((kind) => ({ kind, rejected: true, exitCode: 1 })));
const awards = await json(record.artifacts.awards.path);
assert.equal(awards.producer, m.producer);
const p = spawnSync(process.execPath, ["scripts/verify-current-winning-awards.js", "--manifest=" + record.artifacts.awards.path], { encoding: "utf8" });
assert.equal(p.status, 0, p.stdout + p.stderr); process.stdout.write(p.stdout);
console.log("Current earned-treasure acceptance:129 exact state/image checkpoints,6511 independent DOM inputs,all4 expedition families,6 treasures/90 row groups,bank27050 and Restart;one missing-input negative and3 setup negatives. Producer's later defeat is explicitly excluded. Winning campaign,native uninterrupted timing/audio parity and arbitrary routes remain unproven.");
