// Distinct evidence:conditional actual device I/O,strict muted DOM replay,
// and the complete winning Standard route. No native timing-parity claim.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/atomic-audio-acceptance.json");
assert.equal(m.kind, "atomic-audio-acceptance");
assert.equal(m.nativeComparison, false);
await originalGame();
await checkArtifacts(m.artifacts);
async function current(root) {
  const s = await validateProducerArchive(root);
  for (const [p, h] of Object.entries(s.files))
    if (acceptedRuntimeSource(p))
      assert.equal(sha(await readFile(p)), h, "Changed accepted runtime " + p);
  const files = (await readdir("src", { recursive: true, withFileTypes: true }))
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    files,
    Object.keys(s.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
  );
  return s;
}
assert.deepEqual(
  m.cases.map((c) => c.device + "-" + c.mode),
  ["speaker-before", "tandy-before", "speaker-during", "tandy-during"],
);
for (const c of m.cases) {
  const s = await current(c.consumer),
    r = await json(m.artifacts[c.device + "-" + c.mode].path);
  assert.equal(r.sourceCommit, s.commit);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, false);
  assert.equal(r.after, true);
  assert.equal(r.device, c.device);
  assert.equal(r.mode, c.mode);
  assert.equal(r.restart, true);
  assert.equal(r.report.scene, "atomic-transport");
  assert.equal(r.report.atomicTransport.phase, "report");
  assert.equal(r.report.atomicTransport.busy, false);
  assert.equal(r.report.systemOverlay, null);
  assert.equal(r.report.atomicTransport.roll, 0);
  assert.equal(r.report.atomicTransport.seed, 6900);
  assert.equal(r.report.atomicTransport.target, 1);
  const acks = r.events.filter((e) => e.type === "ack");
  assert.deepEqual(
    acks.map((e) => e.argument),
    c.mode === "before" ? [0, 0, 0x24, null] : [0, 0, 0x45, 0],
  );
  const status = acks.find((e) => e.token?.startsWith("atomic:"));
  assert.ok(status);
  if (c.mode === "before") {
    assert.equal(status.query, true);
    assert.equal(status.argument, null);
  } else {
    assert.equal(status.argument, 0x45);
    assert.equal(status.busy, true);
    assert.equal(r.sounding.atomicTransport.phase, "sound");
    assert.equal(r.sounding.atomicTransport.busy, true);
  }
  if (status.busy)
    assert.ok(
      r.events.some(
        (e) => e.type === "complete" && e.token === status.token && !e.busy,
      ),
      "Missing actual completion",
    );
  assert.equal(r.final.scene, "jungle");
  assert.equal(r.final.campaign.location, 1);
  assert.equal(r.final.campaign.day, 6);
  assert.equal(r.final.money, 3400);
  assert.equal(r.final.atomicTransport.outcome.misdirected, true);
  assert.equal(r.stats.contextState, "running");
}
const muted = await json(m.artifacts.mutedResult.path);
await current(m.mutedConsumer);
assert.equal(muted.completed, true);
assert.equal(muted.checked, 23);
assert.equal(muted.consumed, 492);
assert.equal(muted.negativeControls, 2);
assert.equal(muted.report, true);
assert.equal(muted.guide, false);
assert.equal(muted.award, false);
assert.equal(muted.restart, true);
assert.equal(muted.producer, ".local/atomic-earned-report-01");
const producer = await json(m.artifacts.mutedScenario.path);
await checkArtifacts(producer.artifacts);
await validateProducerArchive(producer.captureRoot);
const ws = await current(m.winningConsumer),
  win = await json(m.artifacts.winningResult.path),
  winner = await json(m.artifacts.winningScenario.path);
await checkArtifacts(winner.artifacts);
await validateProducerArchive(winner.producer);
assert.equal(win.sourceCommit, ws.commit);
assert.equal(win.producer, winner.producer);
assert.equal(win.completed, true);
assert.equal(win.accepted, true);
assert.equal(win.nativeComparison, false);
assert.equal(win.checked, 170);
assert.equal(win.consumed, 6575);
assert.equal(win.restart, true);
assert.equal(win.semanticNegatives, 1);
await checkArtifacts(win.artifacts);
await current(m.checksSource);
for (const [key, count] of [
  ["units", 194],
  ["boundaries", 120],
]) {
  const log = await readFile(m.artifacts[key].path, "utf8");
  for (const field of ["tests", "pass"])
    assert.match(log, new RegExp(field + " " + count + "\\b"));
  for (const field of ["fail", "cancelled", "skipped", "todo"])
    assert.match(log, new RegExp(field + " 0\\b"));
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
for (const command of [
  ["scripts/verify-atomic-audio-source.js"],
  ["scripts/verify-atomic-input-source.js"],
  ["scripts/verify-atomic.js"],
]) {
  const r = spawnSync(process.execPath, command, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
}
console.log(
  "Atomic audio:124 original/prepared/Ghidra bytes;194 units,120 boundaries;four actual-browser device cases;unchanged muted23/492 with two input negatives and winning170/6575 with input negative. No native whole-atomic latency/CPU/PIT/waveform parity claim.",
);
