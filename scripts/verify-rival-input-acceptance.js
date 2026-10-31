// Saved receipts are port comparisons. Fresh execution is documented separately.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive, acceptedRuntimeSource } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/rival-input-acceptance.json");
assert.equal(m.kind, "rival-input-acceptance");
assert.equal(m.nativeComparison, false);
await originalGame();
await checkArtifacts(m.artifacts);
async function currentSource(root) {
  const source = await validateProducerArchive(root);
  for (const [path, hash] of Object.entries(source.files))
    if (acceptedRuntimeSource(path)) assert.equal(sha(await readFile(path)), hash, "Changed accepted runtime " + path);
  return source;
}
const controls = await json(m.artifacts.controlsScenario.path);
assert.equal(controls.kind, "rival-input-browser-regression");
assert.deepEqual(controls.cases.map(c => [c.key, c.checkpoints, c.events]), [["regular", 9, 525], ["forced", 9, 1793]]);
for (const c of controls.cases) {
  await checkArtifacts(c.artifacts);
  await validateProducerArchive(c.producer);
}
const controlSource = await currentSource(m.controlsConsumer);
const controlResult = await json(m.artifacts.controlsResult.path);
assert.equal(controlResult.completed, true);
assert.equal(controlResult.accepted, true);
assert.equal(controlResult.nativeComparison, false);
assert.equal(controlResult.sourceCommit, controlSource.commit);
assert.deepEqual(controlResult.cases, controls.cases.map(c => ({ key:c.key, checked:c.checkpoints, consumed:c.events, restart:true, semanticNegatives:1 })));
await checkArtifacts(controlResult.artifacts);
for (const [scenarioKey, resultKey, root, count, events] of [
  ["standardScenario", "standardResult", m.standardConsumer, 85, 5071],
  ["failureScenario", "failureResult", m.failureConsumer, 11, 454],
]) {
  const scenario = await json(m.artifacts[scenarioKey].path);
  await checkArtifacts(scenario.artifacts);
  await validateProducerArchive(scenario.producer);
  const source = await currentSource(root), result = await json(m.artifacts[resultKey].path);
  assert.equal(result.completed, true); assert.equal(result.accepted, true);
  assert.equal(result.nativeComparison, false); assert.equal(result.sourceCommit, source.commit);
  assert.equal(result.producer, scenario.producer);
  assert.equal(result.checked, count); assert.equal(result.consumed, events);
  assert.equal(result.restart, true); assert.equal(result.semanticNegatives, 1);
  await checkArtifacts(result.artifacts);
}
for (const device of ["speaker", "tandy"]) {
  const source = await currentSource(m.audioConsumers[device]);
  const result = await json(m.artifacts[device + "Audio"].path);
  assert.equal(result.completed, true); assert.equal(result.accepted, false);
  assert.equal(result.sourceCommit, source.commit); assert.equal(result.device, device);
  assert.equal(result.restart, true); assert.equal(result.stats.device, device);
  assert.equal(result.stats.contextState, "running"); assert.ok(Number(result.stats.signalSamples) > 0);
  const requests = result.events.filter(e => e.type === "ack");
  const start = requests.findIndex(e => e.argument === 0x24);
  assert.ok(start >= 0);
  assert.deepEqual(requests.slice(start).map(e => e.argument), device === "tandy" ? [0x24, 0x6e, 0x24, 0x21] : [0x24, 0x6e, 0x21]);
  const speech = requests[start + 1];
  assert.equal(speech.busy, true);
  assert.ok(result.events.some(e => e.type === "complete" && e.token === speech.token && e.busy === false));
  assert.equal(result.speechControls, device === "tandy");
  if (device === "tandy") {
    assert.equal(result.moduleBarrier, true);
    assert.deepEqual(result.pauseEvidence.map(e => e.name), ["speech-pause", "speech-resumed"]);
    assert.equal(result.pauseEvidence[0].state.rivalReport.waitingForInputPoll, true);
    assert.equal(result.pauseEvidence[1].state.rivalReport.pollRemaining, 14);
  }
}
const setup = await json(m.artifacts.setupNegatives.path);
assert.equal(setup.completed, true);
assert.deepEqual(setup.checks, ["zero-cases", "missing-fixture", "corrupt-fixture"].map(kind => ({kind, rejected:true, exitCode:1})));
await currentSource(m.checksSource);
for (const [key, count] of [["units", 194], ["boundaries", 59]]) {
  const log = await readFile(m.artifacts[key].path, "utf8");
  for (const [label, value] of [["tests", count], ["pass", count], ["fail", 0], ["skipped", 0]]) assert.match(log, new RegExp(label + " " + value + "\\b"));
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
for (const script of ["verify-rival-input-source", "verify-rival-keyboard-source", "verify-result-caller-source"]) {
  const check = spawnSync(process.execPath, ["scripts/" + script + ".js"], {encoding:"utf8"});
  assert.equal(check.status, 0, check.stderr);
}
console.log("Rival acceptance:18 control checkpoints/2318 events,Standard85/5071,failure11/454,four input negatives,three setup negatives,194 units,59 boundaries,build;conditional actual speaker/Tandy I/O. Not native timing/waveform parity.");
