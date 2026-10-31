// Conditional carried state sequence only. The original elapsed-time/final
// checkpoint probe remains strict and must still fail at the known timing gap.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = spawnSync(process.execPath, ["scripts/probe-cave-native-cadence.js"], {
  encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
assert.ifError(run.error);
assert.equal(run.status, 1, "Expected the known strict native timing divergence");
assert.equal(run.stderr, "", "Unexpected probe diagnostic");
const at = run.stdout.indexOf("{\n");
assert.ok(at >= 0, "Missing completed comparison output");
const comparison = JSON.parse(run.stdout.slice(at));
assert.equal(comparison.accepted, false);
assert.equal(comparison.comparisonPassed, false);
assert.equal(comparison.firstInputMatches, true);
function check(value) {
  assert.equal(value.portChanges.length, 4, "Unfinished state sequence");
  assert.equal(value.nativeChanges.length, 4, "Missing native checkpoints");
  assert.equal(value.consumedReads, 2, "Unexpected input read sequence");
  assert.deepEqual(value.events.map(e => [e.scan, e.pressed]), [
    [77, true], [57, true], [77, false], [57, false],
  ], "Unfinished required physical inputs");
  // Subtracting the absolute reader origin can round the same authored
  // release by a few1e-13ms. This allowance is only for event serialization;
  // it is never applied to game-state fields or native checkpoint times.
  for (let i = 0; i < 4; i++)
    assert.ok(Math.abs(value.events[i].ms - (i < 2 ? 0 : 10 * 1000 / 70.086)) <= 1e-9,
      "Changed physical input timing");
  assert.deepEqual(value.portChanges.map(c => c.state), value.nativeChanges.map(c => c.state),
    "Original ordered phase-state divergence");
}
check(comparison);
for (const mode of ["altered-state", "missing-checkpoint", "missing-input"]) {
  const wrong = structuredClone(comparison);
  if (mode === "altered-state") wrong.portChanges[2].state.seed ^= 1;
  if (mode === "missing-checkpoint") wrong.portChanges.pop();
  if (mode === "missing-input") wrong.events.pop();
  assert.throws(() => check(wrong));
}
console.log("Cave load sequence:4 original phase states/all9 fields,2 carried reads/4 required physical events,3 negatives. Conditional ENTRY-based component evidence only;elapsed time and the final6.834s checkpoint still diverge and are not accepted.");
