// Saved port regression and conditional actual-device evidence. No native
// notice capture or whole-game cadence claim follows from these receipts.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/visit-input-acceptance.json");
assert.equal(m.kind, "collected-notice-acceptance");
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
const controls = await json(m.artifacts.controlsScenario.path);
assert.equal(controls.kind, "visit-input-browser-regression");
assert.deepEqual(
  controls.cases.map((c) => c.key),
  ["player", "rival"],
);
for (const c of controls.cases) {
  assert.equal(c.checkpoints, 9);
  assert.ok(c.events > 0);
  await checkArtifacts(c.artifacts);
  await validateProducerArchive(c.producer);
}
const controlSource = await current(m.controlsConsumer),
  result = await json(m.artifacts.controlsResult.path);
assert.equal(result.completed, true);
assert.equal(result.accepted, true);
assert.equal(result.nativeComparison, false);
assert.equal(result.sourceCommit, controlSource.commit);
assert.deepEqual(
  result.cases,
  controls.cases.map((c) => ({
    key: c.key,
    checked: 9,
    consumed: c.events,
    restart: true,
    semanticNegatives: 1,
  })),
);
await checkArtifacts(result.artifacts);
assert.deepEqual(
  m.audio.map((c) => c.device + "-" + c.mode),
  ["speaker-during", "tandy-during", "speaker-before", "tandy-before"],
);
for (const c of m.audio) {
  const source = await current(c.consumer),
    r = await json(m.artifacts[c.device + "-" + c.mode].path);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, false);
  assert.equal(r.restart, true);
  assert.equal(r.sourceCommit, source.commit);
  assert.equal(r.device, c.device);
  assert.equal(r.mode, c.mode);
  assert.equal(r.entered.scene, "visit-notice");
  assert.equal(r.entered.visitNotice.reason, "rival");
  assert.equal(r.final.scene, "map");
  assert.equal(r.final.campaign.day, r.entered.campaign.day);
  assert.equal(r.final.campaign.location, r.entered.campaign.location);
  assert.equal(r.final.money, r.entered.money);
  const acks = r.events.filter((e) => e.type === "ack");
  assert.deepEqual(
    acks.filter((e) => e.argument !== null).map((e) => e.argument),
    c.mode === "during" ? [0, 0x6e, 0, 0x24] : [0, 0, 0x24],
  );
  assert.ok(r.status.token.startsWith("visit:"));
  if (c.mode === "before") {
    assert.equal(r.status.query, true);
    assert.equal(r.status.argument, null);
  } else assert.equal(r.status.busy, true);
  if (r.status.busy) {
    assert.ok(
      r.events.some(
        (e) => e.type === "complete" && e.token === r.status.token && !e.busy,
      ),
    );
    assert.equal(r.phases.includes("dialogue"), false);
  } else assert.ok(r.phases.includes("dialogue"));
  assert.equal(r.stats.contextState, "running");
}
const winningScenario = await json(m.artifacts.winningScenario.path);
await checkArtifacts(winningScenario.artifacts);
await validateProducerArchive(winningScenario.producer);
const source = await current(m.winningConsumer),
  win = await json(m.artifacts.winningResult.path);
assert.equal(win.sourceCommit, source.commit);
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
  ["boundaries", 99],
]) {
  const log = await readFile(m.artifacts[key].path, "utf8");
  assert.match(log, new RegExp("tests " + count + "\\b"));
  assert.match(log, new RegExp("pass " + count + "\\b"));
  for (const field of ["fail", "cancelled", "skipped", "todo"])
    assert.match(log, new RegExp(field + " 0\\b"));
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
for (const command of [
  ["scripts/verify-visit-input-source.js"],
  ["scripts/verify-result-caller-source.js"],
  ["scripts/verify-rival-keyboard-source.js"],
  ["scripts/verify-visits.js"],
  ["scripts/verify-visit-input-setup-negative.js"],
]) {
  const r = spawnSync(process.execPath, command, { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
}
console.log(
  "Collected notices:original192-byte caller proof;194 units,99 boundaries;18 exact browser checkpoints and two omitted-P negatives;four conditional actual-device cases;unchanged winning170/6575 and input negative. Native notice/reveal/PIT timing remains unverified.",
);
