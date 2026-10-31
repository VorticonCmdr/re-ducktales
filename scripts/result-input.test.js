// Conditional exact caller/input tests; browser acceptance separately earns rewards.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { ResultInputWait } from "../src/game/result-input-wait.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function fresh({ phase = "award", audio = false, atomic = false } = {}) {
  const { game: g } = await originalGame();
  g.input({ type: "audio-enabled", enabled: audio });
  g.scene = "expedition-result";
  g.money = 3400;
  g.campaign.day = 3;
  g.campaign.location = atomic ? g.campaign.atomicLocation : 1;
  g.expeditionResult = {
    phase,
    ...(phase === "award" ? { value: 3000 } : {}),
    remaining: { failure: 20, award: 40, atomic: 100 }[phase] * 7,
    skipRequested: false,
  };
  const handoffs = [];
  g.completeCampaignAction = (a) => handoffs.push(a);
  g.drainEffects();
  g.beginResultWait();
  g.drainEffects();
  return { g, w: g.resultWait, state: g.expeditionResult, handoffs };
}
for (const phase of ["failure", "award", "atomic"]) {
  const count = { failure: 20, award: 40, atomic: 100 }[phase];
  test(
    phase +
      " reads immediately then makes exactly" +
      count +
      " seven-tick neutral waits",
    async () => {
      const calls = [],
        state = { remaining: count * 7, skipRequested: true };
      const w = new ResultInputWait({
        state,
        count,
        flushInput: () => calls.push("flush"),
        pollInput: () => {
          calls.push("read");
          return true;
        },
      });
      w.begin();
      assert.deepEqual(calls, ["flush", "read"]);
      assert.equal(state.skipRequested, false);
      for (let i = 1; i < count * 7; i++) {
        assert.equal(w.advanceTick(), false);
        assert.equal(w.inputPolls, 1 + Math.floor(i / 7));
      }
      state.skipRequested = true;
      assert.equal(w.advanceTick(), true);
      assert.equal(w.inputPolls, count);
      assert.equal(w.skipped, false);
      assert.equal(w.advanceTick(), true);
    },
  );
  test(
    phase + " defers P to its reader and resumes the same read after Pause",
    async () => {
      const { g, w, state } = await fresh({ phase });
      g.input({ type: "pause" });
      g.input({ type: "fire" });
      ticks(g, 6);
      assert.equal(g.systemOverlay, null);
      ticks(g, 1);
      assert.equal(g.systemOverlay.kind, "pause");
      assert.equal(state.remaining, count * 7 - 7);
      const before = g.tick;
      ticks(g, 35);
      assert.equal(g.tick, before + 35);
      assert.equal(state.remaining, count * 7 - 7);
      g.input({ type: "pause" });
      ticks(g, 7);
      assert.equal(g.systemOverlay, null);
      assert.equal(w.inputPolls, 2);
      assert.equal(w.waitingForInputPoll, false);
      assert.equal(state.skipRequested, false);
      ticks(g, 7);
      assert.equal(w.inputPolls, 3);
      assert.equal(state.remaining, count * 7 - 14);
    },
  );
  test(
    phase + " Quit-No uses scan priority and drops queued P/S/Fire",
    async () => {
      const { g, w, state } = await fresh({ phase });
      for (const type of ["pause", "quit", "toggle-sound", "fire"])
        g.input({ type });
      ticks(g, 7);
      assert.equal(g.systemOverlay.kind, "quit");
      g.input({ type: "quit-no" });
      assert.equal(g.systemOverlay, null);
      assert.equal(w.inputPolls, 2);
      assert.equal(state.skipRequested, false);
      assert.equal(g.pendingResultSystemKeys.size, 0);
      assert.equal(g.audioEnabled, false);
    },
  );
  test(
    phase + " emits click24 only for consumed Fire with enabled audio",
    async () => {
      for (const audio of [false, true]) {
        const { g, w, handoffs } = await fresh({ phase, audio });
        g.input({ type: "fire" });
        ticks(g, 6);
        assert.equal(w.complete, false);
        ticks(g, 1);
        assert.equal(w.skipped, true);
        assert.deepEqual(
          g.drainEffects().filter((e) => e.type === "sound"),
          audio ? [{ type: "sound", id: 0x24 }] : [],
        );
        assert.equal(handoffs.length, 1);
        assert.equal(g.money, 3400);
        assert.equal(g.campaign.day, phase === "failure" ? 4 : 3);
      }
    },
  );
  test(
    phase + " final neutral wait ignores Fire and never invents a click",
    async () => {
      const { g, w } = await fresh({ phase, audio: true });
      ticks(g, count * 7 - 1);
      g.input({ type: "fire" });
      ticks(g, 1);
      assert.equal(w.inputPolls, count);
      assert.equal(w.skipped, false);
      assert.equal(
        g.drainEffects().some((e) => e.type === "sound" && e.id === 0x24),
        false,
      );
    },
  );
}
test("ordinary award click survives the local handoff without a synthetic sound0", async () => {
  const { g, handoffs } = await fresh({ audio: true });
  g.input({ type: "fire" });
  ticks(g, 7);
  const effects = g.drainEffects();
  assert.deepEqual(
    effects.filter((e) => ["sound", "stopAudio"].includes(e.type)),
    [{ type: "sound", id: 0x24 }],
  );
  assert.deepEqual(handoffs, [{ type: "map" }]);
  assert.equal(g.campaign.locations[1].playerCollected, true);
});
test("failed atomic-location expedition spends one day without collection,unlock or cash changes", async () => {
  const { g, handoffs } = await fresh({
    phase: "failure",
    audio: true,
    atomic: true,
  });
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(g.campaign.day, 4);
  assert.equal(g.money, 3400);
  assert.equal(g.campaign.atomicAvailable, false);
  assert.equal(
    g.campaign.locations[g.campaign.location].playerCollected,
    false,
  );
  assert.deepEqual(handoffs, [{ type: "map" }]);
  assert.deepEqual(g.drainEffects(), [{ type: "sound", id: 0x24 }]);
});
test("transmitter unlock orders consumed click24 before notice54 and a fresh100-read entry", async () => {
  const { g, w } = await fresh({ audio: true, atomic: true });
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(w.skipped, true);
  assert.equal(g.campaign.atomicAvailable, true);
  assert.equal(g.expeditionResult.phase, "atomic");
  assert.equal(g.expeditionResult.remaining, 700);
  assert.equal(g.resultWait.inputPolls, 1);
  assert.equal(g.expeditionResult.skipRequested, false);
  assert.deepEqual(
    g.drainEffects().filter((e) => ["sound", "stopAudio"].includes(e.type)),
    [
      { type: "sound", id: 0x24 },
      { type: "sound", id: 0x54 },
    ],
  );
});
test("result entry flush drops old IRQ flags,controls and queued system keys", async () => {
  const { g } = await fresh();
  g.pendingResultSystemKeys.set(0x19, "pause");
  g.controls = { fire: true, direction: "right" };
  g.expeditionKeyboard.event(0x39, true);
  g.expeditionResult = {
    phase: "award",
    value: 3000,
    remaining: 280,
    skipRequested: true,
  };
  g.beginResultWait();
  assert.equal(g.systemOverlay, null);
  assert.equal(g.expeditionResult.skipRequested, false);
  assert.deepEqual(g.controls, { fire: false, direction: null });
  assert.ok([...g.expeditionKeyboard.bytes()].every((b) => b === 0));
  assert.equal(g.pendingResultSystemKeys.size, 0);
});
test("result sound toggle is consumed at a read and Restart discards a blocked controller", async () => {
  const { g } = await fresh();
  g.input({ type: "toggle-sound" });
  ticks(g, 6);
  assert.equal(g.audioEnabled, false);
  ticks(g, 1);
  assert.equal(g.audioEnabled, true);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.resultWait.waitingForInputPoll, true);
  g.input({ type: "restart" });
  assert.equal(g.resultWait, null);
  assert.equal(g.pendingResultSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.scene, "title");
});
test("result wait rejects unsupported counts,providers and lifecycle calls", () => {
  const state = { remaining: 280 };
  assert.throws(
    () =>
      new ResultInputWait({
        state,
        count: 30,
        pollInput: () => true,
        flushInput: () => {},
      }),
    /Invalid result input boundary/,
  );
  const w = new ResultInputWait({
    state,
    count: 40,
    pollInput: () => undefined,
    flushInput: () => {},
  });
  assert.throws(() => w.advanceTick(), /before entry flush/);
  assert.throws(() => w.resumeInputPoll(), /outside input reader/);
  assert.throws(() => w.begin(), /Invalid result input poll result/);
  assert.throws(() => w.begin(), /already started/);
});
test("result checks reject legacy immediate dispatch and falsely consumed final-wait Fire", async () => {
  const { g } = await fresh();
  g.handleInput({ type: "pause" }, true);
  assert.throws(() => assert.equal(g.systemOverlay, null), {
    code: "ERR_ASSERTION",
  });
  const state = { remaining: 280, skipRequested: false },
    w = new ResultInputWait({
      state,
      count: 40,
      pollInput: () => true,
      flushInput: () => {},
    });
  w.begin();
  for (let i = 0; i < 279; i++) w.advanceTick();
  state.skipRequested = true;
  w.advanceTick();
  assert.throws(() => assert.equal(w.skipped, true), { code: "ERR_ASSERTION" });
});

