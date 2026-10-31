// Conditional simulation checks. Real startup/browser and device I/O are separate.
import test from "node:test";
import assert from "node:assert/strict";
import { RivalReport } from "../src/game/rival.js";
import { originalGame } from "../tests/helpers/original-game.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function forced(audio = false) {
  const { game: g } = await originalGame();
  // Conditional caller boundary,not a machine checkpoint or independent replay.
  g.scene = "flight";
  g.securityPending = false; // This conditional boundary follows office security.
  g.input({ type: "audio-enabled", enabled: audio });
  g.departure = { racing: true, from: 0, target: 32 };
  g.campaign.rival.location = 0;
  g.campaign.rival.day = 6;
  g.flight = {
    memory: g.marketMemory,
    drainEvents: () => [],
    setControls: () => {},
    outcome: { code: 0, day: 7, seed: 40797, money: 0 },
  };
  g.drainEffects();
  g.collectFlight();
  return { g, r: g.claim };
}
test("muted report flushes twice and reads exactly40 times without a final extra read", () => {
  let flushes = 0,
    reads = 0;
  const r = new RivalReport({
    target: 32,
    variant: 0,
    pollInput: () => {
      reads++;
      return true;
    },
    flushInput: () => flushes++,
  });
  r.begin();
  assert.equal(flushes, 2);
  assert.equal(reads, 1);
  for (let i = 0; i < 279; i++) assert.equal(r.advanceTick(), false);
  assert.equal(reads, 40);
  r.skipRequested = true;
  assert.equal(r.advanceTick(), true);
  assert.equal(reads, 40);
  assert.equal(r.skipped, false);
});
test("enabled report requires actual initial status instead of assuming playback busy", () => {
  const r = new RivalReport({
    target: 32,
    variant: 0,
    token: "r:1",
    audioEnabled: true,
  });
  r.begin();
  for (let i = 0; i < 100; i++) r.advanceTick();
  assert.equal(r.waitingForAudio, true);
  assert.equal(r.polledBusy, false);
  assert.equal(r.remaining, 280);
  assert.equal(r.complete, false);
  r.setAudioStatus("old", false);
  assert.equal(r.statusKnown, false);
  r.setAudioStatus("r:1", false);
  r.resumeAudioStatus();
  assert.equal(r.phase, "dialogue");
  assert.equal(r.wait.inputPolls, 1);
  assert.equal(r.advanceTick(), false);
  assert.equal(r.remaining, 279);
});
test("busy speech polls on14-tick boundaries and bypasses fallback when playback ends", () => {
  const r = new RivalReport({
    target: 32,
    variant: 0,
    token: "r:1",
    audioEnabled: true,
  });
  r.begin();
  r.setAudioStatus("r:1", true);
  r.resumeAudioStatus();
  assert.equal(r.polledBusy, true);
  assert.equal(r.pollRemaining, 14);
  r.setAudioStatus("r:1", false);
  for (let i = 0; i < 13; i++) assert.equal(r.advanceTick(), false);
  assert.equal(r.advanceTick(), true);
  assert.equal(r.wait, null);
  assert.equal(r.skipped, false);
});
test("raw Fire during busy speech exits without the shared-reader click", () => {
  const r = new RivalReport({
    target: 32,
    variant: 0,
    token: "r:1",
    audioEnabled: true,
  });
  r.begin();
  r.setAudioStatus("r:1", true);
  r.resumeAudioStatus();
  r.skipRequested = true;
  for (let i = 0; i < 13; i++) assert.equal(r.advanceTick(), false);
  assert.equal(r.advanceTick(), true);
  assert.equal(r.skipped, false);
  assert.equal(r.wait, null);
});
test("forced claim retains origin until report completion and emits no synthetic reset", async () => {
  const { g, r } = await forced(true);
  assert.equal(g.campaign.rival.location, 0);
  assert.equal(g.campaign.locations[32].rivalCollected, true);
  assert.deepEqual(
    g.drainEffects().filter((e) => ["sound", "stopAudio"].includes(e.type)),
    [{ type: "sound", id: 0x6e, token: r.token }],
  );
  g.input({ type: "audio-status", token: r.token, busy: true });
  g.input({ type: "fire" });
  ticks(g, 13);
  assert.equal(g.scene, "rival-claim");
  assert.equal(g.campaign.rival.location, 0);
  ticks(g, 1);
  assert.equal(g.scene, "map");
  assert.equal(g.campaign.rival.location, 32);
  assert.equal(g.campaign.location, 32);
  assert.equal(g.claim, null);
  assert.deepEqual(
    g.drainEffects().filter((e) => ["sound", "stopAudio"].includes(e.type)),
    [{ type: "sound", id: 0x21 }],
  );
});
test("claim Pause waits for a reader and resumes with old Fire discarded", async () => {
  const { g, r } = await forced();
  g.input({ type: "pause" });
  g.input({ type: "fire" });
  ticks(g, 6);
  assert.equal(g.systemOverlay, null);
  ticks(g, 1);
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(r.remaining, 273);
  ticks(g, 35);
  assert.equal(r.remaining, 273);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.systemOverlay, null);
  assert.equal(r.waitingForInputPoll, false);
  assert.equal(r.skipRequested, false);
  assert.equal(r.remaining, 273);
});
test("claim Quit-No drops P/S/Fire queued at the same reader", async () => {
  const { g, r } = await forced();
  for (const type of ["pause", "quit", "toggle-sound", "fire"])
    g.input({ type });
  ticks(g, 7);
  assert.equal(g.systemOverlay.kind, "quit");
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingRivalSystemKeys.size, 0);
  assert.equal(r.skipRequested, false);
  assert.equal(g.audioEnabled, false);
  ticks(g, 7);
  assert.equal(g.scene, "rival-claim");
});
test("speech Pause resumes its pending keyboard read even if sound ended inside the modal", async () => {
  const { g, r } = await forced(true);
  g.drainEffects();
  g.input({ type: "pause" }); // Queued before the first actual sound-status ACK.
  g.input({ type: "audio-status", token: r.token, busy: true });
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(r.waitingForInputPoll, true);
  assert.equal(r.polledBusy, false);
  g.input({ type: "audio-status", token: r.token, busy: false });
  ticks(g, 35);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.systemOverlay, null);
  assert.equal(r.phase, "speech");
  assert.equal(r.pollRemaining, 14);
  assert.equal(r.remaining, 280);
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type === "sound"),
    [{ type: "sound", id: 0x24 }],
  ); // Pause's own resume click.
  ticks(g, 13);
  assert.equal(g.scene, "rival-claim");
  ticks(g, 1);
  assert.equal(g.scene, "map");
  assert.equal(r.wait, null);
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type === "sound"),
    [{ type: "sound", id: 0x21 }],
  );
});
test("busy speech reads Quit-No at14 and drops the old Fire without a fallback click", async () => {
  const { g, r } = await forced(true);
  g.drainEffects();
  g.input({ type: "audio-status", token: r.token, busy: true });
  g.input({ type: "quit" });
  g.input({ type: "fire" });
  ticks(g, 13);
  assert.equal(g.systemOverlay, null);
  ticks(g, 1);
  assert.equal(g.systemOverlay.kind, "quit");
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(r.pollRemaining, 14);
  assert.equal(r.skipRequested, false);
  assert.equal(r.skipped, false);
  g.input({ type: "audio-status", token: r.token, busy: false });
  ticks(g, 14);
  assert.equal(g.scene, "map");
  assert.equal(r.wait, null);
  assert.deepEqual(
    g.drainEffects().filter((e) => e.type === "sound"),
    [{ type: "sound", id: 0x21 }],
  );
});
test("speech reads Sound on its14-tick boundary and still bypasses the fallback", async () => {
  const { g, r } = await forced(true);
  g.drainEffects();
  g.input({ type: "audio-status", token: r.token, busy: true });
  g.input({ type: "toggle-sound" });
  ticks(g, 13);
  assert.equal(g.audioEnabled, true);
  ticks(g, 1);
  assert.equal(g.audioEnabled, false);
  assert.equal(r.pollRemaining, 14);
  assert.equal(r.remaining, 280);
  ticks(g, 14);
  assert.equal(g.scene, "rival-claim");
  //03be gates requests;the stop/click device still supplies actual completion.
  g.input({ type: "audio-status", token: r.token, busy: false });
  ticks(g, 14);
  assert.equal(g.scene, "map");
  assert.equal(r.wait, null);
});
test("muted entry never retroactively starts6e;fallback Fire orders24 then21", async () => {
  const { g, r } = await forced();
  g.drainEffects();
  g.input({ type: "toggle-sound" });
  ticks(g, 7);
  assert.equal(g.audioEnabled, true);
  assert.equal(
    g.drainEffects().some((e) => e.type === "sound" && e.id === 0x6e),
    false,
  );
  g.input({ type: "fire" });
  ticks(g, 7);
  assert.equal(r.skipped, true);
  assert.deepEqual(
    g.drainEffects().filter((e) => ["sound", "stopAudio"].includes(e.type)),
    [
      { type: "sound", id: 0x24 },
      { type: "sound", id: 0x21 },
    ],
  );
});
test("Restart discards pending claim tokens and input readers", async () => {
  const { g, r } = await forced(true);
  g.input({ type: "restart" });
  g.input({ type: "audio-status", token: r.token, busy: false });
  assert.equal(g.claim, null);
  assert.equal(g.rivalReport, null);
  assert.equal(g.pendingRivalSystemKeys.size, 0);
  assert.equal(g.scene, "title");
});
test("rival input rejects invalid status and out-of-boundary resumes", () => {
  const r = new RivalReport({ target: 1, variant: 0, token: "r" });
  assert.throws(() => r.resumeInputPoll(), /outside input/);
  assert.throws(() => r.resumeAudioStatus(), /outside status/);
  assert.throws(() => r.setAudioStatus("r", 1), /Invalid rival audio status/);
  r.begin();
  assert.throws(() => r.begin(), /already started/);
});
