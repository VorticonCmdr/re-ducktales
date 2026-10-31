import assert from "node:assert/strict";
import { Scheduler } from "../../src/game/scheduler.js";
export const destinationFixtureClocks = new WeakMap();

// Unit-fixture clock provider:independent scheduler driver/retrace boundaries.
// Tests here exercise campaign continuation, not native wall-clock alignment.
function advance(game, done) {
  let steps = 0;
  let clock = destinationFixtureClocks.get(game);
  if (!clock) {
    clock = new Scheduler(game);
    destinationFixtureClocks.set(game, clock);
  }
  while (!done() && steps++ < 1000) {
    const wake = game.nextSimulationWake();
    clock.advanceTo(
      Math.min(
        clock.tickAt,
        clock.retraceAt,
        wake === null
          ? Infinity
          : wake + clock.origin + clock.pausedMilliseconds,
      ),
    );
    assert.equal(game.diagnostic, null);
  }
  assert.ok(done(), "Unfinished destination fixture");
  return steps;
}
export const advanceFixtureUntil = advance;
export function destinationReady(game) {
  assert.equal(game.scene, "map");
  assert.ok(game.campaign.destinationWaits, "Destination must enter naturally");
  advance(game, () => game.campaign.destinationWaits?.ready);
}
export function confirmDestination(game) {
  const waits = game.campaign.destinationWaits;
  assert.ok(waits?.ready, "Confirmation requires a ready destination");
  game.input({ type: "fire" });
  finishDestination(game);
}
export function finishDestination(game) {
  const waits = game.campaign.destinationWaits;
  assert.ok(waits.confirming);
  assert.ok(advance(game, () => game.campaign.destinationWaits === null) > 0);
  assert.ok(waits.outcome, "Confirmation wait must finish before continuation");
}
