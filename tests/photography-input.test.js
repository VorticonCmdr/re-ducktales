import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import build from "../reference/build.json" with { type: "json" };
import evidence from "../reference/photography-input.json" with { type: "json" };
import runtimeEvidence from "../reference/photography-runtime.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
function preservedHash(source) {
  const m = structuredClone(source);
  delete m.id;
  delete m.inputTimingCorrection;
  for (const c of m.replays) {
    delete c.expectedClockEventCount;
    delete c.final.ds;
    delete c.final.state.tick;
    delete c.final.state.retrace;
  }
  for (const c of m.resourceCoverage) {
    delete c.clockEvents;
    delete c.ds;
  }
  return hash(JSON.stringify(m));
}
assert.equal(
  preservedHash(runtimeEvidence),
  evidence.preservedRegressionSHA256,
);
// This correction may change only final clock endpoints. Reject changed replay
// inputs, gameplay checkpoints, pixels and original artifact identities too.
for (const mutate of [
  (m) => (m.replays[0].inputEvents[0].byte ^= 1),
  (m) => m.replays[0].checkpoints[0].state.film++,
  (m) => (m.replays[0].final.pixels = "corrupt"),
]) {
  const wrong = structuredClone(runtimeEvidence);
  mutate(wrong);
  assert.notEqual(preservedHash(wrong), evidence.preservedRegressionSHA256);
}
async function supported(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
  return b;
}
const exe = await supported("DUCKTALE.EXE"),
  image = unpackImage(exe);
assert.equal(evidence.scenario.unitCases, 8);
assert.equal(evidence.source.ranges.length, 6);
for (const r of evidence.source.ranges) {
  const bytes =
    r.source === "overlay"
      ? exe.subarray(evidence.source.overlayBodyOffset)
      : image;
  assert.equal(
    hash(bytes.subarray(r.offset, r.offset + r.length)),
    r.sha256,
    r.purpose,
  );
}
const resources = {
  image,
  photographyEntries: parseArchive(await supported("PS.ARC")),
  mainEntries: parseArchive(await supported("MAIN.ARC")),
};
const locations = parseLocations(parseArchive(await supported("LOC.ARC")));
const loot = parseLoot(parseArchive(await supported("LOOT.ARC")));
// Conditional component entry. Browser acceptance independently earns entry.
function fresh() {
  const g = new Game({ locations, loot, expeditionResources: resources });
  g.seed = 0;
  g.difficulty = 2;
  g.campaign.location = 1;
  g.briefing = { activity: "photography", variant: 5 };
  g.startExpedition();
  return { g, p: g.photography, clock: new Scheduler(g) };
}
function until(c, fn, max = 8000) {
  for (let i = 0; i < max; i++) {
    if (fn()) return;
    c.clock.advanceTo(c.clock.now + 5);
  }
  assert.fail(
    `unfinished photography input case: ${JSON.stringify(c.p.snapshot())}`,
  );
}
function entryCheck(mutate = () => {}) {
  const c = fresh();
  mutate(c);
  c.g.input({ type: "pause" });
  c.g.input({ type: "toggle-sound" });
  assert.equal(c.g.systemOverlay, null);
  c.clock.advanceTo(1200);
  assert.equal(c.g.systemOverlay, null);
  assert.equal(c.g.audioEnabled, false);
  assert.equal(c.g.pendingPhotographySystemKeys.size, 0);
}
test("photography clears entry keys after its opening reveal", () =>
  entryCheck());
