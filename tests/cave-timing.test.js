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
  mapEntries: parseArchive(original("CAVEMAPS.ARC")),
  currentDrive: 0,
};
const locations = parseLocations(parseArchive(original("LOC.ARC"))),
  loot = parseLoot(parseArchive(original("LOOT.ARC")));
function fresh({ origin = 0, audioEnabled = false, currentDrive = 0 } = {}) {
  const game = new Game({
    locations,
    loot,
    expeditionResources: { ...resources, currentDrive },
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
function reachMinimap(c) {
  for (let i = 0; i < 5000 && !c.cave.initialDrawingWork; i++) next(c);
  assert.equal(
    c.cave.lastDrawingWork.kind,
    "initial-minimap",
    "Unfinished initial resource sequence",
  );
}
test("cave drawing completes at its source budget before the following retrace", () => {
  const entry = fresh({ origin: 37 });
  reachMinimap(entry);
  const { game, clock, cave } = entry;
  assert.equal(cave.lastDrawingWork.kind, "initial-minimap");
  assert.equal(cave.initialDrawingWork.minimapPoints, 776);
  let completion = clock.elapsed + cave.initialDrawingWork.milliseconds;
  clock.advanceTo(37 + completion - 0.001);
  assert.equal(cave.wait.clock, "graphics");
  assert.equal(cave.presentations, 0);
  clock.advanceTo(37 + completion);
  assert.equal(cave.presentationTransition.kind, "wipe");
  assert.deepEqual(cave.wait, { clock: "retrace", remaining: 5 });
  const beforeWipes = cave.retrace;
  for (let i = 0; i < 200 && cave.lastLoadingWork?.resource !== 0; i++)
    next(entry);
  assert.equal(cave.lastLoadingWork?.resource, 0);
  assert.equal(cave.retrace - beforeWipes, 50);
  assert.equal(cave.presentations, 10);
  assert.equal(cave.lastLoadingWork.milliseconds, 1149.859);
  assert.equal(cave.inputs.length, 0);
  for (let i = 0; i < 1000 && cave.lastDrawingWork.kind !== "room"; i++)
    next(entry);
  assert.equal(cave.lastDrawingWork.kind, "room");
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
  for (
    let i = 0;
    i < 500 && cave.presentationTransition?.kind !== "reveal";
    i++
  )
    next(entry);
  assert.equal(cave.presentationTransition?.kind, "reveal");
  const page = cave.drawIndex,
    memory = cave.memory.bytes.slice(),
    retrace = cave.retrace;
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
  for (let at = 8; at < 8000; at += 8) fine.clock.advanceTo(at);
  fine.clock.advanceTo(8000);
  coarse.clock.advanceTo(8000);
  assert.ok(fine.cave.snapshot().inputReads > 5);
  assert.deepEqual(state(coarse), state(fine));
  assert.deepEqual(coarse.cave.memory.bytes, fine.cave.memory.bytes);
});
test("hidden-page pause preserves an active cave drawing budget", () => {
  const normal = fresh(),
    paused = fresh();
  const before = normal.cave.wait.until / 2;
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
  c.clock.enqueue({ type: "restart" }, c.cave.wait.until / 2);
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
  assert.equal(c.cave.lastLoadingWork.resource, 46);
  assert.equal(c.cave.lastDrawingWork.kind, "load");
  assert.ok(
    !c.game.drainEffects().some((e) => e.type === "sound" && e.id === 0x53),
  );
  // Captor load,first overwritten party,load29,second party,sprite draw.
  for (const kind of ["party", "load", "party", "sprite"]) {
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
test("initial cave wipe stops sound before publication and flushes unread controls after completion", () => {
  const c = fresh({ audioEnabled: true });
  reachMinimap(c);
  let flushes = 0;
  const original = c.cave.onFlushInput;
  c.cave.onFlushInput = () => {
    flushes++;
    original();
  };
  assert.equal(
    c.game.drainEffects().filter((e) => e.type === "sound" && e.id === 0)
      .length,
    0,
  );
  c.clock.advanceTo(c.clock.elapsed + c.cave.initialDrawingWork.milliseconds);
  assert.deepEqual(c.cave.presentationTransition, { kind: "wipe", band: 0 });
  assert.equal(
    c.game.drainEffects().filter((e) => e.type === "sound" && e.id === 0)
      .length,
    1,
  );
  assert.equal(flushes, 0);
  c.cave.setControls({ direction: "right", fire: true });
  for (let i = 0; i < 200 && c.cave.wipeToken === 1; i++) next(c);
  assert.equal(c.cave.wipeToken, 2);
  assert.equal(flushes, 1);
  assert.deepEqual(c.cave.controls, { direction: null, fire: false });
  assert.equal(c.cave.inputs.length, 0);
});
test("isolated torch replacement selects the new descriptor before its loading wait", () => {
  // Conditional mechanic fixture,not an independent campaign/native replay.
  for (const [old, target] of [
    [14, 15],
    [15, 16],
  ]) {
    const c = fresh(),
      m = c.cave.memory,
      limit = 64;
    m.i(0x54ac, limit);
    m.i(0x8b3e, 16); // Declared Easy threshold fixture.
    m.i(0x4e28, old);
    m.b(0x8b54, target === 15 ? limit >> 1 : limit - m.i(0x8b3e));
    const operation = c.cave.updateTorch(),
      first = operation.next();
    assert.equal(first.done, false);
    assert.equal(first.value.clock, "graphics");
    assert.equal(m.i(0x4e28), target);
    assert.equal(c.cave.lastLoadingWork.resource, target);
    assert.equal(c.cave.inputs.length, 0);
    operation.return();
  }
});
test("initial map,sprites,coordinates,minimap and enemy RNG advance at original boundaries", () => {
  for (const currentDrive of [2, 0]) {
    const c = fresh({ currentDrive }),
      m = c.cave.memory;
    assert.equal(c.cave.lastLoadingWork.scope, "resident-lzw-byte-output");
    assert.equal(c.cave.lastLoadingWork.resource, 0);
    assert.equal(c.cave.initialDrawingWork, null);
    assert.ok(c.cave.snapshot().rooms.every((value) => value === 0));
    const loads = [];
    for (let i = 0; i < 32 && !c.cave.initialDrawingWork; i++) {
      const load = c.cave.lastLoadingWork;
      loads.push([
        load.scope === "resident-lzw-byte-output" ? "map" : "sprite",
        load.resource,
      ]);
      assert.equal(c.cave.inputs.length, 0);
      assert.equal(m.i(0x2229), 0, "enemy RNG advanced before minimap work");
      assert.equal(c.cave.current, null);
      if (load.scope !== "resident-lzw-byte-output")
        assert.deepEqual(c.cave.snapshot().rooms, [...resources.maps[0]]);
      if (load.resource === 17 && load.scope !== "resident-lzw-byte-output")
        assert.deepEqual(
          [m.i(0x79de), m.i(0x79e0)],
          [0, 0],
          "caller coordinates preceded load return",
        );
      c.clock.advanceTo(c.game.nextSimulationWake());
    }
    assert.deepEqual(loads, [
      ["map", 0],
      ...[
        17,
        ...(currentDrive < 2 ? [18, 19, 20, 21] : []),
        4,
        5,
        6,
        3,
        22,
        23,
        26,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        14,
      ].map((id) => ["sprite", id]),
    ]);
    assert.equal(c.cave.lastDrawingWork.kind, "initial-minimap");
    assert.deepEqual([m.i(0x79de), m.i(0x79e0)], [82, 38]);
    assert.equal(m.i(0x2229), 0);
    c.clock.advanceTo(c.game.nextSimulationWake());
    assert.deepEqual(
      [c.cave.room, c.cave.snapshot().enemy, m.i(0x2229)],
      [17, 9, 0x1249],
    );
    assert.deepEqual(c.cave.presentationTransition, { kind: "wipe", band: 0 });
  }
});
