import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { FLIGHT_SPRITES } from "../src/game/flight-setup.js";
import { advanceFlightScene } from "../src/game/flight-scene.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/flight-visible-left-edge.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const raw = {};
assert.equal(manifest.expectedCaseCount, 1);
assert.equal(manifest.expectedRequiredInputCount, 0);
assert.deepEqual(manifest.inputEvents, []);
assert.equal(Object.keys(manifest.artifacts).length, 13);
for (const [key, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/flight.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[key] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
const files = {};
for (const n of ["DUCKTALE.EXE", "PLANE.ARC", "MAIN.ARC"]) {
  files[n] = await readFile(`game/${n}`);
  assert.equal(hash(files[n]), build.files[n].sha256, `corrupt ${n}`);
  assert.equal(files[n].length, build.files[n].bytes);
}
function capture(r, ip, count) {
  assert.equal(r.isError, false);
  const b = JSON.parse(r.content[0].text);
  assert.equal(b.aborted, false);
  assert.equal(b.results.length, count);
  assert.ok(b.results.every((x) => x.status === "ok"));
  const cpu = b.results[0].registers;
  assert.equal(cpu.cs, 0xe0c);
  assert.equal(cpu.ds, 0x1403);
  assert.equal(cpu.ss, 0x1403);
  assert.equal(cpu.eip, ip);
  const bytes = Buffer.from(b.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: b.results };
}
const entry = capture(raw.entry, 0, 3),
  initial = capture(raw.initial, 0xf78, 3),
  before = capture(raw.before, 0xf78, 2),
  after = capture(raw.after, 0x132f, 3);
capture(raw.present, 0x2a7, 2);
capture(raw.aligned, 0x1330, 2);
const exe = files["DUCKTALE.EXE"],
  overlayAt = 0x12c00;
assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
assert.equal(exe.readUInt16LE(overlayAt + 6), 248);
const body = Buffer.from(
  exe.subarray(overlayAt + 1024, overlayAt + 1024 + 17548),
);
for (let i = 0; i < 248; i++) {
  const p = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4,
    at = (exe.readUInt16LE(p + 2) - 0xc17) * 16 + exe.readUInt16LE(p);
  assert.ok(at >= 0 && at + 2 <= body.length);
  body.writeUInt16LE((body.readUInt16LE(at) + 0x1f5) & 65535, at);
}
const liveEntry = Buffer.from(entry.results[2].data, "base64");
assert.equal(liveEntry.length, 18572);
assert.deepEqual(
  liveEntry.subarray(0, 17548),
  body,
  "actual flight body identity at entry",
);
// This drawing routine has not run before initial. Its instruction bytes still
// match exactly; later INT34..3d hardware-FPU selfpatching is not masked here.
assert.deepEqual(
  Buffer.from(initial.results[2].data, "base64").subarray(0xf78, 0x1330),
  body.subarray(0xf78, 0x1330),
);
assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 3);
assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 6), 1);
assert.equal(before.bytes.readInt16LE(before.cpu.esp + 4), 0x6f3e);
assert.equal(initial.bytes.readInt16LE(0x5ed6), 0);
assert.equal(before.bytes.readInt16LE(0x5ed6), -8);
const adjusted = Buffer.from(initial.bytes);
adjusted.writeInt16LE(-8, 0x5ed6);
assert.deepEqual(
  adjusted,
  before.bytes,
  "camera setup must be the only scene input mutation",
);
assert.equal(before.bytes.readInt16LE(0x4f3e), 0);
const optional = [59, 60];
const context = {
  assets: new Map(
    [...FLIGHT_SPRITES]
      .filter(
        ([id]) =>
          ![29, 30, 31, 40, 41, 42, 43, 59, 60].includes(id) ||
          optional.includes(id),
      )
      .map(([id, at]) => [at, id]),
  ),
  scenery: { picture: before.bytes[0x544a] ? before.bytes[0x544a] + 34 : 28 },
};
assert.equal(before.bytes[0x5ed4], 1);
const ranges = [
  [0x2229, 2],
  [0x0faa, 24],
  [0x36c8, 14],
  [0x8cc0, 4],
  [0x7978, 1],
  [0x4e0e, 1],
  [0x4d4c, 2],
  [0x8d7c, 2],
  [0x5ed6, 2],
  [0x974c, 2],
  [0x5466, 2],
  [0x8a9c, 2],
  [0x6d18, 4],
  [0x6d3e, 4],
  [0x88b0, 2],
  [0x78ea, 2],
  [0x4f3e, 524],
  [0x79f2, 3640],
  ...[...FLIGHT_SPRITES.values()].map((at) => [at, 20]),
];
function compareState(m, expected) {
  for (const [at, len] of ranges)
    assert.deepEqual(
      Buffer.from(m.bytes.slice(at, at + len)),
      expected.subarray(at, at + len),
      `scene state ${at.toString(16)}`,
    );
}
const m = new FlightMemory(before.bytes),
  commands = advanceFlightScene(m, context);
compareState(m, after.bytes);
assert.deepEqual(
  commands.find((c) => c.op === "copy"),
  {
    op: "copy",
    asset: 0,
    sourceX: 72,
    sourceY: 0,
    x: 0,
    y: 160,
    width: 8,
    height: 16,
  },
);
const pixels = Buffer.from(
  renderFlightPixels(
    commands,
    parseArchive(files["PLANE.ARC"]),
    parseArchive(files["MAIN.ARC"])[42].data,
  ),
);
const png = PNG.sync.read(raw.image);
assert.equal(png.width, 320);
assert.equal(png.height, 200);
function comparePixels(a) {
  assert.deepEqual(a, png.data, "original full frame pixels");
}
comparePixels(pixels);
const bad = Buffer.from(after.bytes);
bad[0x4d4c] ^= 1;
assert.throws(() => compareState(m, bad), /scene state/);
const altered = Buffer.from(pixels);
altered[0] ^= 1;
assert.throws(() => comparePixels(altered), /original full frame pixels/);
const wrong = new FlightMemory(before.bytes);
wrong.i(0x4f3e, 17);
assert.throws(
  () => advanceFlightScene(wrong, context),
  /Unsupported terrain asset 17/,
);
console.log(
  "Visible flight left edge: 1 conditional original scene, exact state fields and 320x200 pixels; full entry code identity; 3 negative controls rejected.",
);
