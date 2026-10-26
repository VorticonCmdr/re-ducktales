import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import { sampleJungleControls } from "../src/game/jungle-controls.js";
import {
  jungleVineReach,
  queryJunglePlatform,
  collideJungleGround,
  findJungleFishSupport,
} from "../src/game/jungle-collision.js";
import {
  rememberJungleActor,
  composeJungleActor,
} from "../src/game/jungle-animation.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const WORDS = [
  0x5f44, 0x3746, 0x6882, 0x3d12, 0x544c, 0x5462, 0x88ac, 0x88ae, 0x7164,
  0x8b56, 0x4cf0, 0x6d9a, 0x797a, 0x5f46, 0x6858, 0x8d64, 0x8924, 0x7166,
  0x8e26,
];
function decode(raw, ip) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, 2);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual(
    [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
    [0xe0c, ip, 0x1403, 0x1403],
  );
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes };
}
export async function verifyJungleControls(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-controls.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 7);
  assert.equal(manifest.expectedCheckpointCount, 7);
  assert.equal(manifest.expectedInputCount, 7);
  assert.equal(manifest.inputEvents.length, 7);
  assert.deepEqual(
    manifest.inputEvents.map((e) => e.byte),
    [0, 3, 7, 1, 5, 192, 195],
  );
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      artifact.sha256,
      `corrupt ${artifact.path}`,
    );
    local[key] = JSON.parse(bytes);
  }
  assert.equal(Object.keys(local).length, 14, "missing control artifact");
  function compare({
    omitRight = false,
    alterResult = false,
    alterMatrix = false,
    omitCase = false,
  } = {}) {
    let executed = 0,
      rendered = 0;
    const cache = new WeakMap();
    for (const event of manifest.inputEvents) {
      if (omitCase && event.case === "03") continue;
      const before = decode(local[event.case + "-before"], 0x680),
        after = decode(local[event.case + "-after"], 0xaa9);
      assert.equal(
        before.cpu.eax & 255,
        event.byte,
        "independent AL/input disagreement",
      );
      assert.equal(before.cpu.ebp, after.cpu.ebp);
      const m = new FlightMemory(before.bytes);
      let flushed = 0;
      sampleJungleControls(
        m,
        omitRight && event.case === "01" ? 0 : event.byte,
        { flushInput: () => flushed++ },
      );
      if (alterResult && event.case === "02") after.bytes[0x5f46] ^= 1;
      if (alterMatrix && event.case === "01") m.bytes[0x276c] ^= 1;
      for (const at of WORDS)
        assert.equal(
          m.i(at),
          after.bytes.readInt16LE(at),
          `${event.case} DS:${at.toString(16)} control divergence`,
        );
      assert.deepEqual(
        Buffer.from(m.bytes.subarray(0x276c, 0x27ec)),
        after.bytes.subarray(0x276c, 0x27ec),
        "key matrix divergence",
      );
      assert.equal(flushed, 1, "unconsumed BIOS flush request");
      const sprite = m.view.getUint16(0x797a, true);
      assert.equal(
        m.b(sprite + 18),
        after.bytes[sprite + 18],
        "sprite frame divergence",
      );
      rememberJungleActor(m);
      const assets = new Map(
        [
          [0x957e, 0],
          [0x9762, 5],
          [0x5f2c, 6],
          [0x5f90, 17],
        ].map(([at, id]) => [m.view.getUint16(at, true), id]),
      );
      renderFlightPixels(
        composeJungleActor(m, assets),
        resources.entries,
        resources.mainEntries[42].data,
        "JG.ARC",
        cache,
      );
      executed++;
      rendered++;
    }
    assert.equal(executed, 7, "unfinished control sequence");
    assert.equal(rendered, 7, "unrendered control pose");
  }
  compare();
  assert.throws(() => compare({ omitRight: true }), /control divergence/);
  assert.throws(() => compare({ alterResult: true }), /control divergence/);
  assert.throws(() => compare({ alterMatrix: true }), /key matrix divergence/);
  assert.throws(
    () => compare({ omitCase: true }),
    /unfinished control sequence/,
  );

  // Independent authored boundary checks below are static-rule evidence;
  // these altered initial states are not original runtime comparisons.
  const fresh = () => new FlightMemory(decode(local["01-before"], 0x680).bytes);
  const cooldown = fresh();
  cooldown.i(0x3746, 2);
  cooldown.b(0x276c, 17);
  let flushes = 0;
  sampleJungleControls(cooldown, 3, { flushInput: () => flushes++ });
  assert.equal(cooldown.i(0x3746), 1);
  assert.equal(cooldown.b(0x276c), 17);
  assert.equal(flushes, 0);
  const chord = fresh(),
    idle = chord.i(0x88ac);
  sampleJungleControls(chord, 195);
  assert.equal(chord.i(0x6882), 5);
  assert.equal(chord.i(0x88ac), ((idle + 1) << 16) >> 16);
  const grid = fresh();
  grid.i(0x544c, 0);
  grid.i(0x5462, 0);
  assert.deepEqual(queryJunglePlatform(grid, 1, 3), { column: 1, row: 1 });
  assert.equal(queryJunglePlatform(grid, 2, 2), null);
  const vine = fresh();
  vine.b(0x8990, 0);
  vine.i(0x5d52 + 34, 0);
  vine.i(0x5d54 + 34, 0);
  assert.equal(jungleVineReach(vine, 1, 0, 0, 256), true);
  assert.equal(jungleVineReach(vine, 1, 32, 0, 256), false);
  assert.equal(
    jungleVineReach(vine, 1, -32768, -32768, 256),
    true,
    "original signed-high-word distance overflow",
  );
  const pickup = fresh();
  pickup.i(0x544c, 0);
  pickup.i(0x5462, 0);
  pickup.i(0x5f46, 16);
  pickup.i(0x6858, 16);
  pickup.i(0x3d12, 1);
  pickup.i(0x6882, 5);
  pickup.i(0x8924, 0);
  const id = pickup.i(0x95ea);
  assert.notEqual(id, 0);
  pickup.i(0x8c30 + id * 2, 1);
  pickup.view.setUint32(0x8cc0, 0xfffffff0, true);
  collideJungleGround(pickup);
  assert.equal(pickup.view.getUint32(0x8cc0, true), 34);
  collideJungleGround(pickup);
  assert.equal(
    pickup.view.getUint32(0x8cc0, true),
    34,
    "pickup must not repeat",
  );
  const fish = fresh();
  fish.i(0x882c, 16);
  fish.i(0x778c, 15);
  fish.i(0x6950, 0);
  fish.i(0x5f46, 40);
  fish.i(0x3d12, 1);
  fish.i(0x514e, 1);
  fish.i(0x5156, 0);
  fish.i(0x5158, 4);
  fish.i(0x5152, 80);
  assert.equal(
    findJungleFishSupport(fish, 60),
    0,
    "fish zero is a valid query result",
  );
  assert.throws(
    () => sampleJungleControls(fresh(), 256),
    /Invalid jungle joystick/,
  );
  console.log(
    "Jungle controls: 7 conditional original checkpoints/consumed joystick bytes and7 decoded poses;4 negative controls. Additional cooldown,chord,grid,vine-overflow,pickup-wrap/revisit and fish-zero checks are authored static-rule evidence. No full gameplay/browser/timing parity claimed.",
  );
}
