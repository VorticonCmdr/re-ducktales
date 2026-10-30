import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import build from "../reference/build.json" with { type: "json" };
async function supported(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    build.files[name].sha256,
  );
  return b;
}
const resources = {
  image: unpackImage(await supported("DUCKTALE.EXE")),
  entries: parseArchive(await supported("EXP.ARC")),
  maps: parseCaveMaps(parseArchive(await supported("CAVEMAPS.ARC"))),
};
const locations = parseLocations(parseArchive(await supported("LOC.ARC"))),
  loot = parseLoot(parseArchive(await supported("LOOT.ARC")));
// Conditional application entry; no original campaign replay is claimed.
function fresh() {
  const g = new Game({ locations, loot, expeditionResources: resources });
  g.seed = 0;
  g.briefing = { activity: "cave", variant: 0 };
  g.campaign.location = 30;
  g.startExpedition();
  return g;
}
function until(g, predicate) {
  for (let i = 0; i < 5000; i++) {
    if (predicate()) return;
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.fail(`Unfinished cave input test: ${JSON.stringify(g.snapshot())}`);
}
function exploring(g) {
  until(g, () => g.cave.phase === "exploring");
}

test("cave entry flushes unread global keys and held controls before its first input", () => {
  const g = fresh();
  for (const type of ["pause", "quit", "toggle-sound"]) g.input({ type });
  g.input({ type: "controls", fire: true, direction: "up" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingCaveSystemKeys.size, 3);
  exploring(g);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingCaveSystemKeys.size, 0);
  assert.equal(g.audioEnabled, false);
  assert.deepEqual(g.cave.controls, { fire: false, direction: null });
  assert.equal(g.cave.inputs.at(-1).code, 0);
});

test("cave pauses at its input call, preserves memory and carries advancing device clocks", () => {
  const g = fresh();
  exploring(g);
  const c = g.cave;
  g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null);
  until(g, () => !!g.systemOverlay);
  assert.equal(c.wait.clock, "input");
  const bytes = Uint8Array.from(c.memory.bytes),
    n = c.inputs.length,
    tick = c.tick,
    retrace = c.retrace,
    shown = c.presentations;
  for (let i = 0; i < 1000; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.deepEqual(c.memory.bytes, bytes);
  assert.equal(c.inputs.length, n);
  assert.equal(c.presentations, shown);
  assert.equal(c.tick, tick + 1000);
  assert.equal(c.retrace, retrace + 1000);
  g.input({ type: "controls", fire: true, direction: "right" });
  g.input({ type: "pause" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.equal(c.inputs.length, n + 1);
  assert.equal(c.inputs.at(-1).code, 0);
  assert.equal(c.wait.clock, "graphics");
  assert.ok(c.lastPartyWork.milliseconds > 0);
  for (let i = 0; i < 200 && c.wait.clock === "graphics"; i++) g.advanceTick();
  assert.equal(c.wait.clock, "retrace");
  assert.equal(
    c.inputs.length,
    n + 1,
    "drawing must finish before another input",
  );
  g.advanceRetrace();
  assert.equal(
    c.inputs.length,
    n + 2,
    "overdue independent deadline must not restart a six-tick delay",
  );
});

test("room entry discards keys entered during passage animation and requires fresh movement", () => {
  const g = fresh();
  exploring(g);
  g.input({ type: "controls", fire: true, direction: "right" });
  until(g, () => g.cave.room === 18);
  for (const type of ["quit", "pause", "toggle-sound"]) g.input({ type });
  g.input({ type: "controls", fire: true, direction: "down" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingCaveSystemKeys.size, 3);
  exploring(g);
  assert.equal(g.systemOverlay, null);
  assert.equal(g.pendingCaveSystemKeys.size, 0);
  assert.equal(g.audioEnabled, false);
  assert.equal(g.cave.room, 18);
  assert.equal(g.money, 50);
  assert.deepEqual(g.cave.controls, { fire: false, direction: null });
  assert.equal(g.cave.inputs.at(-1).code, 0);
});

test("cave cancelled Quit resumes its poll and Restart clears deferred input", () => {
  const g = fresh();
  exploring(g);
  g.input({ type: "quit" });
  until(g, () => !!g.systemOverlay);
  const n = g.cave.inputs.length;
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(g.cave.inputs.length, n + 1);
  assert.equal(g.cave.inputs.at(-1).code, 0);
  g.input({ type: "pause" });
  assert.equal(g.pendingCaveSystemKeys.size, 1);
  g.input({ type: "restart" });
  assert.equal(g.pendingCaveSystemKeys.size, 0);
  assert.equal(g.cave, null);
});

test("terminal animation keys are flushed at the following result dialog", () => {
  const g = fresh();
  exploring(g);
  for (const [direction, target] of [
    ["up", 9],
    ["up", 1],
  ]) {
    g.input({ type: "controls", fire: true, direction });
    until(g, () => g.cave.room === target);
    if (target !== 1) exploring(g);
  }
  until(g, () => g.cave.phase === "pit");
  g.input({ type: "pause" });
  assert.equal(g.pendingCaveSystemKeys.size, 1);
  until(g, () => g.scene !== "cave");
  assert.equal(g.scene, "expedition-result");
  assert.equal(g.cave.outcome.status, "pit");
  assert.equal(g.pendingCaveSystemKeys.size, 0);
  assert.equal(g.systemOverlay, null);
});
