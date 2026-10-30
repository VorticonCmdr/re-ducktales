import { verifyCaveRuntime } from "./verify-cave-runtime.js";
import { verifyCaveRoutes } from "./verify-cave-routes.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { Cave } from "../src/game/cave.js";
import { parseCaveMaps, CAVE_SPRITES } from "../src/game/cave-scene.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
function capture(raw, ip, count) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const c = r.results[0].registers;
  assert.deepEqual([c.cs, c.eip, c.ds, c.ss], [0xe0c, ip, 0x1403, 0x1403]);
  return new FlightMemory(Buffer.from(r.results[1].data, "base64"));
}
export function compareCave(
  local,
  resources,
  { alterTorch = false, alterMap = false } = {},
) {
  const initial = capture(local.entry, 0, 3),
    expected = capture(local.scene, 0x5ed, 2);
  const cpu = JSON.parse(local.entry.content[0].text).results[0].registers;
  assert.equal(
    initial.view.getUint16(cpu.esp + 4, true),
    7,
    "unexpected cave variant argument",
  );
  const original = Buffer.from(
    JSON.parse(local.entry.content[0].text).results[2].data,
    "base64",
  );
  assert.equal(
    original.subarray(0, 16).toString("hex"),
    "558becb886009a9e1e030656c646f200",
  );
  const cave = new Cave(
    {
      ...resources,
      variant: 7,
      difficulty: initial.b(0x8990),
      seed: initial.view.getUint16(0x2229, true),
      money: initial.view.getUint32(0x8cc0, true),
    },
    initial,
  );
  assert.equal(cave.phase, "entering");
  assert.equal(
    cave.inputs.length,
    0,
    "unexpected input consumption before first scene",
  );
  // Align with the original after-party boundary; instruction work precedes
  // the first pending page and is not supplied by an expected timer value.
  for (let i = 0; i < 500 && !cave.pending; i++) cave.advanceTick();
  assert.ok(cave.pending, "unfinished first cave party draw");
  assert.deepEqual(cave.wait, { clock: "retrace", remaining: 1 });
  const m = cave.memory;
  if (alterTorch) m.b(0x6d44, m.b(0x6d44) ^ 1);
  if (alterMap) m.i(0x5a42, m.i(0x5a42) ^ 1);
  for (const [at, length] of [
    [0x2229, 2],
    [0x5a42, 128],
    [0x4d32, 2],
    [0x97b0, 2],
    [0x6810, 2],
    [0x6d44, 1],
    [0x5c74, 1],
    [0x4e08, 2],
    [0x8b54, 1],
    [0x54ac, 2],
    [0x8b3e, 2],
    ...[...CAVE_SPRITES.values()].flatMap((a) => [
      [a, 12],
      [a + 18, 1],
    ]),
  ])
    assert.deepEqual(
      m.bytes.slice(at, at + length),
      expected.bytes.slice(at, at + length),
      `cave divergence at DS:${at.toString(16)}`,
    );
  renderFlightPixels(cave.pending, resources.entries, resources.font); // strict drawing validation; no pixel-reference claim
  return 1;
}
export async function verifyCave() {
  const manifest = JSON.parse(
    await readFile("reference/cave-entry.json", "utf8"),
  );
  assert.equal(manifest.expectedCheckpointCount, 1);
  assert.equal(manifest.expectedInputCount, 0);
  const local = {};
  for (const [k, f] of Object.entries(manifest.artifacts)) {
    const b = await readFile(f.path).catch(() => {
      throw Error(`SETUP: missing ${f.path}; see docs/cave.md`);
    });
    assert.equal(
      createHash("sha256").update(b).digest("hex"),
      f.sha256,
      `corrupt ${f.path}`,
    );
    local[k] = JSON.parse(b);
  }
  const build = JSON.parse(await readFile("reference/build.json", "utf8")),
    raw = {};
  for (const n of ["DUCKTALE.EXE", "EXP.ARC", "CAVEMAPS.ARC", "MAIN.ARC"]) {
    raw[n] = await readFile("game/" + n);
    assert.equal(raw[n].length, build.files[n].bytes);
    assert.equal(
      createHash("sha256").update(raw[n]).digest("hex"),
      build.files[n].sha256,
    );
  }
  const resources = {
    image: unpackImage(raw["DUCKTALE.EXE"]),
    entries: parseArchive(raw["EXP.ARC"], "EXP.ARC"),
    maps: parseCaveMaps(parseArchive(raw["CAVEMAPS.ARC"], "CAVEMAPS.ARC")),
    font: parseArchive(raw["MAIN.ARC"], "MAIN.ARC")[42].data,
  };
  assert.equal(compareCave(local, resources), manifest.expectedCheckpointCount);
  assert.throws(
    () => compareCave(local, resources, { alterTorch: true }),
    /cave divergence/,
  );
  assert.throws(
    () => compareCave(local, resources, { alterMap: true }),
    /cave divergence/,
  );
  assert.throws(() => compareCave({ ...local, scene: null }, resources));
  await verifyCaveRuntime(resources);
  await verifyCaveRoutes(resources);
  console.log(
    "Cave entry: 1 conditional map/actors/torch/RNG/descriptor checkpoint; 3 negative controls. No reference pixel comparison or complete-level replay.",
  );
}
if (process.argv[1]?.endsWith("verify-cave.js")) await verifyCave();
