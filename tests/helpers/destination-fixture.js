import assert from "node:assert/strict";

// Unit-fixture clock provider: one driver tick then one retrace per step.
// Tests here exercise campaign continuation, not native wall-clock alignment.
function advance(game, done) {
  let steps = 0;
  while (!done() && steps++ < 200) {
    game.advanceTick();
    game.advanceRetrace();
    assert.equal(game.diagnostic, null);
  }
  assert.ok(done(), "Unfinished destination fixture");
  return steps;
}
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
