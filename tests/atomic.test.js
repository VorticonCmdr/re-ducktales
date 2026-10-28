import {
  bankResources,
  finishBankWithHeldFire,
} from "./helpers/bank-fixture.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArchive } from "../src/assets.js";
import { parseLocations, parseLoot, travelDays } from "../src/game/campaign.js";
import {
  AtomicTransport,
  atomicRoll,
  misdirectedDestination,
} from "../src/game/atomic-transport.js";
import { nextRandom } from "../src/game/integer.js";
import { Game } from "../src/game/application.js";
const locations = parseLocations(parseArchive(readFileSync("game/LOC.ARC"))),
  loot = parseLoot(parseArchive(readFileSync("game/LOOT.ARC"))),
  clues = parseArchive(readFileSync("game/CLUES.ARC"));
const game = () =>
  new Game({ bankResources, locations, loot, expeditionResources: { clues } });

test("atomic thresholds include their boundary roll and consume exactly one rotate draw", () => {
  for (const difficulty of [0, 1, 2]) {
    // Invert the rotate/add to supply the threshold and threshold+1,not fitted outputs.
    for (const roll of [8 + 8 * difficulty, 9 + 8 * difficulty]) {
      const seed = ((((roll << 3) | (roll >>> 13)) & 65535) - 0x9248) & 65535;
      assert.deepEqual(atomicRoll(seed, difficulty), {
        seed: roll,
        roll,
        success: roll > 8 + 8 * difficulty,
      });
    }
  }
  assert.throws(() => atomicRoll(0, 3), /difficulty/);
});

test("misdirection skips both collected flags, keeps the first tie and preserves requested fallback", () => {
  const c = game().campaign;
  c.locations[1].playerCollected = true;
  c.locations[2].rivalCollected = true;
  assert.equal(misdirectedDestination(c.locations, 24), 3);
  c.locations.forEach((l) => (l.playerCollected = true));
  assert.equal(misdirectedDestination(c.locations, 24), 24);
});

test("atomic success updates its byte calendar before the seven-tick charge and does not wait for audio", () => {
  const c = game().campaign;
  const a = new AtomicTransport({
    from: 35,
    target: 24,
    day: 255,
    difficulty: 2,
    seed: 0,
    locations: c.locations,
    audioEnabled: true,
    token: "a:1",
  });
  assert.equal(a.day, (255 + travelDays(c.locations, 35, 24)) & 255);
  assert.equal(a.seed, 4681);
  for (let i = 0; i < 6; i++) a.advanceTick();
  assert.equal(a.outcome, null);
  a.advanceTick();
  assert.equal(a.phase, "complete");
  assert.deepEqual(a.drainEvents(), [
    { type: "stopAudio" },
    { type: "sound", id: 0x54 },
  ]);
});

test("atomic failure consumes explicit audio completion then waits sixty polls before adding journey days", () => {
  const c = game().campaign;
  const a = new AtomicTransport({
    from: 1,
    target: 22,
    day: 12,
    difficulty: 2,
    seed: 0x6db8,
    locations: c.locations,
    audioEnabled: true,
    token: "a:2",
  });
  for (let i = 0; i < 7; i++) a.advanceTick();
  assert.equal(a.phase, "sound");
  assert.equal(a.day, 12);
  assert.equal(a.target, null);
  a.setAudioStatus("stale", false);
  for (let i = 0; i < 1000; i++) a.advanceTick();
  assert.equal(a.phase, "sound");
  a.setAudioStatus("a:2", false);
  a.advanceTick();
  assert.equal(a.phase, "report");
  assert.equal(a.target, 1);
  for (let i = 0; i < 419; i++) a.advanceTick();
  assert.equal(a.outcome, null);
  a.advanceTick();
  assert.equal(a.outcome.days, 0);
  assert.equal(a.outcome.day, 12);
  assert.equal(a.outcome.misdirected, true);
});

test("atomic choice persists on expedition maps, bypasses flights and resets on restart", () => {
  const g = game(),
    c = g.campaign;
  c.atomicAvailable = true;
  g.scene = "map";
  c.selected = 31;
  c.info = true;
  g.input({ type: "left" });
  assert.equal(c.choice, 2);
  const seed = g.seed;
  g.input({ type: "fire" });
  assert.equal(c.aircraft, "atomic");
  assert.equal(g.scene, "atomic-transport");
  assert.equal(g.departure, null);
  assert.equal(g.flight, null);
  assert.equal(g.atomicTransport.requested, 31);
  assert.equal(g.atomicTransport.seed, atomicRoll(seed, 0).seed);
  g.input({ type: "fire" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  if (g.scene === "atomic-transport") {
    g.input({ type: "fire" });
    for (let i = 0; i < 7; i++) g.advanceTick();
  }
  assert.equal(g.scene, "expedition-briefing");
  const here = c.location;
  // Same-location retry takes no atomic draw,only the original guide draw.
  const retrySeed = g.seed;
  g.travel(here);
  assert.equal(g.seed, nextRandom(retrySeed));
  assert.equal(g.atomicTransport.phase, "complete");
  g.input({ type: "restart" });
  assert.equal(g.atomicTransport, null);
  assert.equal(g.campaign.atomicAvailable, false);
  assert.equal(g.campaign.aircraft, "launchpad");
});

test("atomic travel past the deadline deposits and ends before an expedition loads", () => {
  const g = game(),
    c = g.campaign;
  c.atomicAvailable = true;
  c.aircraft = "atomic";
  c.day = 30;
  g.money = 1234;
  g.seed = 0;
  g.travel(c.locations.findIndex((l) => l.asset === 29));
  assert.equal(g.scene, "atomic-transport");
  assert.equal(c.day, 32);
  for (let i = 0; i < 7; i++) g.advanceTick();
  finishBankWithHeldFire(g);
  assert.equal(g.scene, "ending");
  assert.equal(g.briefing, null);
  assert.equal(c.location, 0);
  assert.equal(c.banked, 1234);
  assert.equal(g.money, 0);
});