test("entry checker rejects a missing photography BIOS flush", () => {
  assert.throws(
    () =>
      entryCheck(({ p }) => {
        p.flushInput = () => {};
      }),
    assert.AssertionError,
  );
  const c = fresh();
  c.p.pollInput = () => undefined;
  assert.throws(
    () => c.clock.advanceTo(1200),
    /Invalid photography global input provider/,
  );
});
test("photography pause freezes all actor/local state while its device clocks advance", () => {
  const c = fresh(),
    { g, p, clock } = c;
  clock.advanceTo(1500);
  g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null);
  until(c, () => g.systemOverlay?.kind === "pause");
  assert.equal(p.wait.clock, "input");
  assert.equal(g.systemOverlay.phase, "lock");
  g.input({ type: "toggle-sound" });
  const before = p.snapshot(),
    bytes = Uint8Array.from(p.memory.bytes),
    locals = Uint8Array.from(p.locals.bytes);
  clock.advanceTo(clock.now + 800);
  const after = p.snapshot();
  assert.ok(after.tick > before.tick && after.retrace > before.retrace);
  for (const k of Object.keys(before))
    if (!["tick", "retrace"].includes(k))
      assert.deepEqual(after[k], before[k], k);
  bytes.set(p.memory.bytes.subarray(0x2225, 0x2229), 0x2225);
  assert.deepEqual(p.memory.bytes, bytes);
  assert.deepEqual(p.locals.bytes, locals);
  assert.equal(g.audioEnabled, false);
  g.input({ type: "controls", fire: true, direction: "right" });
  g.input({ type: "pause" });
  until(c, () => !g.systemOverlay);
  assert.deepEqual(p.controls, { fire: false, direction: null });
});
test("photography uses scan priority and cancelled quit drops pending pause", () => {
  const c = fresh();
  c.clock.advanceTo(1500);
  c.g.input({ type: "pause" });
  c.g.input({ type: "quit" });
  until(c, () => !!c.g.systemOverlay);
  assert.equal(c.g.systemOverlay.kind, "quit");
  c.g.input({ type: "quit-no" });
  assert.equal(c.g.systemOverlay, null);
  assert.equal(c.g.pendingPhotographySystemKeys.size, 0);
  c.clock.advanceTo(c.clock.now + 200);
  assert.equal(c.g.systemOverlay, null);
});
test("photography shutter animation retains global keys until its next reader", () => {
  const c = fresh();
  c.clock.advanceTo(1200);
  c.g.input({ type: "controls", fire: true, direction: null });
  until(c, () => c.p.memory.b(0x2066) === 7);
  c.g.input({ type: "controls", fire: false, direction: null });
  c.g.input({ type: "pause" });
  const shown = c.p.presentations;
  until(c, () => c.p.presentations >= shown + 3);
  assert.equal(c.p.memory.b(0x2066), 7);
  assert.equal(c.g.systemOverlay, null);
  until(c, () => !!c.g.systemOverlay);
  assert.equal(c.p.memory.b(0x2066), 0);
  assert.equal(c.p.wait.clock, "input");
});
function atResults() {
  const c = fresh();
  c.g.input({ type: "controls", fire: true, direction: null });
  until(c, () => c.p.phase === "results");
  c.g.input({ type: "controls", fire: false, direction: null });
  return c;
}
// Conditional presentation-clock experiment: all75 result-reveal retraces are
// supplied without driver advancement. No captured memory or fitted time is used.
function revealResults(c) {
  for (let i = 0; i < 75; i++) c.g.advanceRetrace();
}
test("results Fire is consumed immediately after reveal without an initial driver wait", () => {
  const c = atResults(),
    tick = c.p.tick;
  c.p.readDialogueFire = () => true;
  revealResults(c);
  assert.ok(c.p.outcome);
  assert.equal(c.p.tick, tick);
  assert.deepEqual(c.p.dialogueInputs, [true]);
});
test("neutral results consume exactly40 reads and280 driver ticks with original wait base", () => {
  const c = atResults(),
    tick = c.p.tick;
  c.p.readDialogueFire = () => false;
  revealResults(c);
  assert.deepEqual(c.p.dialogueInputs, [false]);
  for (let i = 0; i < 279; i++) c.g.advanceTick();
  assert.equal(c.p.outcome, null);
  assert.equal(c.p.dialogueInputs.length, 40);
  c.g.advanceTick();
  assert.ok(c.p.outcome);
  assert.equal(c.p.tick, tick + 280);
  assert.equal(c.p.memory.view.getUint32(0x2221, true), c.p.tick);
});
test("results reveal flushes keys and subsequent pause waits for the seven-tick reader", () => {
  const c = atResults(),
    { g, p } = c;
  g.input({ type: "pause" });
  g.input({ type: "toggle-sound" });
  p.readDialogueFire = () => false;
  revealResults(c);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingPhotographySystemKeys.size, 0);
  assert.equal(g.audioEnabled, false);
  g.input({ type: "pause" });
  for (let i = 0; i < 6; i++) {
    g.advanceTick();
    assert.equal(g.systemOverlay, null);
  }
  g.advanceTick();
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(p.dialogueInputs.length, 1);
  for (let i = 0; i < 40; i++) g.advanceTick();
  g.input({ type: "pause" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.equal(p.dialogueInputs.length, 2);
  assert.deepEqual(p.wait, { clock: "driver", remaining: 7 });
  assert.equal(p.memory.view.getUint32(0x2221, true), p.tick);
});
