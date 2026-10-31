// Conditional caller integration with explicit resources/input/device replies.
// Actual startup/browser acceptance remains a separate verification level.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { Scheduler } from "../src/game/scheduler.js";
import { nextRandom } from "../src/game/integer.js";
async function setup(audio = false) {
  const { game: g } = await originalGame({ physicalKeyboard: true });
  g.securityPending = false;
  g.audioEnabled = audio;
  const clock = new Scheduler(g, 0);
  g.drainEffects();
  const until = (predicate) => {
    for (let i = 0; i < 10000; i++) {
      if (predicate()) return;
      const wake = g.nextSimulationWake();
      clock.advanceTo(
        Math.min(
          clock.tickAt,
          clock.retraceAt,
          wake === null
            ? Infinity
            : wake + clock.origin + clock.pausedMilliseconds,
        ),
      );
      assert.equal(g.diagnostic, null);
    }
    throw Error("Unfinished conditional report");
  };
  return { g, clock, until };
}
for (const reason of ["player", "rival"])
  test(`${reason} collected notice flushes early keys and exits through75 retraces`, async () => {
    const { g, until } = await setup();
    g.campaign.locations[1][
      reason === "player" ? "playerCollected" : "rivalCollected"
    ] = true;
    g.travel(1);
    const p = g.reportPresentation,
      seed = g.seed,
      day = g.campaign.day;
    for (const type of ["pause", "quit", "toggle-sound", "fire"])
      g.input({ type });
    until(() => p.phase === "reading");
    assert.equal(p.consumedRetraces, 50);
    assert.equal(g.systemOverlay, null);
    assert.equal(g.audioEnabled, false);
    assert.equal(g.pendingRivalSystemKeys.size, 0);
    assert.equal(g.visitNotice.skipRequested, false);
    g.input({ type: "fire" });
    until(() => p.phase === "exit-wipe");
    assert.equal(g.scene, "visit-notice");
    assert.equal(g.seed, seed); // Notice body,not the following market/root cleanup.
    until(() => g.reportPresentation === null);
    assert.equal(p.consumedRetraces, 75);
    assert.equal(g.scene, "map");
    assert.equal(g.seed, g.campaign.seed);
    assert.equal(g.campaign.day, day);
  });
test("forced claim defers third RNG/cue to copy and location/21 to exit", async () => {
  const { g, until } = await setup(true);
  g.scene = "flight";
  g.departure = { racing: true, from: 0, target: 32 };
  g.campaign.rival.location = 0;
  g.campaign.rival.day = 6;
  g.flight = {
    memory: g.marketMemory,
    drainEvents: () => [],
    setControls() {},
    outcome: { code: 0, day: 7, seed: 40797, money: 0 },
  };
  g.collectFlight();
  const p = g.reportPresentation,
    r = g.claim,
    afterTwo = nextRandom(nextRandom(40797)),
    afterThree = nextRandom(afterTwo);
  assert.equal(g.seed, afterTwo);
  assert.equal(r.variant, null);
  assert.equal(
    g.drainEffects().some((e) => e.id === 0x6e),
    false,
  );
  until(() => p.phase === "reveal");
  assert.equal(g.seed, afterThree);
  assert.equal(r.variant, afterThree & 1);
  assert.deepEqual(
    g
      .drainEffects()
      .filter((e) => e.type === "sound")
      .map((e) => e.id),
    [0x6e],
  );
  g.input({ type: "audio-status", token: r.token, busy: false }); // Old cue completion during reveal.
  until(() => p.phase === "reading");
  const query = g.drainEffects().find((e) => e.type === "audio-query");
  assert.ok(query && query.token !== r.token);
  assert.equal(r.waitingForAudio, true);
  g.input({ type: "audio-status", token: query.token, busy: true });
  assert.equal(r.polledBusy, true);
  assert.equal(r.phase, "speech");
  until(() => r.waitingForAudio);
  const next = g.drainEffects().find((e) => e.type === "audio-query");
  assert.ok(next && next.token !== query.token);
  g.input({ type: "audio-status", token: query.token, busy: false });
  assert.equal(
    r.waitingForAudio,
    true,
    "Stale completion cannot satisfy the fresh poll",
  );
  g.input({ type: "audio-status", token: next.token, busy: false });
  assert.equal(p.phase, "exit-wipe");
  assert.equal(g.campaign.rival.location, 0);
  assert.equal(
    g.drainEffects().some((e) => e.id === 0x21),
    false,
  );
  until(() => g.reportPresentation !== p);
  assert.equal(p.consumedRetraces, 75);
  assert.equal(g.campaign.rival.location, 32);
  assert.ok(g.drainEffects().some((e) => e.id === 0x21));
});
test("Restart cancels a report before cue,reader or exit continuation", async () => {
  const { g, until } = await setup(true);
  g.campaign.locations[1].rivalCollected = true;
  g.travel(1);
  const p = g.reportPresentation,
    token = g.visitNotice.token;
  g.input({ type: "restart" });
  assert.equal(g.reportPresentation, null);
  g.input({ type: "audio-status", token, busy: false });
  until(() => g.opening?.ready || g.scene === "title");
  assert.equal(p.consumedRetraces, 0);
  assert.equal(g.scene, "title");
});
test("ordinary rival retains its second-draw seed until helper copy and publishes location after exit", async () => {
  const { g, until } = await setup();
  g.campaign.day = 10;
  g.campaign.rivalUnlockMask = 4;
  g.seed = 56;
  const from = g.campaign.rival.location;
  g.completeCampaignAction({ type: "map" });
  const p = g.reportPresentation,
    r = g.rivalReport;
  assert.ok(r);
  assert.equal(r.variant, null);
  assert.equal(g.seed, nextRandom(nextRandom(56)));
  assert.equal(g.campaign.rival.location, from);
  until(() => p.phase === "reveal");
  assert.equal(g.seed, 29915);
  assert.equal(r.variant, 1);
  until(() => p.phase === "reading");
  g.input({ type: "fire" });
  until(() => p.phase === "exit-wipe");
  assert.equal(g.campaign.rival.location, from);
  until(() => g.reportPresentation !== p);
  assert.equal(g.campaign.rival.location, r.target);
});
