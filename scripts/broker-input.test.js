// Conditional caller boundaries. Cash1000 is injected here;the browser scenario
// earns it independently. Rules come from overlay10:02b8 and shared09f5.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { ResultInputWait } from "../src/game/result-input-wait.js";
import { InvestmentScreen } from "../src/game/investment-screen.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function fixture({ audio = false, hold = false } = {}) {
  const { game: g } = await originalGame();
  g.securityPending = false;
  g.audioEnabled = audio;
  g.money = 1000;
  g.finishCampaignAction({ type: "investments" });
  for (const type of [
    "fire",
    "right",
    "fire",
    "left",
    "fire",
    "down",
    "down",
    "down",
    "down",
    "down",
  ])
    g.input({ type });
  const n = g.investments;
  assert.equal(n.selected, 15);
  assert.equal(n.memory.i(0x92d4 + 10 * 46), 1);
  g.drainEffects();
  if (hold) g.input({ type: "controls", fire: true, direction: null });
  g.input({ type: "fire" });
  assert.equal(n.phase, "broker");
  return { g, n };
}
test("broker50 has entry flush,immediate read,and no51st read", () => {
  const state = { remaining: 350, skipRequested: true };
  let reads = 0,
    flushes = 0;
  const w = new ResultInputWait({
    state,
    count: 50,
    pollInput: () => {
      reads++;
      return true;
    },
    flushInput: () => flushes++,
  });
  w.begin();
  assert.equal(flushes, 1);
  assert.equal(reads, 1);
  assert.equal(state.skipRequested, false);
  for (let i = 1; i < 350; i++) {
    assert.equal(w.advanceTick(), false);
    assert.equal(reads, 1 + Math.floor(i / 7));
  }
  state.skipRequested = true;
  assert.equal(w.advanceTick(), true);
  assert.equal(reads, 50);
  assert.equal(w.skipped, false);
});
test("portfolio exit Fire is flushed and held controls cannot shorten broker", async () => {
  const { g, n } = await fixture({ hold: true });
  assert.equal(g.controls.fire, false);
  assert.equal(n.skipRequested, false);
  assert.equal(n.wait.inputPolls, 1);
  assert.equal(n.remaining, 350);
  ticks(g, 7);
  assert.equal(n.complete, false);
  assert.equal(n.remaining, 343);
  assert.ok(g.drainEffects().some((e) => e.type === "flushControls"));
});
test("broker Pause waits seven ticks and resumes the suspended read", async () => {
  const { g, n } = await fixture();
  g.input({ type: "pause" });
  ticks(g, 6);
  assert.equal(g.systemOverlay, null);
  ticks(g, 1);
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(n.wait.waitingForInputPoll, true);
  ticks(g, 100);
  assert.equal(n.remaining, 343);
  g.input({ type: "fire" });
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.systemOverlay, null);
  assert.equal(n.skipRequested, false);
  assert.equal(n.wait.inputPolls, 2);
  assert.equal(n.remaining, 343);
  assert.equal(n.complete, false);
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(g.scene, "office");
});
test("broker Quit-No discards queued Pause,S and old Fire", async () => {
  const { g, n } = await fixture({ audio: true });
  for (const type of ["toggle-sound", "pause", "quit", "fire"])
    g.input({ type });
  ticks(g, 7);
  assert.equal(g.systemOverlay.kind, "quit");
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.audioEnabled, true);
  assert.equal(n.complete, false);
  assert.equal(n.skipRequested, false);
  assert.equal(g.pendingInvestmentSystemKeys.size, 0);
  ticks(g, 7);
  assert.equal(g.scene, "investments");
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(g.scene, "office");
});
test("broker Quit-Yes enters credits without collecting the confirmation", async () => {
  const { g, n } = await fixture();
  g.input({ type: "quit" });
  ticks(g, 7);
  g.input({ type: "quit-yes" });
  assert.equal(g.scene, "ending");
  assert.equal(g.ending.phase, "credits");
  assert.equal(n.complete, false);
  assert.equal(g.money, 978);
  assert.equal(g.campaign.day, 1);
});
for (const audio of [false, true])
  test("broker Fire conditional click audio=" + audio, async () => {
    const { g } = await fixture({ audio });
    g.drainEffects();
    g.input({ type: "fire" });
    ticks(g, 6);
    assert.equal(g.scene, "investments");
    ticks(g, 1);
    assert.equal(g.scene, "office");
    const effects = g.drainEffects();
    assert.deepEqual(
      effects.filter((e) => e.type === "sound").map((e) => e.id),
      audio ? [0x24, 0] : [], // broker24,then original office entry0
    );
    assert.equal(
      effects.some((e) => e.type === "stopAudio"),
      false,
    );
  });
