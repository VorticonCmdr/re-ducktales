// Distinct evidence levels:conditional device I/O,production smoke,and strict
// recorded winning campaign. None is a native whole-game timing comparison.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const path =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/sound-toggle-acceptance.json";
const m = await json(path);
assert.equal(m.kind, "sound-toggle-acceptance");
assert.equal(m.nativeComparison, false);
assert.ok(m.cases.length > 0, "Zero sound-toggle cases");
assert.deepEqual(
  m.cases.map((c) => c.key),
  [
    "office-speaker",
    "office-tandy",
    "during-speaker",
    "during-tandy",
    "before-speaker",
    "before-tandy",
  ],
);
await originalGame();
await checkArtifacts(m.artifacts);
async function current(root) {
  const source = await validateProducerArchive(root);
  for (const [path, hash] of Object.entries(source.files))
    if (acceptedRuntimeSource(path))
      assert.equal(
        sha(await readFile(path)),
        hash,
        "Changed accepted runtime " + path,
      );
  return source;
}
for (const c of m.cases) {
  assert.equal(c.key, c.mode + "-" + c.device);
  await checkArtifacts({ result: c.result });
  const source = await current(c.consumer),
    r = await json(c.result.path);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, false);
  assert.equal(r.restart, true);
  assert.equal(r.device, c.device);
  assert.equal(r.sourceCommit, source.commit);
  const events = c.mode === "office" ? r.enabled.events : r.events,
    acks = events.filter((e) => e.type === "ack");
  const expected =
    c.mode === "office"
      ? [0, 0x24, 0]
      : c.mode === "during"
        ? [0, 0x24, 0x6e, 0, 0x24]
        : [0, 0, 0x24, null];
  assert.deepEqual(c.expectedAcks, expected);
  assert.deepEqual(
    acks.map((e) => e.argument),
    expected,
  );
  assert.deepEqual(
    acks.map((e) => e.sequence),
    acks.map((_, i) => i + 1),
  );
  const off = c.mode === "office" ? 0 : c.mode === "during" ? 3 : 1;
  assert.equal(acks[off].frame, acks[off + 1].frame);
  if (c.device === "speaker") assert.equal(acks[off + 1].accepted, false);
  else assert.equal(acks[off + 1].busy, true);
  const stats = c.mode === "office" ? r.enabled.stats : r.stats;
  assert.equal(stats.contextState, "running");
  assert.equal(stats.device, c.device);
  assert.equal(stats.requests, stats.lastAcknowledged);
  assert.equal(stats.pendingTokens, "0");
  if (c.mode === "office") {
    assert.equal(r.after, true);
    if (c.device === "tandy")
      assert.ok(Number(r.stopped.stats.signalSamples) > 0);
  } else {
    assert.equal(r.mode, c.mode);
    const status =
      c.mode === "before"
        ? acks.find((e) => e.query)
        : acks.find((e) => e.argument === 0x6e);
    assert.deepEqual(r.status, status);
    assert.ok(status.token.startsWith("rival:"));
    assert.equal(
      acks.filter((e) => e.query).length,
      c.mode === "before" ? 1 : 0,
    );
    if (c.mode === "during") assert.equal(status.busy, true);
    const complete = events.filter((e) => e.type === "complete");
    assert.equal(complete.length, status.busy ? 1 : 0);
    if (status.busy) {
      assert.equal(complete[0].token, status.token);
      assert.equal(complete[0].sequence, status.sequence);
      assert.equal(complete[0].busy, false);
      assert.equal(r.phases.includes("dialogue"), false);
    } else assert.ok(r.phases.includes("dialogue"));
    assert.equal(r.final.scene, "map");
    assert.equal(r.final.campaign.rival.location, r.entered.rivalReport.target);
    assert.equal(r.final.campaign.day, r.entered.campaign.day);
    assert.equal(r.final.money, r.entered.money);
    if (c.mode === "before" && c.device === "speaker")
      assert.equal(Number(stats.signalSamples), 0);
    else assert.ok(Number(stats.signalSamples) > 0);
  }
}
assert.deepEqual(
  m.before.map((b) => b.device),
  ["speaker", "tandy"],
);
for (const b of m.before) {
  await checkArtifacts({ result: b.result });
  const source = await validateProducerArchive(b.consumer);
  const r = await json(b.result.path);
  assert.equal(r.completed, true);
  assert.equal(r.device, b.device);
  assert.equal(r.sourceCommit, source.commit);
  assert.equal(r.after, false);
  assert.deepEqual(
    r.enabled.events.filter((e) => e.type === "ack").map((e) => e.argument),
    [0, 0],
  );
}
const scenario = await json(m.artifacts.winningScenario.path);
assert.equal(scenario.kind, "standard-full-campaign-port-regression");
assert.equal(scenario.expectedOutcome.won, true);
assert.equal(scenario.expectedCheckpointCount, 170);
assert.equal(scenario.requiredEventCount, 6575);
await checkArtifacts(scenario.artifacts);
await validateProducerArchive(scenario.producer);
const source = await current(m.winningConsumer),
  winner = await json(m.artifacts.winningResult.path);
assert.equal(winner.completed, true);
assert.equal(winner.accepted, true);
assert.equal(winner.nativeComparison, false);
assert.equal(winner.sourceCommit, source.commit);
assert.equal(winner.producer, scenario.producer);
assert.equal(winner.checked, 170);
assert.equal(winner.consumed, 6575);
assert.equal(winner.restart, true);
assert.equal(winner.semanticNegatives, 1);
await checkArtifacts(winner.artifacts);
await current(m.checksSource);
await current(m.productionSource);
const production = await json(m.artifacts.productionReport.path);
assert.equal(production.stats.expected, 2);
for (const key of ["unexpected", "skipped", "flaky"])
  assert.equal(production.stats[key], 0);
assert.deepEqual(production.errors, []);
for (const device of ["speaker", "tandy"]) {
  const p = await json(m.artifacts["production-" + device].path);
  assert.equal(p.completed, true);
  assert.equal(p.device, device);
  assert.equal(p.restart, true);
  const ack = p.events.filter((e) => e.type === "ack");
  assert.deepEqual(
    ack.map((e) => e.argument),
    [0, 0x24, 0],
  );
  assert.equal(ack[0].frame, ack[1].frame);
  if (device === "speaker") assert.equal(ack[1].accepted, false);
  else assert.equal(ack[1].busy, true);
}
for (const [key, count] of [
  ["units", 194],
  ["boundaries", 91],
]) {
  const log = await readFile(m.artifacts[key].path, "utf8");
  for (const [label, value] of [
    ["tests", count],
    ["pass", count],
    ["fail", 0],
    ["skipped", 0],
  ])
    assert.match(log, new RegExp(label + " " + value + "\\b"));
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
const negatives = await json(m.artifacts.setupNegatives.path);
assert.equal(negatives.completed, true);
assert.deepEqual(
  negatives.checks,
  ["zero-cases", "missing-fixture", "corrupt-fixture"].map((kind) => ({
    kind,
    rejected: true,
    exitCode: 1,
  })),
);
for (const script of [
  "verify-sound-toggle-source",
  "verify-speaker-engine",
  "verify-tandy-game",
]) {
  const r = spawnSync(process.execPath, ["scripts/" + script + ".js"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(r.status, 0, r.stderr);
}
console.log(
  "Sound-toggle acceptance:original59-byte call order;native driver/IRQ boundaries and negatives;194 units,91 boundaries;six conditional actual-device scenarios,two production cases;unchanged winning170/6575 with input negative;three setup negatives. No native sub-call phase,waveform or whole-game timing parity claim.",
);
