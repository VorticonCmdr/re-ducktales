import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  initializeFlightTerrain,
  generateFlightObjects,
} from "../src/game/flight-course.js";
import {
  prepareFlightCourse,
  selectFlightScenery,
  FLIGHT_SPRITES,
} from "../src/game/flight-setup.js";

function results(raw) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.length > 0);
  assert.ok(r.results.every((x) => x.status === "ok"));
  return r.results;
}
function snapshot(raw, cs, ip, count = 2) {
  const r = results(raw);
  assert.equal(r.length, count);
  assert.equal(r[0].registers.cs, cs);
  assert.equal(r[0].registers.eip, ip);
  assert.equal(r[0].registers.ds, 0x1403);
  const bytes = Buffer.from(r[1].data, "base64");
  assert.equal(bytes.length, 65536, "incomplete course data segment");
  return new FlightMemory(bytes);
}
function equalBytes(m, expected, at, length) {
  assert.deepEqual(
    m.bytes.slice(at, at + length),
    expected.bytes.slice(at, at + length),
    `course divergence at DS:${at.toString(16)}`,
  );
}
function equalRecord(m, expected, index, fields) {
  for (const [offset, length] of fields)
    equalBytes(m, expected, 0x79f2 + index * 14 + offset, length);
}

export function compareFlightCourse(
  manifest,
  local,
  resources,
  { dropDraw = false, alterObject = false } = {},
) {
  assert.equal(manifest.expectedCheckpointCount, 5);
  assert.equal(manifest.cases.length, 2);
  assert.deepEqual(
    manifest.cases.map((c) => c.id),
    ["racing-first-flight", "ordinary-second-flight"],
  );
  let checked = 0;
  const entry = snapshot(local.entry, 0xe0c, 0, 4);
  const terrain = snapshot(local.terrain, 0x10e6, 0x1aa);
  const beforeObjects = snapshot(local.beforeObjects, 0x10e6, 0x929);
  const afterObjects = snapshot(local.afterObjects, 0x10e6, 0x1658);
  const stage = new FlightMemory(entry.bytes);
  // Flight entry copies the race argument before invoking terrain setup.
  const entryStack = Buffer.from(results(local.entry)[3].data, "base64");
  assert.equal(entryStack.length, 8);
  stage.b(0x5ed4, entryStack.readUInt16LE(6));
  assert.equal(initializeFlightTerrain(stage, 1), 54);
  equalBytes(stage, terrain, 0x2229, 2);
  equalBytes(stage, terrain, 0x4f42, 130 * 4);
  for (let i = 0; i < 260; i++)
    equalRecord(stage, terrain, i, [
      [0, 1],
      [12, 1],
    ]);
  checked++;
  assert.deepEqual(selectFlightScenery(stage), {
    picture: 28,
    optional: [40, 41, 42, 43],
    draws: 2,
  });
  for (const at of [0x2229, 0x544a, 0x7180, 0x8c80])
    equalBytes(stage, beforeObjects, at, 2);
  checked++;
  const objectStage = new FlightMemory(beforeObjects.bytes);
  assert.deepEqual(generateFlightObjects(objectStage), {
    draws: 157,
    count: 16,
  });
  equalBytes(objectStage, afterObjects, 0x2229, 2);
  equalBytes(objectStage, afterObjects, 0x4f42, 130 * 4);
  equalBytes(objectStage, afterObjects, 0x79f2, 260 * 14);
  checked++;

  for (const c of manifest.cases) {
    const expected = snapshot(local[c.expected], 0xe0c, 0x1330);
    assert.deepEqual(Object.keys(c.input).sort(), [
      "day",
      "days",
      "difficulty",
      "racing",
      "seed",
    ]);
    if (c.id === "ordinary-second-flight") {
      assert.equal(entry.i(0x2229), c.input.seed);
      const stack = Buffer.from(results(local.entry)[3].data, "base64");
      assert.equal(stack.length, 8);
      assert.equal(stack.readUInt16LE(4), c.input.days);
      assert.equal(stack.readUInt16LE(6), Number(c.input.racing));
    } else {
      const originalEntry = results(local.firstDeparture.entry);
      assert.equal(originalEntry.length, 6);
      const stack = Buffer.from(originalEntry[1].data, "base64");
      assert.equal(stack.length, 8);
      assert.equal(stack.readUInt16LE(4), c.input.days);
      assert.equal(stack.readUInt16LE(6), Number(c.input.racing));
      assert.equal(
        Buffer.from(originalEntry[2].data, "base64").readUInt16LE(),
        c.input.seed,
      );
    }
    const prepared = prepareFlightCourse({ ...resources, ...c.input });
    const m = prepared.memory;
    if (dropDraw && c.id === "ordinary-second-flight") {
      // Deliberately remove one required RNG update from the computed output.
      m.i(0x2229, beforeObjects.i(0x2229));
    }
    if (alterObject && c.id === "racing-first-flight")
      m.i(0x79f6, m.i(0x79f6) + 1);
    assert.equal(prepared.draws, c.draws);
    assert.equal(prepared.objectCount, c.objectCount);
    assert.deepEqual(prepared.scenery, c.scenery);
    equalBytes(m, expected, 0x2229, 2);
    equalBytes(m, expected, 0x4f42, 130 * 4);
    // Setup writes tile/type sentinels for all 260 records. For allocated
    // records it writes y/dimensions/type/variant; x/state/padding are untouched.
    for (let i = 0; i < 260; i++)
      equalRecord(m, expected, i, [
        [0, 1],
        [12, 1],
      ]);
    for (let i = 0; i < c.objectCount; i++)
      equalRecord(m, expected, i, [
        [4, 2],
        [8, 6],
      ]);
    assert.equal(
      expected.b(0x79f2 + c.objectCount * 14),
      255,
      "unexpected extra original object",
    );
    for (const at of [
      0x0fb2, 0x0fb4, 0x0fb9, 0x5466, 0x5ce6, 0x5ed6, 0x8a9c, 0x8d7c, 0x974c,
    ])
      equalBytes(m, expected, at, 2);
    equalBytes(m, expected, 0x5ed4, 1);
    equalBytes(m, expected, 0x4e0e, 1);
    equalBytes(m, expected, 0x8990, 1);
    for (const at of [0x0fae, 0x6d18, 0x6d3e]) equalBytes(m, expected, at, 4);
    equalBytes(m, expected, 0x5516, 128);
    for (const address of prepared.assets.keys()) {
      assert.ok([...FLIGHT_SPRITES.values()].includes(address));
      equalBytes(m, expected, address, 4);
      equalBytes(m, expected, address + 4, 8);
      equalBytes(m, expected, address + 18, 1);
    }
    checked++;
  }
  assert.equal(
    checked,
    manifest.expectedCheckpointCount,
    "unfinished course sequence",
  );
  return checked;
}

