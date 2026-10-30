import test from "node:test";
import assert from "node:assert/strict";
import {
  BiosClock,
  biosTicksAtLocalTime,
  parseBiosSeedOverride,
} from "../src/game/bios-clock.js";
import { Game } from "../src/game/application.js";
import { originalGame } from "./helpers/original-game.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
const { image, archives } = await originalGame();
const options = {
  locations: parseLocations(archives.get("LOC.ARC")),
  loot: parseLoot(archives.get("LOOT.ARC")),
  openingResources: { image, entries: archives.get("MAIN.ARC") },
};
function until(g, predicate) {
  for (let i = 0; i < 2000; i++) {
    if (predicate()) return;
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.fail("Unfinished BIOS menu scenario");
}
function menu(g) {
  g.input({ type: "fire" });
  until(g, () => g.difficultyMenu?.phase === "menu");
}
function confirm(g) {
  g.input({ type: "fire" });
  until(g, () => g.difficultyMenu?.biosSeed !== null);
}
test("BIOS boot local-time conversion follows the nominal reference timer", () => {
  for (const [ms, ticks] of [
    [0, 0],
    [1000, 18],
    [3600000, 65543],
    [43200000, 786521],
    [86399999, 1573042],
  ])
    assert.equal(biosTicksAtLocalTime(ms), ticks);
  assert.throws(
    () => biosTicksAtLocalTime(86400000),
    /Invalid BIOS local time/,
  );
});
test("BIOS low-word rollover retains full counter state", () => {
  let now = 0;
  const c = new BiosClock({ clock: () => now, initialMilliseconds: 3599000 });
  assert.equal(c.readWord("startup"), 65525);
  now = 1000;
  assert.equal(c.readWord("difficulty"), 7);
  assert.equal(c.reads[1].ticks, 65543);
  assert.equal(c.reads[1].elapsed, 1000);
});
test("BIOS midnight wrap retains late-initialization and first-IRQ quirks", () => {
  let now = 0;
  const late = new BiosClock({
    clock: () => now,
    initialMilliseconds: 86399999,
  });
  assert.equal(late.readWord("startup"), 1573042 & 65535);
  now = 55;
  assert.equal(late.readWord("difficulty"), 0);
  now = 110;
  assert.equal(late.readWord("startup"), 1);
  now = 0;
  const day = new BiosClock({ clock: () => now, initialMilliseconds: 0 });
  now = 86400000;
  assert.equal(day.readWord("difficulty"), 2);
});
test("BIOS clock excludes explicit hidden-page pauses and survives game clock rebasing", () => {
  let now = 0;
  const c = new BiosClock({ clock: () => now, initialMilliseconds: 0 });
  now = 1000;
  assert.equal(c.readWord("startup"), 18);
  now = 6000;
  c.pauseDuration(5000);
  assert.equal(c.readWord("difficulty"), 18);
  now = 7000;
  assert.equal(c.readWord("startup"), 36);
  assert.deepEqual(
    c.reads.map((r) => r.elapsed),
    [1000, 1000, 2000],
  );
});
test("Game consumes separate startup and original difficulty BIOS inputs", () => {
  const inputs = [1643, 18293],
    reads = [];
  const g = new Game({
    ...options,
    readBiosSeed: (boundary) => {
      reads.push(boundary);
      assert.ok(inputs.length);
      return inputs.shift();
    },
  });
  assert.equal(g.opening.seed, 1643);
  menu(g);
  assert.deepEqual(reads, ["startup"]);
  g.input({ type: "down" });
  for (let i = 0; i < 10; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(reads.length, 1);
  confirm(g);
  assert.deepEqual(reads, ["startup", "difficulty"]);
  assert.equal(g.difficultyMenu.biosSeed, 18293);
  assert.equal(g.biosSeed, 18293);
  assert.equal(inputs.length, 0);
  until(g, () => g.scene === "office");
  assert.equal(reads.length, 2);
});
test("explicit fixed BIOS input preserves existing startup/menu simulation", () => {
  const a = new Game({ ...options, biosSeed: 0 }),
    b = new Game({ ...options, readBiosSeed: () => 0 });
  for (let i = 0; i < 100; i++) {
    if (i === 0 || i === 60) {
      a.input({ type: "fire" });
      b.input({ type: "fire" });
    }
    a.advanceTick();
    a.advanceRetrace();
    b.advanceTick();
    b.advanceRetrace();
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
test("ending replay reseeds at confirmation and UI Restart samples startup again", () => {
  const reads = [];
  const g = new Game({
    ...options,
    readBiosSeed: (boundary) => {
      reads.push(boundary);
      return reads.length * 1000;
    },
  });
  g.input({ type: "restart", skipTitle: true });
  assert.deepEqual(reads, ["startup"]);
  until(g, () => g.difficultyMenu?.phase === "menu");
  confirm(g);
  assert.equal(g.biosSeed, 2000);
  g.input({ type: "restart" });
  assert.deepEqual(reads, ["startup", "difficulty", "startup"]);
  assert.equal(g.opening.seed, 3000);
  assert.equal(g.tick, 0);
});
test("invalid BIOS providers and overrides fail instead of substituting values", () => {
  assert.equal(parseBiosSeedOverride(null), null);
  assert.equal(parseBiosSeedOverride("0"), 0);
  assert.equal(parseBiosSeedOverride("65535"), 65535);
  for (const raw of ["", "-1", "65536", "1e3", "1.5", " 1", "01"])
    assert.throws(() => parseBiosSeedOverride(raw), /Invalid bios-seed/);
  assert.throws(
    () => new Game({ ...options, readBiosSeed: () => 65536 }),
    /Invalid BIOS seed word/,
  );
  let now = 10;
  const c = new BiosClock({ clock: () => now, initialMilliseconds: 0 });
  c.readWord("startup");
  now = 9;
  assert.throws(() => c.readWord("difficulty"), /backwards/);
  now = 20;
  assert.throws(() => c.pauseDuration(100), /overlaps/);
  assert.throws(() => c.readWord("unknown"), /Unsupported BIOS read boundary/);
});
