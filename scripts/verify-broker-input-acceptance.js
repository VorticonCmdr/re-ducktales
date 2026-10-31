// Strict saved port/device receipts;native timing remains outside this gate.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/broker-input-acceptance.json");
assert.equal(m.kind, "broker-input-acceptance");
assert.equal(m.nativeComparison, false);
await originalGame();
await checkArtifacts(m.artifacts);
async function current(root) {
  const source = await validateProducerArchive(root);
  for (const [p, h] of Object.entries(source.files))
    if (acceptedRuntimeSource(p))
      assert.equal(sha(await readFile(p)), h, "Changed accepted runtime " + p);
  const files = (await readdir("src", { recursive: true, withFileTypes: true }))
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    files,
    Object.keys(source.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
  );
  return source;
}
const scenario = await json(m.artifacts.controlsScenario.path);
assert.equal(scenario.kind, "broker-input-browser-regression");
assert.deepEqual(
  scenario.cases.map((c) => [c.key, c.checkpoints, c.events]),
  [
    ["fire", 13, 64],
    ["timeout", 13, 62],
    ["late-pause", 5, 40],
  ],
);
for (const c of scenario.cases) {
  await checkArtifacts(c.artifacts);
  await validateProducerArchive(c.producer);
}
const cs = await current(m.controlsConsumer),
  r = await json(m.artifacts.controlsResult.path);
assert.equal(r.sourceCommit, cs.commit);
assert.equal(r.completed, true);
assert.equal(r.accepted, true);
assert.equal(r.nativeComparison, false);
assert.deepEqual(
  r.cases,
  scenario.cases.map((c) => ({
    key: c.key,
    checked: c.checkpoints,
    consumed: c.events,
    restart: true,
    semanticNegatives: 1,
  })),
);
await checkArtifacts(r.artifacts);
assert.deepEqual(Object.keys(m.audioConsumers), ["speaker", "tandy"]);
for (const device of ["speaker", "tandy"]) {
  const source = await current(m.audioConsumers[device]),
    r = await json(m.artifacts[device + "Audio"].path);
  assert.equal(r.sourceCommit, source.commit);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, false);
  assert.equal(r.restart, true);
  assert.equal(r.device, device);
  assert.equal(r.entered.scene, "investments");
  assert.equal(r.entered.investments.phase, "broker");
  assert.equal(r.final.scene, "office");
  assert.equal(r.final.investments.shares[10], 1);
  assert.equal(r.final.money, 978);
  assert.equal(r.final.campaign.day, 1);
  assert.equal(r.final.rareCoinTaken, true);
  assert.deepEqual(
    r.events.filter((e) => e.type === "ack").map((e) => e.argument),
    [0, 0x24, 0, 6],
  );
  assert.equal(r.stats.contextState, "running");
  assert.ok(Number(r.stats.signalSamples) > 0);
}
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
  ["boundaries", 111],
]) {
  const log = await readFile(m.artifacts[key].path, "utf8");
  for (const field of ["tests", "pass"])
    assert.match(log, new RegExp(field + " " + count + "\\b"));
  for (const field of ["fail", "cancelled", "skipped", "todo"])
    assert.match(log, new RegExp(field + " 0\\b"));
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
for (const command of [
  ["scripts/verify-broker-input-source.js"],
  ["scripts/verify-result-caller-source.js"],
  ["scripts/verify-rival-keyboard-source.js"],
  ["scripts/verify-investment-trading.js"],
  ["scripts/verify-broker-input-setup-negative.js"],
]) {
  const r = spawnSync(process.execPath, command, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
}
console.log(
  "Broker acceptance:105 original/prepared/Ghidra bytes;194 units,111 boundaries;31 exact browser checkpoints/166 events with three omitted-P negatives;two actual-browser audio cases;unchanged winning170/6575 and input negative. Native broker/office whole-handoff timing and portfolio cadence remain unverified.",
);
