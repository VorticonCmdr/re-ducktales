// Saved browser evidence and exact muted regressions have different scopes.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import { validateProducerArchive, acceptedRuntimeSource } from "./lib/consumer-provenance.js";
const path = process.argv.find(a => a.startsWith("--manifest="))?.slice(11)
  ?? "reference/cave-audio-acceptance.json";
const m = await json(path);
assert.equal(m.kind, "cave-audio-acceptance");
assert.equal(m.nativeComparison, false);
assert.ok(Array.isArray(m.cases) && m.cases.length > 0, "Zero cave audio cases");
await checkArtifacts(m.artifacts);
async function current(root) {
  const source = await validateProducerArchive(root);
  for (const [p, h] of Object.entries(source.files))
    if (acceptedRuntimeSource(p)) assert.equal(sha(await readFile(p)), h, "Changed accepted runtime " + p);
  const files = (await readdir("src", { recursive: true, withFileTypes: true }))
    .filter(d => d.isFile()).map(d => `${d.parentPath}/${d.name}`).sort();
  assert.deepEqual(files, Object.keys(source.files).filter(p => p.startsWith("src/")).sort());
}
function audio(o, mode) {
  const acks = o.events.filter(e => e.type === "ack"), queries = acks.filter(e => e.query);
  assert.ok(o.path.length > 0);
  assert.equal(queries.length, 1, "Missing or duplicate terminal query");
  assert.equal(queries[0].argument, null);
  if (queries[0].busy) assert.ok(o.events.some(e => e.type === "complete" &&
    e.token === queries[0].token && !e.busy), "Missing device completion");
  assert.equal(acks.filter(e => e.argument >= 0x4d && e.argument <= 0x51).length,
    o.path.length + 1, "Missing or duplicate entry cue");
  assert.ok(acks.some(e => e.argument === 0x48 && e.busy));
  assert.equal(acks.some(e => e.argument === 0 && e.sequence > queries[0].sequence), mode === "enabled");
  assert.equal(o.initial.scene, "cave");
  assert.equal(o.final.scene, "expedition-result");
  assert.equal(o.final.expeditionResult.phase, "failure");
  assert.equal(o.final.diagnostic, null);
  assert.deepEqual(o.observations.map(p => p.name), ["first-room",
    ...o.path.flatMap(() => ["input-reader", "room-change"]), "pit-sound",
    "failure-result", ...(mode === "enabled" ? ["guarded-return-reset"] : [])]);
}
assert.deepEqual(m.cases.map(c => c.device + "-" + c.mode), ["speaker-enabled", "tandy-muted"]);
for (const c of m.cases) {
  await current(c.root);
  const result = await json(c.root + "/result.json"), o = await json(c.root + "/observation.json");
  assert.equal(result.completed, true); assert.equal(result.accepted, true);
  assert.equal(result.device, c.device); assert.equal(result.mode, c.mode);
  assert.equal(result.restart, true); assert.equal(result.queries, 1);
  assert.equal(result.roomEntries, o.path.length + 1);
  assert.equal(result.prefixEvents, m.prefixEvents);
  audio(o, c.mode);
  const missingQuery = structuredClone(o);
  missingQuery.events = missingQuery.events.filter(e => !e.query);
  assert.throws(() => audio(missingQuery, c.mode), /terminal query/);
  const missingCue = structuredClone(o), index = missingCue.events.findIndex(e =>
    e.type === "ack" && e.argument >= 0x4d && e.argument <= 0x51);
  assert.ok(index >= 0); missingCue.events.splice(index, 1);
  assert.throws(() => audio(missingCue, c.mode), /entry cue/);
}
await current(m.failureRoot);
const failure = await json(m.failureRoot + "/acceptance-status.json");
assert.equal(failure.completed, true); assert.equal(failure.accepted, true);
assert.equal(failure.checked, 11); assert.equal(failure.consumed, 454);
assert.equal(failure.semanticNegatives, 1); assert.equal(failure.restart, true);
await current(m.winningRoot);
const win = await json(m.winningRoot + "/acceptance-status.json");
assert.equal(win.completed, true); assert.equal(win.accepted, true);
assert.equal(win.checked, 170); assert.equal(win.consumed, 6575);
assert.equal(win.semanticNegatives, 1); assert.equal(win.restart, true);
for (const command of ["scripts/verify-cave-audio-source.js", "scripts/verify-cave-audio-calls-source.js",
  "scripts/verify-cave-audio-source-negative.js", "scripts/verify-cave.js"]) {
  const r = spawnSync(process.execPath, [command], { encoding: "utf8" });
  assert.equal(r.error, undefined); assert.equal(r.status, 0, r.stdout + r.stderr);
  process.stdout.write(r.stdout);
}
console.log("Cave audio accepted in declared scopes: real speaker enabled/Tandy muted pit routes, negative query/cue controls; unchanged exact muted failure11 and winning170 checkpoints. Not native timing parity or all-ending browser audio acceptance.");
