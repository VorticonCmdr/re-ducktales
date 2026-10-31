// Conditional unit setup. Real browser acceptance separately earns the transmitter.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { AtomicTransport } from "../src/game/atomic-transport.js";
async function fresh({ seed = 0x6db8, audio = false } = {}) {
  const { game: g } = await originalGame();
  g.input({ type: "audio-enabled", enabled: audio });
  g.drainEffects();
  g.scene = "atomic-transport";
  g.seed = g.campaign.seed = seed;
  g.atomicTransport = new AtomicTransport({
    from: 35,
    target: 30,
    day: 1,
    difficulty: 0,
    seed,
    locations: g.campaign.locations,
    audioEnabled: audio,
    token: "unit",
    pollInput: () => g.pollSystemInput(g.pendingAtomicSystemKeys),
    flushInput: () => g.flushAtomicInput(),
  });
  return { g, a: g.atomicTransport };
}
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
test("atomic success charge queues system keys without reading them and discards them at chapter handoff", async () => {
  const { g, a } = await fresh({ seed: 0 });
  for (const type of ["pause", "quit", "toggle-sound"]) g.input({ type });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingAtomicSystemKeys.size, 3);
  ticks(g, 6);
  assert.equal(a.phase, "charge");
  assert.equal(g.audioEnabled, false);
  ticks(g, 1);
  assert.equal(a.outcome.misdirected, false);
  assert.equal(g.scene, "expedition-briefing");
  assert.equal(g.pendingAtomicSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
  assert.equal(a.inputPolls, 0);
});
test("atomic charge and sound do not read keys; report entry clears them before its immediate first read", async () => {
  const { g, a } = await fresh({ audio: true });
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(a.phase, "sound");
  g.input({ type: "quit" });
  g.input({ type: "toggle-sound" });
  ticks(g, 20);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingAtomicSystemKeys.size, 3);
  assert.equal(g.audioEnabled, true);
  g.input({ type: "audio-status", token: "stale", busy: false });
  ticks(g, 1);
  assert.equal(a.phase, "sound");
  g.input({ type: "audio-status", token: "unit", busy: false });
  // The original busy spin returns at status consumption,not the next IRQ.
  assert.equal(a.phase, "report");
  assert.equal(a.remaining, 420);
  assert.equal(a.inputPolls, 1);
  assert.equal(g.pendingAtomicSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.audioEnabled, true);
  g.input({ type: "toggle-sound" });
  ticks(g, 6);
  assert.equal(g.audioEnabled, true);
  ticks(g, 1);
  assert.equal(g.audioEnabled, false);
  assert.equal(a.inputPolls, 2);
});
test("atomic report makes exactly sixty reads before seven-tick waits, without a final extra read", async () => {
  const { g, a } = await fresh();
  ticks(g, 7);
  assert.equal(a.inputPolls, 1);
  for (let i = 1; i <= 419; i++) {
    ticks(g, 1);
    assert.equal(a.inputPolls, 1 + Math.floor(i / 7));
  }
  assert.equal(a.inputPolls, 60);
  assert.equal(a.remaining, 1);
  ticks(g, 1);
  assert.equal(a.phase, "complete");
  assert.equal(a.inputPolls, 60);
});
test("atomic report does not consume Fire or play its optional click during the last neutral wait", async () => {
  const { g, a } = await fresh({ audio: true });
  ticks(g, 7);
  g.input({ type: "audio-status", token: "unit", busy: false });
  g.drainEffects();
  ticks(g, 419);
  assert.equal(a.remaining, 1);
  g.input({ type: "fire" });
  ticks(g, 1);
  assert.equal(a.phase, "complete");
  assert.equal(a.inputPolls, 60);
  assert.equal(
    g.drainEffects().some((e) => e.type === "sound" && e.id === 0x24),
    false,
  );
});
test("atomic Pause suspends only its reader; resume flushes Fire and starts a fresh seven-tick interval", async () => {
  const { g, a } = await fresh();
  ticks(g, 7);
  g.input({ type: "pause" });
  g.input({ type: "fire" });
  assert.equal(g.systemOverlay, null);
  ticks(g, 6);
  assert.equal(g.systemOverlay, null);
  ticks(g, 1);
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(a.waitingForInputPoll, true);
  assert.equal(a.remaining, 413);
  assert.equal(a.inputPolls, 1);
  const before = g.tick;
  ticks(g, 35);
  assert.equal(g.tick, before + 35);
  assert.equal(a.remaining, 413);
  assert.equal(a.inputPolls, 1);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.systemOverlay, null);
  assert.equal(a.waitingForInputPoll, false);
  assert.equal(a.skipRequested, false);
  assert.equal(a.inputPolls, 2);
  assert.equal(a.remaining, 413);
  ticks(g, 7);
  assert.equal(a.inputPolls, 3);
  assert.equal(a.remaining, 406);
  assert.equal(a.outcome, null);
});
test("atomic Quit-No resumes the same report poll and discards queued Pause and Fire", async () => {
  const { g, a } = await fresh();
  ticks(g, 7);
  g.input({ type: "pause" });
  g.input({ type: "quit" });
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(g.systemOverlay.kind, "quit");
  assert.equal(a.waitingForInputPoll, true);
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(a.waitingForInputPoll, false);
  assert.equal(a.skipRequested, false);
  assert.equal(a.inputPolls, 2);
  assert.equal(a.outcome, null);
  assert.equal(g.pendingAtomicSystemKeys.size, 0);
});
test("atomic Restart clears pending keys and the blocked reader", async () => {
  const { g, a } = await fresh();
  ticks(g, 7);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(a.waitingForInputPoll, true);
  g.input({ type: "restart" });
  assert.equal(g.scene, "title");
  assert.equal(g.atomicTransport, null);
  assert.equal(g.pendingAtomicSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.campaign.atomicAvailable, false);
});
test("atomic input providers reject invalid results and resumption outside a reader", async () => {
  const { g } = await fresh();
  const a = new AtomicTransport({
    from: 35,
    target: 30,
    day: 1,
    difficulty: 0,
    seed: 0x6db8,
    locations: g.campaign.locations,
    pollInput: () => undefined,
  });
  assert.throws(() => a.resumeInputPoll(), /outside input reader/);
  assert.throws(() => ticks(a, 7), /Invalid atomic input poll/);
  assert.throws(
    () =>
      new AtomicTransport({
        from: 35,
        target: 30,
        day: 1,
        difficulty: 0,
        seed: 0,
        locations: g.campaign.locations,
        pollInput: 0,
      }),
    /Invalid atomic input boundary/,
  );
});

test("charge checker rejects legacy immediate system-key dispatch", async () => {
  const { g } = await fresh({ seed: 0 });
  // Deliberately bypass the queue to reproduce the observed pre-fix behavior.
  g.handleInput({ type: "pause" }, true);
  assert.throws(
    () =>
      assert.equal(
        g.systemOverlay,
        null,
        "Atomic charge must not be interrupted",
      ),
    /Atomic charge must not be interrupted/,
  );
});
test("report-entry checker rejects an omitted native input flush", async () => {
  const { g, a } = await fresh();
  a.onFlushInput = () => {};
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.throws(
    () =>
      assert.equal(
        g.systemOverlay,
        null,
        "Atomic entry keys must be discarded",
      ),
    /Atomic entry keys must be discarded/,
  );
});
