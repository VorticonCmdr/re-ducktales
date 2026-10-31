// Conditional caller tests,not independent startup/browser or native timing evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { ResultInputWait } from "../src/game/result-input-wait.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function fixture({
  phase = "repair",
  audio = false,
  money = 50,
  day = 13,
} = {}) {
  const { game: g } = await originalGame();
  g.input({ type: "audio-enabled", enabled: audio });
  g.securityPending = false;
  g.scene = "flight";
  g.departure = { from: 35, target: 34, racing: false };
  g.flight = {
    memory: g.marketMemory,
    drainEvents: () => [],
    setControls: () => {},
    outcome: { code: 0, day, seed: 7341, money },
  };
  const handoffs = [];
  // Capture only the caller handoff. Real expedition arrival is tested in browser.
  g.arrive = (...args) => handoffs.push(args);
  g.drainEffects();
  g.collectFlight();
  if (phase === "wreckage") g.finishRepairs(); // Declared phase-boundary injection.
  const w = g.resultWait,
    state = g.repairs;
  g.drainEffects();
  return { g, w, state, handoffs };
}
for (const [phase, count] of [
  ["repair", 60],
  ["wreckage", 100],
]) {
  test(
    phase +
      " makes exactly" +
      count +
      " immediate/seven-tick reads with no extra final read",
    () => {
      const state = { remaining: count * 7, skipRequested: true };
      let flushes = 0;
      const w = new ResultInputWait({
        state,
        count,
        pollInput: () => true,
        flushInput: () => flushes++,
      });
      w.begin();
      assert.equal(flushes, 1);
      assert.equal(w.inputPolls, 1);
      assert.equal(state.skipRequested, false);
      for (let i = 1; i < count * 7; i++) {
        assert.equal(w.advanceTick(), false);
        assert.equal(w.inputPolls, 1 + Math.floor(i / 7));
      }
      state.skipRequested = true;
      assert.equal(w.advanceTick(), true);
      assert.equal(w.inputPolls, count);
      assert.equal(w.skipped, false);
    },
  );
  test(
    phase + " samples Pause at seven ticks and resumes its pending read",
    async () => {
      const { g, w, state } = await fixture({ phase });
      g.input({ type: "pause" });
      ticks(g, 6);
      assert.equal(g.systemOverlay, null);
      ticks(g, 1);
      assert.equal(g.systemOverlay.kind, "pause");
      assert.equal(w.waitingForInputPoll, true);
      assert.equal(state.remaining, count * 7 - 7);
      ticks(g, 100);
      assert.equal(state.remaining, count * 7 - 7);
      g.input({ type: "pause" });
      ticks(g, 7);
      assert.equal(g.systemOverlay, null);
      assert.equal(w.waitingForInputPoll, false);
      assert.equal(w.inputPolls, 2);
      assert.equal(state.remaining, count * 7 - 7);
    },
  );
  test(
    phase + " Quit-No discards queued P/S/Fire and requires fresh Fire",
    async () => {
      const { g, w, state } = await fixture({ phase });
      for (const type of ["pause", "toggle-sound", "fire", "quit"])
        g.input({ type });
      ticks(g, 7);
      assert.equal(g.systemOverlay.kind, "quit");
      assert.equal(g.audioEnabled, false);
      g.input({ type: "quit-no" });
      assert.equal(g.systemOverlay, null);
      assert.equal(state.skipRequested, false);
      assert.equal(w.complete, false);
      ticks(g, 7);
      assert.equal(w.complete, false);
      g.input({ type: "fire" });
      ticks(g, 7);
      assert.equal(w.complete, true);
      assert.equal(w.skipped, true);
    },
  );
  for (const audio of [false, true])
    test(
      phase + " fresh Fire requests click only while enabled:" + audio,
      async () => {
        const { g, w } = await fixture({ phase, audio });
        g.input({ type: "fire" });
        ticks(g, 6);
        assert.equal(w.complete, false);
        ticks(g, 1);
        assert.equal(w.skipped, true);
        const effects = g.drainEffects();
        assert.deepEqual(
          effects.filter((e) => e.type === "sound").map((e) => e.id),
          audio ? [0x24] : [],
        );
        assert.equal(
          effects.some((e) => e.type === "stopAudio"),
          false,
        );
      },
    );
  test(phase + " sound toggle is consumed at the reader boundary", async () => {
    const { g } = await fixture({ phase });
    g.input({ type: "toggle-sound" });
    ticks(g, 6);
    assert.equal(g.audioEnabled, false);
    ticks(g, 1);
    assert.equal(g.audioEnabled, true);
  });
}
test("repair completion carries original cash/day/RNG into wreckage and flushes old Fire", async () => {
  const { g, w, handoffs } = await fixture();
  assert.equal(g.campaign.day, 15);
  assert.equal(g.money, 50);
  assert.equal(g.seed, 7341);
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(w.skipped, true);
  assert.equal(g.repairs.phase, "wreckage");
  assert.equal(g.repairs.loss, 25);
  assert.equal(g.money, 25);
  assert.equal(g.seed, 46558);
  assert.equal(g.resultWait.inputPolls, 1);
  assert.equal(g.repairs.skipRequested, false);
  assert.equal(g.resultWait.complete, false);
  ticks(g, 7);
  assert.equal(g.repairs.phase, "wreckage");
  assert.equal(handoffs.length, 0);
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(handoffs.length, 1);
  assert.equal(g.resultWait, null);
});
for (const money of [0, 0x80000000, 0xffffffff])
  test("signed nonpositive cash skips RNG/wreckage:" + money, async () => {
    const { g, handoffs } = await fixture({ money });
    ticks(g, 420);
    assert.equal(g.seed, 7341);
    assert.equal(g.money, money);
    assert.equal(g.repairs.phase, "repair");
    assert.equal(handoffs.length, 1);
  });
test("repair days wrap as a byte before the input wait", async () => {
  const { g } = await fixture({ day: 255 });
  assert.equal(g.campaign.day, 1);
});
test("Restart discards repair reader, pending input and presentation state", async () => {
  const { g } = await fixture();
  g.input({ type: "pause" });
  g.input({ type: "restart" });
  assert.equal(g.scene, "title");
  assert.equal(g.resultWait, null);
  assert.equal(g.repairs, null);
  assert.equal(g.pendingResultSystemKeys.size, 0);
});
