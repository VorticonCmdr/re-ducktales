import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArchive } from "../src/assets.js";
import { parseLocations } from "../src/game/campaign.js";
import { Game } from "../src/game/application.js";
import { CampaignVisitNotice } from "../src/game/campaign-visit.js";
import { nextRandom } from "../src/game/integer.js";
import {
  reportResources,
  advanceReportUntil,
  finishReport,
} from "./helpers/report-fixture.js";
const locations = parseLocations(parseArchive(readFileSync("game/LOC.ARC")));
const clues = parseArchive(readFileSync("game/CLUES.ARC"));

test("collected-location dispatch precedes travel, clears only the coin latch and returns to the origin map", () => {
  for (const reason of ["player", "rival"])
    for (const origin of [1, 35]) {
      const g = new Game({ locations, expeditionResources: reportResources });
      g.campaign.location = origin;
      g.campaign.day = 12;
      g.money = 1234;
      g.rareCoinTaken = true;
      g.campaign.locations[1][
        reason === "player" ? "playerCollected" : "rivalCollected"
      ] = true;
      // A player claim takes priority if both flags are present.
      if (reason === "player") g.campaign.locations[1].rivalCollected = true;
      const seed = g.seed;
      g.travel(1);
      assert.equal(g.scene, "visit-notice");
      assert.equal(g.visitNotice.reason, reason);
      assert.equal(g.departure, null);
      assert.equal(g.flight, null);
      assert.equal(g.rareCoinTaken, false);
      assert.deepEqual(
        [g.seed, g.campaign.day, g.money, g.campaign.location],
        [seed, 12, 1234, origin],
      );
      advanceReportUntil(g, () => g.reportPresentation.phase === "reading");
      g.advanceTick();
      g.input({ type: "fire" });
      for (let i = 0; i < 5; i++) g.advanceTick();
      assert.equal(
        g.scene,
        "visit-notice",
        "notice skipped before its seven-tick poll",
      );
      g.advanceTick();
      assert.equal(g.reportPresentation.phase, "exit-wipe");
      finishReport(g);
      assert.equal(g.scene, "map");
      assert.deepEqual(
        [g.seed, g.campaign.day, g.money, g.campaign.location],
        [seed, 12, 1234, origin],
      );
      assert.equal(g.campaign.info, false);
      assert.equal(g.visitNotice, null);
    }
});

test("failed same-location retry bypasses flight and consumes only the guide draw", () => {
  const g = new Game({ locations, expeditionResources: { clues } });
  g.campaign.location = 1;
  g.campaign.day = 8;
  g.money = 250;
  g.rareCoinTaken = true;
  g.flight = { previous: true };
  g.departure = { previous: true };
  const seed = g.seed;
  g.travel(1);
  assert.equal(g.scene, "expedition-briefing");
  assert.equal(g.briefing.activity, "cave");
  assert.equal(g.seed, nextRandom(seed));
  assert.equal(g.campaign.seed, g.seed);
  assert.equal(g.flight, null);
  assert.equal(g.departure, null);
  assert.deepEqual(
    [g.campaign.day, g.campaign.location, g.money, g.rareCoinTaken],
    [8, 1, 250, false],
  );
  assert.equal(g.briefing.remaining, 210);
});

test("original collected notices enforce their full waits and explicit sound completion polls", () => {
  for (const [reason, ticks, portrait] of [
    ["player", 560, 30],
    ["rival", 280, 33],
  ]) {
    const n = new CampaignVisitNotice({ reason, target: 1 });
    n.begin();
    assert.equal(n.portrait, portrait);
    for (let i = 0; i < ticks - 1; i++) assert.equal(n.advanceTick(), false);
    assert.equal(n.advanceTick(), true);
    assert.equal(n.advanceTick(), true);
  }
  const n = new CampaignVisitNotice({
    reason: "rival",
    target: 1,
    audioEnabled: true,
    token: "current",
  });
  n.begin();
  for (let i = 0; i < 100; i++)
    assert.equal(n.advanceTick(), false, "pending sound silently completed");
  n.setAudioStatus("old", false);
  assert.equal(n.busy, null, "Initial status is supplied by the device");
  n.setAudioStatus("current", true);
  n.resumeAudioStatus();
  n.setAudioStatus("current", false);
  for (let i = 0; i < 6; i++) assert.equal(n.advanceTick(), false);
  assert.equal(
    n.advanceTick(),
    true,
    "completion must bypass the extra40-poll wait",
  );
  const instant = new CampaignVisitNotice({
    reason: "rival",
    target: 1,
    audioEnabled: true,
    token: "instant",
  });
  instant.skipRequested = true;
  instant.setAudioStatus("instant", false);
  instant.begin();
  assert.equal(instant.skipRequested, false, "Entry flush drops old Fire");
  instant.skipRequested = true;
  assert.equal(instant.advanceTick(), false);
  assert.equal(instant.phase, "dialogue");
  for (let i = 0; i < 5; i++) assert.equal(instant.advanceTick(), false);
  assert.equal(instant.advanceTick(), true);
  assert.throws(
    () => new CampaignVisitNotice({ reason: "unknown", target: 1 }),
  );
});

test("notice device events are routed by token and remain isolated across restart", () => {
  const g = new Game({
    locations,
    audioEnabled: true,
    hasAudioDevice: () => true,
    expeditionResources: reportResources,
  });
  g.campaign.locations[1].rivalCollected = true;
  g.travel(1);
  const n = g.visitNotice,
    token = n.token;
  advanceReportUntil(g, () => g.reportPresentation.phase === "reveal");
  assert.ok(
    g
      .drainEffects()
      .some((e) => e.type === "sound" && e.id === 0x6e && e.token === token),
  );
  advanceReportUntil(g, () => g.reportPresentation.phase === "reading");
  const query = g.drainEffects().find((e) => e.type === "audio-query");
  assert.equal(g.scene, "visit-notice");
  g.input({ type: "audio-status", token: "stale", busy: false });
  assert.equal(n.busy, null);
  g.input({ type: "audio-status", token: query.token, busy: true });
  g.input({ type: "audio-enabled", enabled: false });
  assert.equal(n.busy, true, "Mute is not a device completion");
  advanceReportUntil(g, () => n.waitingForAudio);
  const next = g.drainEffects().find((e) => e.type === "audio-query");
  g.input({ type: "audio-status", token: next.token, busy: false });
  finishReport(g);
  assert.equal(g.scene, "map");
  g.input({ type: "restart" });
  g.input({ type: "audio-enabled", enabled: true });
  g.campaign.locations[1].rivalCollected = true;
  g.travel(1);
  assert.notEqual(g.visitNotice.token, token);
  g.input({ type: "audio-status", token, busy: false });
  assert.equal(g.visitNotice.busy, null);
});
