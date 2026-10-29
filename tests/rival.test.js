import {
  destinationReady,
  confirmDestination,
} from "./helpers/destination-fixture.js";
import {
  bankResources,
  finishBankWithHeldFire,
} from "./helpers/bank-fixture.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArchive } from "../src/assets.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import { Game } from "../src/game/application.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { unpackImage } from "../src/game/executable.js";
import {
  advanceRival,
  selectRivalDestination,
  RivalReport,
} from "../src/game/rival.js";
const locations = parseLocations(parseArchive(readFileSync("game/LOC.ARC")));
const loot = parseLoot(parseArchive(readFileSync("game/LOOT.ARC")));
function game() {
  return new Game({ bankResources, locations, loot });
}

test("rival policy keeps first ties, signed cash thresholds and difficulty strategies", () => {
  const g = game(),
    c = g.campaign;
  c.rival.money = 1000;
  assert.equal(selectRivalDestination({ ...c, loot, difficulty: 0 }), 1);
  c.rival.money++;
  assert.equal(selectRivalDestination({ ...c, loot, difficulty: 0 }), 0);
  c.rival.money = 0xffffffff;
  assert.equal(selectRivalDestination({ ...c, loot, difficulty: 0 }), 1);
  c.rival.money = 0;
  const candidates = [1, 2, 3];
  c.locations.forEach((l, i) => {
    l.playerCollected = !candidates.includes(i);
  });
  // Same coordinates make all three journeys cost one day. Value ties keep2.
  candidates.forEach((i) =>
    Object.assign(c.locations[i], { x: 56, y: 64, treasure: i }),
  );
  const values = [{ value: -1 }, { value: 8000 }, { value: 8000 }];
  c.rival.day = 2;
  assert.equal(
    selectRivalDestination({ ...c, loot: values, difficulty: 1 }),
    2,
  );
  assert.equal(
    selectRivalDestination({ ...c, loot: values, difficulty: 2 }),
    2,
  );
  c.rival.day = 1;
  assert.equal(
    selectRivalDestination({ ...c, loot: values, difficulty: 1 }),
    1,
  );
  c.locations.forEach((l) => (l.playerCollected = true));
  for (const [difficulty, day] of [
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 1],
  ]) {
    assert.equal(
      selectRivalDestination({
        ...c,
        rival: { ...c.rival, day },
        loot: values,
        difficulty,
      }),
      35,
    );
  }
  const exhausted = advanceRival({
    ...c,
    seed: 0,
    loot: values,
    difficulty: 0,
    day: 10,
    unlockMask: 1,
  });
  assert.equal(exhausted.target, 35);
  assert.equal(exhausted.kind, "miss");
  assert.equal(exhausted.draws, 2);
});

test("exhausted rival preserves the flight-table alias and resumes the campaign after its raw report", () => {
  const g = game(),
    c = g.campaign,
    bytes = new Uint8Array(65536);
  bytes.set(unpackImage(readFileSync("game/DUCKTALE.EXE")).subarray(0x120e0));
  const m = (g.flightMemory = new FlightMemory(bytes));
  m.i(0x4f42, 15);
  m.i(0x4f44, 0);
  m.i(0x4f48, -1);
  c.locations.forEach((l) => (l.playerCollected = true));
  c.day = 10;
  c.rivalUnlockMask = 2;
  c.rival.location = 0;
  c.rival.day = 1;
  g.seed = 56;
  g.completeCampaignAction({ type: "map" });
  assert.equal(g.scene, "rival-report");
  assert.equal(g.rivalReport.target, 35);
  assert.equal(g.rivalReport.name.length, 50);
  assert.equal(g.rivalReport.name.charCodeAt(49), 17);
  assert.equal(c.rival.location, 0, "publish location after report");
  assert.equal(g.seed, 29915);
  assert.equal(c.rival.money, 0);
  assert.equal(m.b(0x4f49), 1);
  assert.equal(m.i(0x4f48), 511);
  assert.equal(c.locations.length, 35, "no invented treasure location");
  for (let i = 0; i < 280; i++) g.advanceTick();
  assert.equal(g.scene, "map");
  assert.equal(c.rival.location, 35);
  g.completeCampaignAction({ type: "office" });
  for (let i = 0; i < 280 && g.scene === "rival-report"; i++) g.advanceTick();
  assert.equal(g.scene, "office");
  assert.equal(g.pendingCampaignAction, null);
  assert.equal(g.diagnostic, null);
  assert.equal(g.seed, 42517, "second turn carries its own RNG state");
});

