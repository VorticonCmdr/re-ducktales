import {
  destinationReady,
  confirmDestination,
  advanceFixtureUntil,
} from "./helpers/destination-fixture.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Departure, expeditionType } from "../src/game/departure.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import { Game } from "../src/game/application.js";
import { parseLocations } from "../src/game/campaign.js";
import { parseArchive } from "../src/assets.js";
const input = {
  from: 35,
  target: 25,
  days: 1,
  flags: 8,
  difficulty: 0,
  seed: 0xa2fd,
};
const locations = parseLocations(parseArchive(readFileSync("game/LOC.ARC")));
const departureEntries = parseArchive(readFileSync("game/MAIN.ARC"));
test("read-only executable assets match independently unpacked original image", () => {
  const original = readFileSync("game/DUCKTALE.EXE"),
    saved = Buffer.from(original);
  const image = unpackImage(original);
  assert.equal(
    createHash("sha256").update(image).digest("hex"),
    "47e622175ccf124edab2ed1b5ccb725045d5e54b5766428f8309303fcdf5564d",
  );
  assert.equal(image.length, 87664);
  assert.deepEqual(original, saved);
  assert.equal(executableText(image, 0x186).length, 18);
  assert.throws(() => unpackImage(Uint8Array.of(0, 1)), /MZ/);
  assert.throws(() => unpackImage(saved.subarray(0, 100)), /Truncated/);
  assert.throws(() => executableText(image, -1), /address/);
  assert.throws(() => executableText(image, 0x5ffff), /address/);
});
test("departure consumes two original RNG draws and retains exact flight contract", () => {
  const p = new Departure(input);
  assert.equal(p.variant, 1);
  assert.equal(p.raceRoll, 22);
  assert.equal(p.seed, 0x071e);
  assert.deepEqual(p.flightRequest, { days: 1, racing: 1 });
  assert.deepEqual(p.speechOffsets, [0x1b8, 0x1c1, 0x1d0]);
  assert.deepEqual(
    new Departure({ ...input, rivalCollected: true }).flightRequest,
    { days: 1, racing: 0 },
  );
  assert.equal(expeditionType(33), "jungle");
  assert.equal(expeditionType(18), "mountain");
  assert.equal(expeditionType(100), "photography");
  assert.equal(expeditionType(120), "cave");
  assert.throws(() => expeditionType(3), /Unsupported/);
  assert.throws(() => new Departure({ ...input, days: 0 }), /travel days/);
  assert.throws(() => new Departure({ ...input, seed: -1 }), /RNG/);
  assert.throws(() => new Departure({ ...input, difficulty: 3 }), /difficulty/);
});
test("inspection and cancellation do not consume RNG; confirming preserves cash/day and clears coin latch", () => {
  const g = new Game({ locations, departureEntries });
  g.input({ type: "fire" });
  g.input({ type: "fire" });
  g.input({ type: "map" });
  const seed = g.seed;
  g.input({ type: "point", x: 37, y: 33 });
  g.input({ type: "fire" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.seed, seed);
  assert.equal(g.campaign.day, 1);
  assert.equal(g.scene, "map");
  g.input({ type: "fire" });
  destinationReady(g);
  g.input({ type: "right" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.scene, "departure");
  assert.equal(g.departure.activity, "cave");
  assert.equal(g.campaign.day, 1);
  assert.equal(g.campaign.location, 35);
  assert.equal(g.money, 0);
  const prepared = g.snapshot();
  g.input({ type: "fire" }); // No source reader exists in the briefing.
  assert.equal(g.scene, "departure");
  assert.deepEqual(g.snapshot(), prepared);
  assert.throws(
    () => advanceFixtureUntil(g, () => g.scene !== "departure"),
    /Flight resources not loaded/,
  );
  g.input({ type: "restart" });
  assert.equal(g.departure, null);
  assert.equal(g.seed, seed);
});

test("strict difficulty thresholds use the second draw and suppress already-collected races", () => {
  // Synthetic boundary inputs, not fitted original-capture timers or replay events.
  for (const [seed, roll] of [
    [147, 24],
    [211, 25],
    [187, 49],
    [8, 50],
    [9, 74],
    [73, 75],
  ]) {
    for (let difficulty = 0; difficulty < 3; difficulty++) {
      const p = new Departure({ ...input, seed, difficulty });
      assert.equal(p.raceRoll, roll);
      assert.equal(p.racing, roll < [25, 50, 75][difficulty]);
    }
  }
});
test("an earned coin is retained as cash while confirming an expedition resets its latch", () => {
  const g = new Game({ locations, departureEntries });
  g.input({ type: "fire" });
  g.input({ type: "fire" });
  g.input({ type: "money-bin" });
  for (let i = 0; i < 168; i++) g.advanceTick();
  g.input({ type: "fire" });
  for (let i = 0; i < 1000; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(g.money, 1000);
  assert.equal(g.rareCoinTaken, true);
  g.input({ type: "map" });
  g.input({ type: "point", x: 37, y: 33 });
  g.input({ type: "fire" });
  destinationReady(g);
  g.input({ type: "right" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.scene, "departure");
  assert.equal(g.money, 1000);
  assert.equal(g.rareCoinTaken, false);
  assert.equal(g.campaign.day, 1);
  assert.equal(g.campaign.banked, 0);
});
