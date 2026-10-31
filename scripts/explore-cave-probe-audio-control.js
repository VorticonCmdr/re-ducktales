// Exploratory paired environment control. Success means the experiment ran,
// never that the known-failing original timing comparison has been accepted.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
function run(mode) {
  const r = spawnSync(process.execPath, ["scripts/probe-cave-native-cadence.js", `--audio=${mode}`], {
    encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.ifError(r.error);
  assert.equal(r.status, 1, "Expected the currently documented strict timing divergence");
  assert.equal(r.stderr, "", "Unexpected probe diagnostic");
  const start = r.stdout.indexOf('\n{');
  assert.ok(start > 0, "Missing structured probe result");
  const result = JSON.parse(r.stdout.slice(start + 1));
  assert.equal(result.kind, "exploratory-cave-native-comparison");
  assert.equal(result.accepted, false);
  assert.equal(result.comparisonPassed, false);
  assert.equal(result.firstInputMatches, true);
  assert.ok(result.consumedReads > 0 && result.firstDifference);
  assert.equal(result.audioEnvironment.nativeEnabled, true);
  assert.equal(result.audioEnvironment.audioStatusQueries, 0);
  assert.equal(result.audioEnvironment.nativeAudioCPUCostModeled, false);
  return result;
}
const enabled = run("original"), disabled = run("disabled");
assert.equal(enabled.audioEnvironment.portEnabled, true);
assert.equal(disabled.audioEnvironment.portEnabled, false);
assert.deepEqual(enabled.audioEnvironment.requests.map(e => e.id), [0, 0x4f, 0x24, 0x4d]);
assert.deepEqual(disabled.audioEnvironment.requests, []);
for (const field of ["consumedReads", "events", "firstDifference", "portChanges", "nativeChanges", "final", "nativeFinal"])
  assert.deepEqual(enabled[field], disabled[field], `Audio mode changed ${field}`);
console.log(JSON.stringify({
  kind: "exploratory-cave-audio-environment-control", experimentCompleted: true,
  timingAccepted: false, browserAccepted: false,
  nativeEnableFlag: true, enabledRequests: [0, 0x4f, 0x24, 0x4d],
  audioStatusConsumptions: 0, comparedModes: 2, sameComponentMovement: true,
  limitation: "Both strict probes still exit1. Native audio driver CPU/IRQ work and device state are not reconstructed.",
}, null, 2));
