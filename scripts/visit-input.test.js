// Conditional caller boundaries derived from192 checked original bytes.
// These are not original runtime captures or browser acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { CampaignVisitNotice } from "../src/game/campaign-visit.js";
const ticks = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
async function fixture(reason, audio = false) {
  const { game: g } = await originalGame();
  g.securityPending = false;
  g.audioEnabled = audio;
  g.campaign.locations[1][
    reason === "player" ? "playerCollected" : "rivalCollected"
  ] = true;
  g.drainEffects();
  g.travel(1);
  return { g, n: g.visitNotice };
}
for (const [reason, count] of [
  ["player", 80],
  ["rival", 40],
]) {
  test(
    reason +
      " flushes once per shared entry and reads exactly" +
      count +
      " times",
    () => {
      let polls = 0,
        flushes = 0;
      const n = new CampaignVisitNotice({
        reason,
        target: 1,
        pollInput: () => {
          polls++;
          return true;
        },
        flushInput: () => flushes++,
      });
      n.skipRequested = true;
      n.begin();
      assert.equal(flushes, reason === "player" ? 1 : 2);
      assert.equal(n.skipRequested, false);
      assert.equal(polls, 1);
      for (let i = 1; i < count * 7; i++) {
        assert.equal(n.advanceTick(), false);
        assert.equal(polls, 1 + Math.floor(i / 7));
      }
      n.skipRequested = true;
      assert.equal(n.advanceTick(), true);
      assert.equal(polls, count, "No extra terminal read");
      assert.equal(n.skipped, false);
    },
  );
  test(reason + " Pause is polled and resumes the suspended read", async () => {
    const { g, n } = await fixture(reason);
    g.input({ type: "pause" });
    ticks(g, 6);
    assert.equal(g.systemOverlay, null);
    ticks(g, 1);
    assert.equal(g.systemOverlay.kind, "pause");
    assert.equal(n.waitingForInputPoll, true);
    assert.equal(n.remaining, count * 7 - 7);
    ticks(g, 100);
    assert.equal(n.remaining, count * 7 - 7);
    g.input({ type: "fire" });
    g.input({ type: "pause" });
    ticks(g, 7);
    assert.equal(g.systemOverlay, null);
    assert.equal(n.waitingForInputPoll, false);
    assert.equal(n.skipRequested, false);
    assert.equal(n.complete, false);
    g.input({ type: "fire" });
    ticks(g, 7);
    assert.equal(g.scene, "map");
  });
  test(
    reason + " fallback Fire requests only the original conditional words",
    async () => {
      const { g, n } = await fixture(reason, true);
      if (reason === "rival")
        g.input({ type: "audio-status", token: n.token, busy: false });
      g.drainEffects();
      g.input({ type: "fire" });
      ticks(g, 7);
      assert.equal(g.scene, "map");
      const effects = g.drainEffects();
      assert.equal(
        effects.some((e) => e.type === "stopAudio"),
        false,
      );
      assert.deepEqual(
        effects.filter((e) => e.type === "sound").map((e) => e.id),
        reason === "player" ? [0x24] : [0x24, 0],
      );
    },
  );
}
test("rival waits for actual status, then reads every seven ticks and resumes before querying again", async () => {
  const { g, n } = await fixture("rival", true);
  assert.equal(n.waitingForAudio, true);
  g.input({ type: "pause" });
  ticks(g, 30);
  assert.equal(g.systemOverlay, null);
  g.input({ type: "audio-status", token: n.token, busy: true });
  assert.equal(g.systemOverlay.kind, "pause");
  assert.equal(n.waitingForSpeechInput, true);
  g.input({ type: "audio-status", token: n.token, busy: false });
  ticks(g, 35);
  g.input({ type: "pause" });
  ticks(g, 7);
  assert.equal(g.systemOverlay, null);
  assert.equal(n.phase, "speech");
  assert.equal(n.pollRemaining, 7);
  ticks(g, 6);
  assert.equal(g.scene, "visit-notice");
  ticks(g, 1);
  assert.equal(g.scene, "map");
});
test("muted rival notices query an existing device and do not fabricate idle on mute", async () => {
  const { game: g } = await originalGame();
  g.securityPending = false;
  g.hasAudioDevice = () => true;
  g.campaign.locations[1].rivalCollected = true;
  g.drainEffects();
  g.travel(1);
  const n = g.visitNotice;
  assert.ok(
    g
      .drainEffects()
      .some((e) => e.type === "audio-query" && e.token === n.token),
  );
  g.input({ type: "audio-status", token: n.token, busy: true });
  g.input({ type: "audio-enabled", enabled: false });
  ticks(g, 28);
  assert.equal(n.busy, true);
  assert.equal(n.complete, false);
  g.input({ type: "audio-status", token: n.token, busy: false });
  ticks(g, 7);
  assert.equal(g.scene, "map");
});
