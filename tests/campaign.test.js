import {
  destinationReady,
  confirmDestination,
  advanceFixtureUntil,
} from "./helpers/destination-fixture.js";
import {
  bankResources,
  finishBankWithHeldFire,
} from "./helpers/bank-fixture.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseArchive } from "../src/assets.js";
import {
  Campaign,
  parseLocations,
  orderLocations,
  assignLoot,
  travelDays,
  OFFICE,
} from "../src/game/campaign.js";
import { Game } from "../src/game/application.js";
const locations = parseLocations(parseArchive(readFileSync("game/LOC.ARC")));
const departureEntries = parseArchive(readFileSync("game/MAIN.ARC"));
test("original random treasure probing reserves future fixed IDs and skips37 on wrap", () => {
  const synthetic = Array.from({ length: 35 }, (_, i) => ({
    treasure: i === 0 || i === 2 ? 0 : i === 1 ? 36 : i === 3 ? 1 : i - 1,
  }));
  const assigned = assignLoot(synthetic, 28368); // next RNG35 -> initial candidate36
  assert.equal(assigned.draws, 1);
  assert.equal(assigned.locations[2].treasure, 2);
  assert.equal(assigned.seed, 35);
  assert.equal(
    synthetic[2].treasure,
    0,
    "input is authoritative and immutable",
  );
  assert.equal(
    assignLoot(synthetic, 28376).locations[2].treasure,
    37,
    "initial draw can select37",
  );
  assert.throws(() => assignLoot([], 0), /35 locations/);
});
test("original location permutation and wrapped integer journey costs", () => {
  const c = new Campaign(locations, 0);
  assert.equal(new Set(c.locations.map((l) => l.asset)).size, 35);
  assert.equal(c.locations[0].asset, 0);
  assert.equal(travelDays(c.locations, OFFICE, 0), 3);
  assert.equal(travelDays(c.locations, 0, OFFICE), 3);
  assert.equal(travelDays(c.locations, 0, 0), 0);
  for (let a = 0; a < 36; a++)
    for (let b = 0; b < 36; b++) {
      const cost = travelDays(c.locations, a, b);
      assert.ok(cost >= 0 && cost <= 3);
      assert.equal(cost, travelDays(c.locations, b, a));
    }
  // Divisor boundaries and wrap in both axes, independent of campaign locations.
  assert.equal(
    travelDays(
      [
        { x: 0, y: 0 },
        { x: 81, y: 0 },
      ],
      0,
      1,
    ),
    1,
  );
  assert.equal(
    travelDays(
      [
        { x: 0, y: 0 },
        { x: 82, y: 0 },
      ],
      0,
      1,
    ),
    2,
  );
  assert.equal(
    travelDays(
      [
        { x: 0, y: 0 },
        { x: 271, y: 139 },
      ],
      0,
      1,
    ),
    1,
  );
  // Seed 0 -> 0x1249 (%30=1) -> 0x3492 (%5=3), from original rotate instructions.
  assert.deepEqual(
    orderLocations(locations, 0)
      .locations.slice(0, 5)
      .map((l) => l.asset),
    [0, 1, 4, 7, 10],
  );
});
test("cash deposit, coin reset, cancellation and return retain closed-loop state", () => {
  const g = new Game({ bankResources, locations, departureEntries });
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
  g.input({ type: "map" });
  g.input({ type: "point", x: 212, y: 131 });
  g.input({ type: "fire" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.campaign.day, 1);
  g.input({ type: "fire" });
  destinationReady(g);
  g.input({ type: "right" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.campaign.banked, 1000);
  assert.equal(g.money, 0);
  assert.equal(g.rareCoinTaken, false);
  assert.equal(g.campaign.day, 4);
  finishBankWithHeldFire(g);
  g.input({ type: "point", x: 46, y: 139 });
  g.input({ type: "fire" });
  assert.equal(g.scene, "office");
  assert.equal(g.campaign.day, 7);
  assert.equal(g.campaign.banked, 1000);
});
test("invalid resources and unsupported journeys fail explicitly", () => {
  assert.throws(() => parseLocations([]), /35/);
  const g = new Game({ bankResources, locations, departureEntries });
  g.input({ type: "fire" });
  g.input({ type: "fire" });
  g.input({ type: "map" });
  g.input({ type: "point", x: 37, y: 33 });
  g.input({ type: "fire" });
  destinationReady(g);
  g.input({ type: "right" });
  destinationReady(g);
  confirmDestination(g);
  assert.equal(g.scene, "departure");
  g.input({ type: "fire" }); // No source reader exists in the briefing.
  assert.equal(g.scene, "departure");
  assert.throws(
    () => advanceFixtureUntil(g, () => g.scene !== "departure"),
    /Flight resources not loaded/,
  );
  assert.equal(g.campaign.day, 1);
  g.campaign.day = 28;
  g.travel(0);
  finishBankWithHeldFire(g);
  assert.equal(g.campaign.day, 31);
  assert.equal(g.scene, "ending");
  assert.equal(g.ending.won, true); // Original ties favor Scrooge.
});
