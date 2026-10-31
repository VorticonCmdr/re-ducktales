// Conditional setup for exact guide-reader rules. Browser acceptance separately
// earns the transmitter and reaches the guide with real controls.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { ExpeditionBriefing } from "../src/game/expedition.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function fresh() {
  const { game: g } = await originalGame();
  g.drainEffects();
  g.arrive(1, 8);
  return { g, b: g.briefing };
}
async function component(options = {}) {
  const { archives } = await originalGame();
  return new ExpeditionBriefing({
    flags: 8,
    seed: 123,
    clues: archives.get("CLUES.ARC"),
    ...options,
  });
}
test("all four guides flush before an immediate read and finish after exactly30 seven-tick waits", async () => {
  const { archives } = await originalGame();
  for (const flags of [1, 2, 4, 8]) {
    const calls = [],
      b = new ExpeditionBriefing({
        flags,
        seed: 123,
        clues: archives.get("CLUES.ARC"),
        flushInput: () => calls.push("flush"),
        pollInput: () => {
          calls.push("read");
          return true;
        },
      });
    b.begin();
    assert.deepEqual(calls, ["flush", "read"]);
    const identity = {
      seed: b.seed,
      clue: b.clue,
      lines: b.lines,
      chapter: b.chapter,
    };
    for (let i = 1; i < 210; i++) {
      assert.equal(b.advanceTick(), false);
      assert.equal(b.inputPolls, 1 + Math.floor(i / 7));
      assert.equal(b.remaining, 210 - i);
    }
    assert.equal(b.inputPolls, 30);
    assert.equal(b.advanceTick(), true);
    assert.equal(b.inputPolls, 30);
    assert.equal(b.remaining, 0);
    assert.equal(b.advanceTick(), true);
    assert.deepEqual(
      { seed: b.seed, clue: b.clue, lines: b.lines, chapter: b.chapter },
      identity,
    );
    assert.deepEqual(Object.keys(b.snapshot()), [
      "activity",
      "variant",
      "seed",
      "clue",
      "remaining",
    ]);
  }
});
test("guide entry flush clears pre-entry system keys,held controls and ordinary IRQ flags", async () => {
  const { game: g } = await originalGame();
  g.pendingBriefingSystemKeys.set(0x19, "pause");
  g.controls = { fire: true, direction: "right" };
  g.expeditionKeyboard.event(0x39, true);
  g.arrive(1, 8);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingBriefingSystemKeys.size, 0);
  assert.deepEqual(g.controls, { fire: false, direction: null });
  assert.ok([...g.expeditionKeyboard.bytes()].every((b) => b === 0));
  assert.equal(g.briefing.inputPolls, 1);
  assert.ok(g.drainEffects().some((e) => e.type === "flushControls"));
});
test("guide P waits for the next seven-tick read instead of opening an immediate dialog", async () => {
  const { g, b } = await fresh();
  g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingBriefingSystemKeys.size, 1);
  ticks(g, 6);
  assert.equal(g.systemOverlay, null);
  assert.equal(b.remaining, 204);
  ticks(g, 1);
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(b.remaining, 203);
  assert.equal(b.waitingForInputPoll, true);
  assert.equal(b.inputPolls, 1);
});
test("guide Pause freezes the reader,flushes pending Fire,and resumes that same read before a fresh wait", async () => {
  const { g, b } = await fresh();
  g.input({ type: "pause" });
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(b.skipRequested, true);
  const tick = g.tick;
  ticks(g, 35);
  assert.equal(g.tick, tick + 35);
  assert.equal(b.remaining, 203);
  assert.equal(b.inputPolls, 1);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.systemOverlay, null);
  assert.equal(b.waitingForInputPoll, false);
  assert.equal(b.skipRequested, false);
  assert.equal(b.inputPolls, 2);
  assert.equal(b.remaining, 203);
  ticks(g, 6);
  assert.equal(b.inputPolls, 2);
  ticks(g, 1);
  assert.equal(b.inputPolls, 3);
  assert.equal(b.remaining, 196);
});
test("guide Quit-No observes scan priority and discards queued Pause,Sound and Fire on return", async () => {
  const { g, b } = await fresh();
  for (const type of ["pause", "quit", "toggle-sound", "fire"])
    g.input({ type });
  ticks(g, 7);
  assert.equal(g.systemOverlay.kind, "quit");
  assert.equal(g.audioEnabled, false);
  assert.equal(b.inputPolls, 1);
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingBriefingSystemKeys.size, 0);
  assert.equal(b.inputPolls, 2);
  assert.equal(b.remaining, 203);
  assert.equal(b.skipRequested, false);
  assert.equal(g.audioEnabled, false);
});
test("guide sound-toggle is consumed at the reader rather than when the external key arrives", async () => {
  const { g, b } = await fresh();
  g.input({ type: "toggle-sound" });
  ticks(g, 6);
  assert.equal(g.audioEnabled, false);
  ticks(g, 1);
  assert.equal(g.audioEnabled, true);
  assert.equal(b.inputPolls, 2);
  assert.equal(b.remaining, 203);
});
test("guide Fire shortens the wait only at an actual read", async () => {
  const b = await component();
  b.begin();
  b.skipRequested = true;
  for (let i = 0; i < 6; i++) assert.equal(b.advanceTick(), false);
  assert.equal(b.advanceTick(), true);
  assert.equal(b.remaining, 203);
  assert.equal(b.inputPolls, 2);
});
test("guide last neutral wait consumes neither Fire nor an extra system-key read", async () => {
  const { g, b } = await fresh();
  ticks(g, 203);
  assert.equal(b.remaining, 7);
  assert.equal(b.inputPolls, 30);
  g.input({ type: "pause" });
  g.input({ type: "fire" });
  ticks(g, 6);
  assert.equal(g.scene, "expedition-briefing");
  assert.equal(g.systemOverlay, null);
  ticks(g, 1);
  assert.equal(g.scene, "cave");
  assert.equal(b.inputPolls, 30);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingBriefingSystemKeys.size, 0);
});
test("Restart discards guide state and queued keys even when its reader is blocked", async () => {
  const { g, b } = await fresh();
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(b.waitingForInputPoll, true);
  g.input({ type: "restart" });
  assert.equal(g.scene, "title");
  assert.equal(g.briefing, null);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingBriefingSystemKeys.size, 0);
});
test("guide providers and reader lifecycle reject unsupported calls with diagnostics", async () => {
  await assert.rejects(
    () => component({ pollInput: 0 }),
    /Invalid guide input boundary/,
  );
  const b = await component();
  assert.throws(() => b.advanceTick(), /before entry flush/);
  assert.throws(() => b.resumeInputPoll(), /outside input reader/);
  b.begin();
  assert.throws(() => b.begin(), /already started/);
  const bad = await component({ pollInput: () => undefined });
  assert.throws(() => bad.begin(), /Invalid guide input poll result/);
});
test("guide checker rejects the legacy immediate system-key dispatch", async () => {
  const { g } = await fresh();
  g.handleInput({ type: "pause" }, true);
  assert.throws(() => assert.equal(g.systemOverlay, null), {
    code: "ERR_ASSERTION",
  });
});
test("guide entry checker rejects an omitted original flush", async () => {
  const { game: g } = await originalGame();
  g.pendingBriefingSystemKeys.set(0x19, "pause");
  g.flushBriefingInput = () => {};
  g.arrive(1, 8);
  assert.throws(() => assert.equal(g.systemOverlay, null), {
    code: "ERR_ASSERTION",
  });
});