test("muted transmitter unlock never queues notice54 for a later sound toggle", async () => {
  const { g } = await fresh({ atomic: true });
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(g.expeditionResult.phase, "atomic");
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type === "sound"),
    [],
  );
  g.input({ type: "toggle-sound" });
  ticks(g, 7);
  assert.equal(g.audioEnabled, true);
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type === "sound"),
    [],
  );
});
test("award cue49 is requested only when audio is enabled at its original call", async () => {
  for (const audio of [false, true]) {
    const { game: g } = await originalGame();
    g.input({ type: "audio-enabled", enabled: audio });
    g.campaign.location = 1;
    g.drainEffects();
    const memory = g.marketMemory;
    memory.view.setUint32(0x97a8, 0, true);
    g.collectActionExpedition({
      memory,
      outcome: { code: 1 },
      drainEvents: () => [],
    });
    assert.equal(g.expeditionResult.phase, "award");
    const presentation = g.resultPresentation;
    assert.ok(presentation);
    assert.deepEqual(
      g.drainEffects().filter((e) => e.type === "sound"),
      [],
    );
    for (let i = 0; i < 1000 && g.resultPresentation; i++) {
      g.advanceTick();
      g.advanceRetrace();
    }
    assert.equal(g.resultPresentation, null);
    assert.equal(presentation.consumedRetraces, 75);
    assert.deepEqual(
      g.drainEffects().filter((e) => e.type === "sound"),
      audio ? [{ type: "sound", id: 0x49 }] : [],
    );
  }
});