export async function verifyFlightCourse() {
  const manifest = JSON.parse(
    await readFile("reference/flight-course.json", "utf8"),
  );
  const local = {};
  for (const [key, a] of Object.entries(manifest.artifacts)) {
    const b = await readFile(a.path).catch(() => {
      throw Error(`SETUP: missing ${a.path}; see docs/flight.md`);
    });
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      a.sha256,
      `corrupt ${a.path}`,
    );
    local[key] = JSON.parse(b);
  }
  const build = JSON.parse(await readFile("reference/build.json", "utf8"));
  const raw = {};
  for (const name of ["DUCKTALE.EXE", "PLANE.ARC"]) {
    const b = await readFile(`game/${name}`);
    assert.equal(b.length, build.files[name].bytes);
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      build.files[name].sha256,
    );
    raw[name] = new Uint8Array(b);
  }
  const resources = {
    image: unpackImage(raw["DUCKTALE.EXE"]),
    entries: parseArchive(raw["PLANE.ARC"], "PLANE.ARC"),
  };
  assert.equal(compareFlightCourse(manifest, local, resources), 5);
  assert.throws(
    () => compareFlightCourse(manifest, local, resources, { dropDraw: true }),
    /course divergence/,
  );
  assert.throws(
    () =>
      compareFlightCourse(manifest, local, resources, { alterObject: true }),
    /course divergence/,
  );
  assert.throws(() =>
    compareFlightCourse({ ...manifest, cases: [] }, local, resources),
  );
  console.log(
    "Flight course: 3 conditional stage + 2 asset-backed setup checkpoints match; 3 negative controls rejected.",
  );
}
if (process.argv[1]?.endsWith("verify-flight-course.js"))
  await verifyFlightCourse();
