// Carried initial segment with explicit CPU-work clock and no input reads.
// Not a native whole-entry timing comparison or complete expedition replay.
import assert from "node:assert/strict";
import { originalGame } from "../tests/helpers/original-game.js";
import { Cave } from "../src/game/cave.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
const { image, archives } = await originalGame();
const resources = { image, entries: archives.get("EXP.ARC"), mapEntries: archives.get("CAVEMAPS.ARC"),
  maps: parseCaveMaps(archives.get("CAVEMAPS.ARC")) };
const base = [17, 4, 5, 6, 3, 22, 23, 26, 37, 38, 39, 40, 41, 42, 43, 14];
const cases = [];
for (const currentDrive of [2, 0]) for (let variant = 0; variant < 8; variant++) {
  let now = 0;
  const cave = new Cave({ ...resources, variant, currentDrive, difficulty: 0, seed: 0, money: 0,
    clock: () => now, readInput: () => { throw Error("Unexpected initial input consumption"); } });
  assert.ok(cave.snapshot().rooms.every(cell => cell === 0));
  assert.equal(cave.initialDrawingWork, null);
  const loads = [];
  for (let step = 0; step < 32 && !cave.presentationTransition; step++) {
    assert.equal(cave.wait.clock, "graphics");
    assert.equal(cave.inputs.length, 0);
    assert.equal(cave.memory.i(0x2229), 0, "Initial RNG ran before minimap completion");
    if (!cave.initialDrawingWork) loads.push([cave.lastLoadingWork.archive, cave.lastLoadingWork.resource]);
    assert.ok(cave.wait.until > now && Number.isFinite(cave.wait.until));
    now = cave.wait.until;
    cave.advanceGraphics();
  }
  assert.deepEqual(loads, [["CAVEMAPS.ARC", variant], ...[base[0],
    ...(currentDrive < 2 ? [18, 19, 20, 21] : []), ...base.slice(1)].map(id => ["EXP.ARC", id])]);
  assert.deepEqual(cave.presentationTransition, { kind: "wipe", band: 0 });
  assert.deepEqual(cave.snapshot().rooms, [...resources.maps[variant]]);
  const start = [...resources.maps[variant]].findIndex(cell => cell & 16 && !(cell & 32));
  const goal = [...resources.maps[variant]].findIndex(cell => cell & 32);
  let seed = 0, enemy;
  do {
    const sum = (seed + 0x9248) % 65536;
    seed = (sum >>> 3) + (sum % 8) * 8192;
    enemy = seed % 64;
  } while (enemy === start);
  assert.deepEqual([cave.room, cave.snapshot().goal, cave.snapshot().enemy, cave.memory.i(0x2229) & 65535],
    [start, goal, enemy, seed]);
  assert.deepEqual([cave.memory.i(0x79de), cave.memory.i(0x79e0)], [82, 38]);
  assert.equal(cave.inputs.length, 0);
  cases.push({ currentDrive, variant, loads: loads.length, accountedMilliseconds: now });
}
assert.equal(cases.length, 16);
const options = { ...resources, variant: 0, difficulty: 0, seed: 0, money: 0 };
assert.throws(() => new Cave({ ...options, mapEntries: undefined }), /Missing supported cave resources/);
const wrong = resources.maps.map(cells => Uint16Array.from(cells)); wrong[0][0] ^= 1;
assert.throws(() => new Cave({ ...options, maps: wrong }), /map table differs/);
console.log(JSON.stringify({ kind: "carried-cave-initialization", cases, executedCases: 16, negatives: 2,
  nativeTimingAccepted: false, wholeExpeditionAccepted: false }, null, 2));
