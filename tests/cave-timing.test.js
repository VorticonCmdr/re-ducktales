import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { DRIVER_HZ } from "../src/game/timing.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
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
  entries: parseArchive(original("EXP.ARC")),
  maps: parseCaveMaps(parseArchive(original("CAVEMAPS.ARC"))),
  currentDrive: 0,
};
const locations = parseLocations(parseArchive(original("LOC.ARC"))),
  loot = parseLoot(parseArchive(original("LOOT.ARC")));
function fresh({ origin = 0, audioEnabled = false } = {}) {
  const game = new Game({
    locations,
    loot,
    expeditionResources: resources,
    audioEnabled,
  });
  const clock = new Scheduler(game, origin);
  game.seed = 0;
  game.briefing = { activity: "cave", variant: 0 };
  game.campaign.location = 30;
  game.startExpedition();
  return { game, clock, cave: game.cave };
}
function state(c) {
  return {
    tick: c.game.tick,
    seed: c.game.seed,
    money: c.game.money,
    scene: c.game.scene,
    controls: c.game.controls,
    effects: c.game.effects,
    cave: c.cave.snapshot(),
  };
}
function next(c) {
  const wake = c.game.nextSimulationWake();
  c.clock.advanceTo(
    Math.min(
      c.clock.tickAt,
      c.clock.retraceAt,
      wake === null
        ? Infinity
        : wake + c.clock.origin + c.clock.pausedMilliseconds,
    ),
  );
}
test("cave drawing completes at its source budget before the following retrace", () => {
  const { game, clock, cave } = fresh({ origin: 37 });
  assert.equal(cave.lastDrawingWork.kind, "initial-minimap");
  assert.equal(cave.initialDrawingWork.minimapPoints, 776);
  let completion = cave.initialDrawingWork.milliseconds;
  clock.advanceTo(37 + completion - 0.001);
  assert.equal(cave.wait.clock, "graphics");
  assert.equal(cave.presentations, 0);
  clock.advanceTo(37 + completion);
  assert.equal(cave.presentationTransition.kind, "wipe");
  assert.deepEqual(cave.wait, { clock: "retrace", remaining: 5 });
  const beforeWipes = cave.retrace;
  const entry = { game, clock, cave };
  for (let i = 0; i < 200 && cave.lastDrawingWork.kind !== "room"; i++) next(entry);
  assert.equal(cave.lastDrawingWork.kind, "room");
  assert.equal(cave.retrace - beforeWipes, 50);
  assert.equal(cave.presentations, 10);
  completion = clock.elapsed;
  assert.equal(cave.lastRoomWork.copies, 2);
  assert.ok(cave.lastRoomWork.milliseconds > 10);
  completion += cave.lastRoomWork.milliseconds;
  clock.advanceTo(37 + completion);
  assert.equal(cave.lastDrawingWork.kind, "party");
  assert.equal(cave.lastPartyWork.minimapPoints, 33);
  assert.equal(cave.lastPartyWork.milliseconds, 126.15766666666667);
  completion += cave.lastPartyWork.milliseconds;
  clock.advanceTo(37 + completion - 0.001);
  assert.equal(cave.wait.clock, "graphics");
  clock.advanceTo(37 + completion);
  assert.equal(cave.wait.clock, "retrace");
  assert.equal(cave.presentations, 10);
  assert.equal(cave.tick, Math.floor((completion * DRIVER_HZ) / 1000));
  clock.advanceTo(clock.retraceAt);
  assert.equal(cave.presentations, 11);
  assert.equal(game.scene, "cave");
  for (let i = 0; i < 500 && cave.presentationTransition?.kind !== "reveal"; i++) next(entry);
  assert.equal(cave.presentationTransition?.kind, "reveal");
  const page = cave.drawIndex, memory = cave.memory.bytes.slice(), retrace = cave.retrace;
  for (let band = 0; band < 5; band++) {
    assert.deepEqual(cave.presentationTransition, { kind: "reveal", band });
    assert.deepEqual(cave.wait, { clock: "retrace", remaining: 5 });
    assert.equal(cave.drawIndex, page);
    assert.equal(cave.inputs.length, 0);
    assert.deepEqual(cave.memory.bytes, memory);
    for (let count = 0; count < 5; count++) clock.advanceTo(clock.retraceAt);
  }
  assert.equal(cave.retrace - retrace, 25);
  assert.equal(cave.presentationTransition, null);
  assert.equal(cave.drawIndex, page);
});
test("cave source work is invariant to catch-up batches", () => {
  const fine = fresh(),
    coarse = fresh();
  for (let at = 8; at < 2500; at += 8) fine.clock.advanceTo(at);
  fine.clock.advanceTo(2500);
  coarse.clock.advanceTo(2500);
  assert.ok(fine.cave.snapshot().inputReads > 5);
  assert.deepEqual(state(coarse), state(fine));
  assert.deepEqual(coarse.cave.memory.bytes, fine.cave.memory.bytes);
});
test("hidden-page pause preserves an active cave drawing budget", () => {
  const normal = fresh(),
    paused = fresh();
  const before = normal.cave.initialDrawingWork.milliseconds / 2;
  normal.clock.advanceTo(before);
  paused.clock.advanceTo(before);
  const until = paused.cave.wait.until;
  paused.clock.pauseDuration(10000);
  assert.equal(paused.cave.wait.until, until);
  assert.equal(paused.cave.presentations, 0);
  normal.clock.advanceTo(2500);
  paused.clock.advanceTo(12500);
  assert.deepEqual(state(paused), state(normal));
  assert.deepEqual(paused.cave.memory.bytes, normal.cave.memory.bytes);
});
test("Restart consumed at a cave work boundary cancels the old drawing", () => {
  const c = fresh();
  c.clock.enqueue({ type: "restart" }, c.cave.initialDrawingWork.milliseconds / 2);
  c.clock.advanceTo(200);
  assert.equal(c.game.scene, "title");
  assert.equal(c.game.cave, null);
  assert.equal(c.cave.presentations, 0);
  assert.equal(c.game.nextSimulationWake(), null);
  assert.equal(c.clock.consumed.length, 1);
  assert.equal(c.clock.events.length, 0);
});
test("capture sound follows both unpresented party work and the captor sprite", () => {
  const c = fresh({ audioEnabled: true });
  for (let i = 0; i < 20000 && c.cave.phase !== "captured"; i++) next(c);
  assert.equal(c.cave.phase, "captured");
  assert.equal(c.cave.wait.clock, "graphics");
  assert.ok(
    !c.game.drainEffects().some((e) => e.type === "sound" && e.id === 0x53),
  );
  for (const kind of ["party", "sprite"]) {
    const until = c.game.nextSimulationWake();
    assert.ok(until > c.clock.elapsed);
    c.clock.advanceTo(until);
    assert.equal(c.cave.lastDrawingWork.kind, kind);
    assert.ok(
      !c.game.drainEffects().some((e) => e.type === "sound" && e.id === 0x53),
    );
  }
  c.clock.advanceTo(c.game.nextSimulationWake());
  assert.ok(
    c.game.drainEffects().some((e) => e.type === "sound" && e.id === 0x53),
  );
  assert.equal(c.cave.audioBusy, null); // Unknown until the actual device ACK.
});