test("a normal rival report suspends travel and rechecks the newly claimed destination", () => {
  const g = game(),
    c = g.campaign;
  Object.assign(c, {
    day: 10,
    rivalUnlockMask: 4,
    selected: 1,
  });
  g.scene = "map";
  g.seed = 56;
  g.input({ type: "fire" });
  destinationReady(g);
  g.input({ type: "right" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.scene, "rival-report");
  assert.equal(c.rival.location, 35, "location is published after the report");
  assert.equal(c.locations[1].rivalCollected, true);
  assert.deepEqual(g.pendingCampaignAction, { type: "travel", target: 1 });
  g.input({ type: "fire" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.scene, "visit-notice");
  assert.equal(c.rival.location, 1);
  assert.equal(g.visitNotice.reason, "rival");
  assert.equal(
    g.departure,
    null,
    "claimed destination must not start a flight",
  );
  assert.equal(g.pendingCampaignAction, null);
});

test("campaign idle time and map inspection never catch up rival turns", () => {
  const g = game(),
    c = g.campaign;
  c.day = 10;
  c.rivalUnlockMask = 4;
  g.scene = "map";
  g.seed = 56;
  const initial = { ...c.rival };
  for (let i = 0; i < 1000; i++) g.advanceTick();
  c.selected = 2;
  g.input({ type: "fire" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(c.info, false);
  assert.deepEqual(c.rival, initial);
  assert.equal(g.seed, 56);
  g.completeCampaignAction({ type: "map" });
  assert.equal(g.scene, "rival-report");
  for (let i = 0; i < 280; i++) g.advanceTick();
  const after = { ...c.rival },
    seed = g.seed;
  assert.equal(g.scene, "map");
  for (let i = 0; i < 1000; i++) g.advanceTick();
  assert.deepEqual(c.rival, after);
  assert.equal(g.seed, seed);
});

test("rival report consumes explicit sound completion at fourteen-tick polls and rejects stale tokens", () => {
  const r = new RivalReport({
    target: 1,
    variant: 1,
    audioEnabled: true,
    token: "rival:1",
  });
  r.advanceTick();
  assert.equal(r.polledBusy, true);
  r.setAudioStatus("old", false);
  for (let i = 0; i < 14; i++) r.advanceTick();
  assert.equal(r.complete, false);
  r.setAudioStatus("rival:1", false);
  for (let i = 0; i < 13; i++) assert.equal(r.advanceTick(), false);
  assert.equal(r.advanceTick(), true);
  const immediate = new RivalReport({
    target: 1,
    variant: 1,
    audioEnabled: true,
    token: "rival:2",
  });
  immediate.setAudioStatus("rival:2", false);
  immediate.advanceTick();
  assert.equal(immediate.phase, "dialogue");
  for (let i = 0; i < 279; i++) assert.equal(immediate.advanceTick(), false);
  assert.equal(immediate.advanceTick(), true);
  const g = game();
  g.rivalReport = r;
  g.pendingCampaignAction = { type: "map" };
  g.input({ type: "restart" });
  g.input({ type: "audio-status", token: "rival:1", busy: false });
  assert.equal(g.rivalReport, null);
  assert.equal(g.pendingCampaignAction, null);
});

test("exact day30 ending waits for rival cleanup and deposits each account once", () => {
  const g = game(),
    c = g.campaign;
  g.difficulty = 1;
  g.money = 1000;
  g.seed = 56;
  c.day = 30;
  c.rivalUnlockMask = 4;
  c.rival.money = 5000;
  g.beginEnding();
  finishBankWithHeldFire(g);
  assert.equal(g.scene, "rival-report");
  assert.equal(g.ending, null);
  assert.deepEqual(g.pendingCampaignAction, { type: "ending" });
  assert.equal(c.banked, 1000);
  assert.equal(c.rival.banked, 5000);
  assert.equal(g.money, 0);
  for (let i = 0; i < 280; i++) g.advanceTick();
  assert.equal(g.scene, "ending");
  assert.equal(g.ending.won, false);
  assert.equal(c.banked, 1000);
  assert.equal(c.rival.banked, 5000);
  assert.equal(g.seed, 29915);
});
