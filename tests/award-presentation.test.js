// Conditional resident award-entry contract; browser verification earns entry.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { Scheduler } from "../src/game/scheduler.js";
import { AwardPresentation } from "../src/game/award-presentation.js";
const { game: original } = await originalGame();
async function setup({ audio = false, money = 400, value = 3000 } = {}) {
  const { game: g } = await originalGame();
  const seen = [],
    scheduler = new Scheduler(g, 0, {
      present: () => {
        if (g.resultPresentation) seen.push(g.resultPresentation.snapshot());
      },
    });
  g.audioEnabled = audio;
  g.money = money;
  g.scene = "expedition-result";
  g.campaign.location = 24;
  g.expeditionResult = {
    phase: "award",
    value,
    remaining: 280,
    skipRequested: false,
  };
  g.drainEffects();
  g.beginAwardPresentation(value);
  const p = g.resultPresentation;
  const until = (predicate) => {
    for (let i = 0; i < 5000; i++) {
      if (predicate()) return;
      const wake = g.nextSimulationWake();
      scheduler.advanceTo(
        Math.min(
          scheduler.tickAt,
          scheduler.retraceAt,
          wake === null
            ? Infinity
            : wake + scheduler.origin + scheduler.pausedMilliseconds,
        ),
      );
    }
    throw Error("Unfinished conditional award");
  };
  return { g, p, scheduler, seen, until };
}
test("award consumes75 retraces before sound/reader;cash commits after initial copy", async () => {
  const { g, p, seen, until } = await setup({
    audio: true,
    money: 0xfffffff0,
    value: 32,
  });
  const seed = g.seed;
  until(() => p.phase === "copying-portrait");
  assert.equal(p.consumedRetraces, 25);
  assert.equal(g.money, 0xfffffff0);
  assert.equal(g.resultWait, null);
  assert.equal(
    g.drainEffects().some((e) => e.type === "sound"),
    false,
  );
  until(() => p.phase === "wipe");
  assert.equal(g.money, 16);
  until(() => p.phase === "reveal");
  assert.equal(p.consumedRetraces, 50);
  assert.equal(g.resultWait, null);
  assert.equal(
    g.drainEffects().some((e) => e.type === "sound"),
    false,
  );
  until(() => g.resultWait !== null);
  assert.equal(p.consumedRetraces, 75);
  assert.equal(p.complete, true);
  assert.equal(g.resultWait.inputPolls, 1);
  assert.equal(g.resultWait.state.remaining, 280);
  assert.deepEqual(
    g
      .drainEffects()
      .filter((e) => e.type === "sound")
      .map((e) => e.id),
    [0x49],
  );
  assert.equal(g.seed, seed);
  assert.equal(g.money, 16);
  for (const phase of ["initial-wipe", "wipe", "reveal"])
    assert.deepEqual(
      [
        ...new Set(
          seen.filter((s) => s.phase === phase).map((s) => s.transition.band),
        ),
      ],
      [0, 1, 2, 3, 4],
    );
  assert.equal(seen.at(-1).phase, "publishing");
});
test("both source flushes drop early system keys and Fire,with no animation readers", async () => {
  const { g, p, until } = await setup();
  for (const phase of ["initial-wipe", "wipe"]) {
    until(() => p.phase === phase);
    for (const type of ["pause", "quit", "toggle-sound", "fire"])
      g.input({ type });
    assert.equal(g.pendingResultSystemKeys.size, 3);
    assert.equal(g.systemOverlay, null);
    assert.equal(g.audioEnabled, false);
  }
  until(() => g.resultWait !== null);
  assert.equal(g.pendingResultSystemKeys.size, 0);
  assert.equal(g.resultWait.complete, false);
  assert.equal(g.expeditionResult.skipRequested, false);
  const wait = g.resultWait;
  g.input({ type: "fire" });
  until(() => wait.complete);
  assert.equal(wait.skipped, true);
  assert.equal(wait.inputPolls, 2);
});
test("audio enabled flag is consumed after reveal,not at award entry", async () => {
  for (const initial of [false, true]) {
    const { g, p, until } = await setup({ audio: initial });
    until(() => p.phase === "reveal");
    g.input({ type: "audio-enabled", enabled: !initial });
    g.drainEffects();
    until(() => g.resultWait !== null);
    assert.equal(
      g.drainEffects().some((e) => e.type === "sound" && e.id === 0x49),
      !initial,
    );
  }
});
test("presentation is invariant to scheduler catch-up and hidden-page pauses", async () => {
  const a = await setup(),
    b = await setup();
  for (let t = 1; t <= 1400; t++) a.scheduler.advanceTo(t);
  b.scheduler.advanceTo(1400);
  assert.deepEqual(a.g.snapshot(), b.g.snapshot());
  const c = await setup();
  c.scheduler.advanceTo(20);
  const before = c.p.snapshot();
  c.scheduler.pauseDuration(10000);
  assert.deepEqual(c.p.snapshot(), before);
  c.scheduler.advanceTo(11400);
  assert.deepEqual(c.g.snapshot(), a.g.snapshot());
});
test("Restart at final publication cancels same-time award cue and reader", async () => {
  const { g, p, scheduler, until } = await setup({ audio: true });
  until(() => p.phase === "reveal" && p.consumedRetraces === 74);
  scheduler.enqueue({ type: "restart" }, scheduler.retraceAt);
  scheduler.advanceTo(scheduler.retraceAt);
  assert.equal(g.scene, "title");
  assert.equal(g.resultPresentation, null);
  assert.equal(g.resultWait, null);
  assert.equal(p.complete, false);
  assert.equal(g.money, 0);
  assert.equal(
    g.drainEffects().some((e) => e.type === "sound" && e.id === 0x49),
    false,
  );
});
test("missing resources,invalid clocks and early continuations stop explicitly", () => {
  assert.throws(
    () =>
      new AwardPresentation({ flushInput: () => {}, commitReward: () => {} }),
    /portrait/,
  );
  let now = 0;
  const p = new AwardPresentation({
    entries: original.departureEntries,
    clock: () => now,
    flushInput: () => {},
    commitReward: () => {},
  });
  assert.throws(() => p.advanceGraphics(), /work boundary/);
  now = -1;
  assert.throws(() => p.time(), /clock/);
});
