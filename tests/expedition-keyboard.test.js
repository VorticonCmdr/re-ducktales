import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { expeditionKeyEvent } from "../src/game/keyboard-adapter.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
const build = JSON.parse(read("reference/build.json"));
function original(n) {
  const b = read(`game/${n}`);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    build.files[n].sha256,
  );
  return b;
}
const resources = {
  image: unpackImage(original("DUCKTALE.EXE")),
  entries: parseArchive(original("EXP.ARC")),
  maps: parseCaveMaps(parseArchive(original("CAVEMAPS.ARC"))),
  mapEntries: parseArchive(original("CAVEMAPS.ARC")),
  mountainEntries: parseArchive(original("MT.ARC")),
  jungleEntries: parseArchive(original("JG.ARC")),
  photographyEntries: parseArchive(original("PS.ARC")),
  mainEntries: parseArchive(original("MAIN.ARC")),
};
const locations = parseLocations(parseArchive(original("LOC.ARC"))),
  loot = parseLoot(parseArchive(original("LOOT.ARC")));
function fresh(activity, { mode = 1, provider = "keyboard" } = {}) {
  const g = new Game({
    locations,
    loot,
    expeditionResources: resources,
    expeditionInput: provider,
  });
  const clock = new Scheduler(g);
  g.keyboardMode = mode;
  g.seed = 0;
  g.campaign.location = 1;
  g.briefing = { activity, variant: activity === "photography" ? 1 : 0 };
  g.startExpedition();
  return { g, clock, p: g[activity] };
}
function until(c, fn) {
  for (let i = 0; i < 20000; i++) {
    if (fn()) return;
    c.clock.advanceTo(c.clock.now + 2);
  }
  assert.fail("Unfinished physical expedition input");
}
function next(c) {
  const before = c.p.inputs.length;
  until(c, () => c.p.inputs.length > before);
  assert.equal(c.p.inputs.length, before + 1);
  return c.g.lastExpeditionKeyByte;
}
function key(c, key, pressed) {
  c.g.input(expeditionKeyEvent(key, pressed));
}
for (const activity of ["mountain", "cave"]) {
  test(`${activity} consumes a released Right once then reads neutral`, () => {
    const c = fresh(activity);
    next(c);
    assert.equal(c.g.expeditionKeyboard.mode, 0);
    key(c, "ArrowRight", true);
    assert.equal(c.p.memory.b(0x27b9), 128);
    assert.equal(next(c), 3);
    key(c, "ArrowRight", false);
    assert.equal(c.p.memory.b(0x27b9), 64);
    assert.equal(next(c), 3);
    assert.equal(c.p.memory.b(0x27b9), 0);
    assert.equal(next(c), 0);
  });
}
test("mountain keyboard preserves raw scan priority, aliases and keypad diagonals", () => {
  const c = fresh("mountain");
  next(c);
  key(c, "KeyI", true);
  key(c, "ArrowLeft", true);
  assert.equal(next(c), 7);
  key(c, "ArrowLeft", false);
  assert.equal(next(c), 7);
  assert.equal(next(c), 1);
  c.g.input({ type: "flush-expedition-keys" });
  key(c, "Numpad9", true);
  assert.equal(next(c), 2);
  c.g.input({ type: "flush-expedition-keys" });
  key(c, "Numpad5", true);
  assert.equal(next(c), 0);
});
test("Safari mode1 and post-read flush require a fresh physical make", () => {
  const c = fresh("photography");
  next(c);
  assert.equal(c.g.expeditionKeyboard.mode, 1);
  key(c, "ArrowRight", true);
  assert.equal(next(c), 3);
  assert.equal(next(c), 0);
  key(c, "ArrowRight", false);
  assert.equal(next(c), 0);
  key(c, "KeyK", true);
  assert.equal(next(c), 3);
  assert.equal(c.g.expeditionKeyboard.flags.size, 0);
  assert.equal(next(c), 0);
  key(c, "Space", true);
  assert.equal(next(c), 192);
  until(c, () => c.p.locals.i(-0x50) === 1);
  assert.equal(next(c), 0);
  key(c, "Space", true);
  assert.equal(next(c), 192);
});
test("jungle inherits reader mode and flushes the ordinary key matrix", () => {
  for (const mode of [0, 1]) {
    const c = fresh("jungle", { mode });
    next(c);
    assert.equal(c.g.expeditionKeyboard.mode, mode);
    key(c, "ArrowRight", true);
    assert.equal(next(c), 0); // First-page reveal flushes this early make.
    key(c, "ArrowRight", true);
    assert.equal(next(c), 3);
    until(c, () => c.g.expeditionKeyboard.flags.size === 0);
    key(c, "ArrowRight", false);
    assert.equal(next(c), 0);
  }
});
test("entry, source flush and Restart discard queued physical keys", () => {
  const c = fresh("mountain");
  key(c, "ArrowRight", true);
  c.p.flushInput();
  assert.equal(c.g.expeditionKeyboard.flags.size, 0);
  key(c, "ArrowRight", false);
  assert.equal(next(c), 0);
  key(c, "ArrowRight", true);
  assert.equal(next(c), 3);
  c.g.input({ type: "restart" });
  assert.equal(c.g.expeditionKeyboard.flags.size, 0);
  assert.equal(c.g.keyboardMode, 1);
  assert.equal(c.g.scene, "title");
});
test("digital providers remain separate and invalid raw source bytes stop", () => {
  const c = fresh("mountain", { provider: "digital" });
  c.g.input({ type: "controls", direction: "right", fire: false });
  const before = c.p.inputs.length;
  until(c, () => c.p.inputs.length > before);
  assert.equal(c.p.inputs.at(-1).input, 3);
  assert.throws(
    () => key(c, "ArrowRight", true),
    /Physical expedition key outside keyboard provider/,
  );
  for (const activity of ["mountain", "jungle", "cave"]) {
    const x = fresh(activity, { provider: "digital" });
    x.p.readInputByte = () => 256;
    assert.throws(
      () => x.clock.advanceTo(10000),
      /Invalid .* input-byte provider/,
    );
  }
});

test("cave keypad diagonal plus Fire uses the source cardinal grouping and awards the room", () => {
  const c = fresh("cave");
  next(c);
  assert.equal(c.p.room, 17);
  key(c, "Numpad3", true);
  key(c, "Space", true);
  assert.equal(next(c), 196); // Keyboard C0 | diagonal4; original cave chooses Right.
  until(c, () => c.p.room === 18);
  key(c, "Numpad3", false);
  key(c, "Space", false);
  until(c, () => c.p.memory.view.getUint32(0x8cc0, true) === 50);
  assert.equal(c.p.room, 18);
  assert.equal(c.g.money, 50);
});

test("physical keyboard reads never fall back to synthesized held controls", () => {
  const c = fresh("mountain");
  next(c);
  c.g.input({ type: "controls", direction: "right", fire: true });
  assert.equal(next(c), 0);
  key(c, "ArrowRight", true);
  assert.equal(next(c), 3);
});
