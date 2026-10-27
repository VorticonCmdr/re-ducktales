import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { prepareFlightCourse } from "../src/game/flight-setup.js";
import { advanceFlightScene } from "../src/game/flight-scene.js";
import { tileObjects } from "../src/game/flight-objects.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import build from "../reference/build.json" with { type: "json" };
import edge from "../reference/flight-left-edge.json" with { type: "json" };

async function supported(name) {
  const bytes = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}; see docs/flight.md`);
  });
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    build.files[name].sha256,
    `corrupt ${name}`,
  );
  assert.equal(bytes.length, build.files[name].bytes);
  return bytes;
}
const exe = await supported("DUCKTALE.EXE");
const image = unpackImage(exe),
  entries = parseArchive(await supported("PLANE.ARC")),
  font = parseArchive(await supported("MAIN.ARC"))[42].data;
function course(scroll, racing = false) {
  const c = prepareFlightCourse({
    image,
    entries,
    days: 1,
    racing,
    difficulty: 0,
    seed: 1960,
    day: 1,
  });
  c.memory.i(0x5ed6, scroll);
  c.memory.f(0x6d18, 10);
  c.memory.f(0x6d3e, 100);
  return c;
}

test("zero-width preceding flight strip reads no terrain or objects and keeps rival advancement", () => {
  // Literal source instructions, not values generated from the port. Overlay4
  // 1010 tests width before loading terrain; object loops zero-extend the byte.
  const body = 0x12c00 + 1024;
  assert.equal(
    exe.subarray(body + 0x1010, body + 0x101b).toString("hex"),
    "837efc007e4a8b5eea8b37",
  );
  for (const [at, hex] of [
    [0x10f9, "8a072ae43b46ec"],
    [0x197f, "8a072ae43b4606"],
    [0x2322, "8a072ae43b4606"],
  ])
    assert.equal(exe.subarray(body + at, body + at + 7).toString("hex"), hex);
  let executed = 0;
  for (const racing of [false, true])
    for (let scroll = -1; scroll >= -7; scroll--) {
      const c = course(scroll, racing),
        base = course(0, racing),
        m = c.memory;
      const i = m.i.bind(m);
      m.i = (at, value) => {
        if (value === undefined && [0x4f3e, 0x4f40].includes(at))
          throw Error("empty strip pointer read");
        return i(at, value);
      };
      assert.deepEqual([...tileObjects(m, -1)], []);
      const commands = advanceFlightScene(m, c),
        baseline = advanceFlightScene(base.memory, base);
      if (!racing) assert.deepEqual(commands, baseline);
      else
        assert.equal(
          m.i(0x4d4c),
          base.memory.i(0x4d4c) + 2,
          "empty strip still advances rival",
        );
      assert.equal(renderFlightPixels(commands, entries, font).length, 256000);
      executed++;
    }
  assert.equal(executed, 14);
  assert.equal(executed, edge.expectedCaseCount);
});

test("visible preceding flight strip and other unsupported terrain remain strict", () => {
  const c = course(-8);
  assert.throws(
    () => advanceFlightScene(c.memory, c),
    /Unsupported terrain drawing tile -1/,
  );
  assert.throws(
    () => [...tileObjects(c.memory, -2)],
    /Unsupported flight tile -2/,
  );
  const bad = course(0);
  bad.memory.i(0x4f42, 17);
  assert.throws(
    () => advanceFlightScene(bad.memory, bad),
    /Unsupported terrain asset 17/,
  );
});
