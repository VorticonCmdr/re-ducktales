import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import { photographyWork } from "../src/game/photography-work.js";
const build = JSON.parse(read("reference/build.json"));
function original(name) {
  const b = read(`game/${name}`);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    build.files[name].sha256,
  );
  return b;
}
const resources = {
  image: unpackImage(original("DUCKTALE.EXE")),
  photographyEntries: parseArchive(original("PS.ARC")),
  mainEntries: parseArchive(original("MAIN.ARC")),
};
const locations = parseLocations(parseArchive(original("LOC.ARC"))),
  loot = parseLoot(parseArchive(original("LOOT.ARC")));
function fresh({ difficulty = 0 } = {}) {
  const g = new Game({
      locations,
      loot,
      expeditionResources: resources,
      audioEnabled: true,
    }),
    clock = new Scheduler(g, 37);
  g.seed = 0;
  g.difficulty = difficulty;
  g.campaign.location = 1;
  g.briefing = { activity: "photography", variant: 5 };
  g.startExpedition();
  return { g, clock, p: g.photography };
}
function until(c, predicate) {
  for (let i = 0; i < 30000; i++) {
    if (predicate()) return;
    c.clock.advanceTo(c.clock.now + 2);
  }
  assert.fail("Unfinished photography clock scenario");
}
function state(c) {
  return {
    scene: c.g.scene,
    tick: c.g.tick,
    money: c.g.money,
    seed: c.g.seed,
    controls: c.g.controls,
    effects: c.g.effects,
    photography: c.p.snapshot(),
    pixels: c.p.current,
  };
}
test("photography pre-shutter drawing delays the sound and film decision", () => {
  const c = fresh();
  c.g.input({ type: "controls", fire: true, direction: null });
  until(c, () => c.p.frames === 1);
  assert.equal(c.p.wait.clock, "graphics");
  assert.equal(c.p.drawingWork.kind, "background");
  assert.equal(c.p.memory.signedByte(0x5d2a), 12);
  assert.equal(c.p.locals.i(-0x50), 0);
  assert.ok(
    !c.g.drainEffects().some((e) => e.type === "sound" && e.id === 0x6a),
  );
  const due = c.p.wait.until + c.clock.origin;
  c.clock.advanceTo(due - 0.000001);
  assert.equal(c.p.memory.signedByte(0x5d2a), 12);
  assert.ok(
    !c.g.drainEffects().some((e) => e.type === "sound" && e.id === 0x6a),
  );
  c.clock.advanceTo(due);
  assert.equal(c.p.memory.signedByte(0x5d2a), 11);
  assert.equal(c.p.locals.i(-0x50), 1);
  assert.ok(
    c.g.drainEffects().some((e) => e.type === "sound" && e.id === 0x6a),
  );
  assert.equal(c.p.drawingWork.kind, "background"); // first of four new shot frames
  assert.ok(c.p.wait.until > c.clock.elapsed);
});
test("photography shutter pays nine drawing groups for four publications", () => {
  const c = fresh(),
    boundaries = [],
    input = c.p.readInput;
  c.p.readInput = () => {
    boundaries.push({
      calls: c.p.drawingCalls,
      shown: c.p.presentations,
      completed: c.p.drawingMilliseconds,
    });
    return input();
  };
  c.g.input({ type: "controls", fire: true, direction: null });
  until(c, () => boundaries.length === 2);
  assert.equal(boundaries[1].calls - boundaries[0].calls, 9);
  assert.equal(boundaries[1].shown - boundaries[0].shown, 4);
  assert.ok(boundaries[1].completed - boundaries[0].completed > 100);
});
test("photography drawing and held controls are invariant to catch-up batches", () => {
  const a = fresh(),
    b = fresh();
  for (const c of [a, b])
    for (const [at, event] of [
      [1400, { type: "controls", fire: true, direction: null }],
      [1800, { type: "controls", fire: false, direction: null }],
      [2400, { type: "controls", fire: false, direction: "left" }],
      [2700, { type: "controls", fire: true, direction: "left" }],
      [3000, { type: "controls", fire: false, direction: null }],
    ])
      c.clock.enqueue(event, at + 37);
  for (let at = 45; at < 6037; at += 8) a.clock.advanceTo(at);
  a.clock.advanceTo(6037);
  b.clock.advanceTo(6037);
  assert.equal(a.clock.events.length, 0);
  assert.equal(b.clock.events.length, 0);
  assert.ok(a.p.frames > 5);
  assert.deepEqual(state(a), state(b));
  assert.deepEqual(a.p.memory.bytes, b.p.memory.bytes);
  assert.deepEqual(a.p.locals.bytes, b.p.locals.bytes);
});
test("hidden-page pause preserves photography work and its next retrace", () => {
  const a = fresh(),
    b = fresh();
  until(a, () => a.p.wait.clock === "graphics");
  b.clock.advanceTo(a.clock.now);
  const untilTime = b.p.wait.until;
  b.clock.pauseDuration(10000);
  assert.equal(b.p.wait.until, untilTime);
  a.clock.advanceTo(3037);
  b.clock.advanceTo(13037);
  assert.deepEqual(state(a), state(b));
  assert.deepEqual(a.p.memory.bytes, b.p.memory.bytes);
});
test("Restart at photography drawing completion cancels the old continuation", () => {
  const c = fresh();
  until(c, () => c.p.wait.clock === "graphics");
  const shown = c.p.presentations;
  const due = c.p.wait.until + c.clock.origin;
  c.clock.enqueue({ type: "restart" }, due);
  c.clock.advanceTo(due + 1);
  assert.equal(c.g.scene, "title");
  assert.equal(c.g.photography, null);
  assert.equal(c.p.presentations, shown);
  assert.equal(c.g.nextSimulationWake(), null);
  assert.equal(c.clock.events.length, 0);
});
test("photography rejects missing or unsupported source work and invalid clocks", () => {
  const c = fresh();
  assert.throws(
    () => photographyWork(resources.photographyEntries, [{ op: "fill" }]),
    /Unsupported photography source operation/,
  );
  assert.throws(
    () =>
      photographyWork(resources.photographyEntries, [{ op: "copy", asset: 1 }]),
    /Unsupported photography source copy/,
  );
  assert.equal(
    photographyWork(resources.photographyEntries, []).milliseconds,
    0,
  );
  assert.throws(() => c.p.setClock(() => NaN), /Cannot rebase/);
  let elapsed = 5;
  c.p.setClock(() => elapsed);
  c.p.now();
  elapsed = 4;
  assert.throws(() => c.p.now(), /backwards photography/);
});

test("out-of-film exit still completes its unpresented background and HUD", () => {
  const c = fresh({ difficulty: 2 });
  c.g.input({ type: "controls", fire: true, direction: null });
  until(c, () => c.p.frames === 13);
  assert.equal(c.p.memory.signedByte(0x5d2a), 0);
  assert.equal(c.p.phase, "playing");
  assert.equal(c.p.drawingWork.kind, "background");
  const work = c.p.drawingWork.milliseconds,
    calls = c.p.drawingCalls;
  const completed = c.p.drawingMilliseconds,
    due = c.p.wait.until + c.clock.origin;
  c.clock.advanceTo(due - 0.000001);
  assert.equal(c.p.phase, "playing");
  c.clock.advanceTo(due);
  assert.equal(c.p.phase, "results");
  assert.equal(c.p.memory.signedByte(0x5d2a), -1);
  assert.equal(c.p.drawingCalls, calls);
  assert.ok(Math.abs(c.p.drawingMilliseconds - completed - work) < 1e-9);
});