test("broker timeout preserves cash,calendar,coin latch,shares and makes no click", async () => {
  const { g, n } = await fixture({ audio: true });
  g.rareCoinTaken = true;
  const seed = g.seed;
  g.drainEffects();
  ticks(g, 349);
  assert.equal(g.scene, "investments");
  ticks(g, 1);
  assert.equal(g.scene, "office");
  assert.equal(n.wait.inputPolls, 50);
  assert.equal(n.wait.skipped, false);
  assert.equal(g.money, 978);
  assert.equal(g.campaign.day, 1);
  assert.equal(g.rareCoinTaken, true);
  assert.equal(g.marketMemory.i(0x92d4 + 10 * 46), 1);
  assert.equal(g.seed, seed);
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type === "sound"),
    [{ type: "sound", id: 0 }],
    "Only the original office entry0 follows timeout",
  );
});
test("broker consumed S-off suppresses the confirmation click", async () => {
  const { g } = await fixture({ audio: true });
  g.drainEffects();
  g.input({ type: "toggle-sound" });
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(g.scene, "office");
  assert.equal(g.audioEnabled, false);
  const effects = g.drainEffects();
  assert.deepEqual(
    effects.filter((e) => e.type === "sound-batch"),
    [{ type: "sound-batch", arguments: [0, 0x24] }],
  );
  assert.deepEqual(
    effects.filter((e) => e.type === "sound"),
    [],
  );
});
test("Restart clears the pending broker reader and keys", async () => {
  const { g, n } = await fixture();
  g.input({ type: "pause" });
  assert.equal(g.pendingInvestmentSystemKeys.size, 1);
  g.input({ type: "restart" });
  assert.equal(g.investments, null);
  assert.equal(g.pendingInvestmentSystemKeys.size, 0);
  assert.equal(n.complete, false);
  assert.equal(g.money, 0);
});
test("unread final-wait P reaches the first office reader without an extra broker read", async () => {
  const { g, n } = await fixture();
  ticks(g, 344); // read50 was at343;the remaining final wait has no reader.
  g.input({ type: "pause" });
  ticks(g, 6);
  assert.equal(g.scene, "office");
  assert.equal(g.systemOverlay, null);
  assert.equal(n.wait.inputPolls, 50);
  assert.equal(n.wait.skipped, false);
  assert.equal(g.pendingOfficeSystemKeys.size, 1);
  for (let i = 0; i < 50; i++) g.officeMenu.advanceRetrace();
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(g.pendingOfficeSystemKeys.size, 0);
  assert.equal(g.money, 978);
  assert.equal(g.marketMemory.i(0x92d4 + 10 * 46), 1);
});
test("failed trading exit has no broker wait and invalid reader operations fail", async () => {
  const { game: g } = await originalGame();
  g.securityPending = false;
  g.finishCampaignAction({ type: "investments" });
  const n = g.investments;
  n.input({ type: "fire" });
  n.input({ type: "right" });
  n.input({ type: "fire" });
  assert.equal(n.message, 1); // insufficient cash
  n.input({ type: "back" });
  n.input({ type: "back" });
  assert.equal(n.complete, true);
  assert.equal(n.wait, null);
  assert.throws(() => n.flushInput(), /outside broker/);
  assert.throws(() => n.resumeInputPoll(), /outside broker/);
  assert.throws(
    () =>
      new InvestmentScreen(g.marketMemory, g.investmentResources, {
        pollInput: null,
      }),
    /environment/,
  );
});
