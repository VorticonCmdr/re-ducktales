import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive, EGA } from "../src/assets.js";
import { decodeFlightSprite } from "../src/game/flight-flag-raster.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/flight-flag-alias.json"));
const build = JSON.parse(await readFile(manifest.buildManifest));
assert.deepEqual(manifest.inputs, {
  asset: 58, frame: 255, x: 310, y: 116, neighborAsset: 61, neighborOffset: 1104,
}, "Unsupported conditional input contract");
async function original(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(
    hash(b),
    build.files[name].sha256,
    `Unsupported original ${name}`,
  );
  return b;
}
async function artifact(key) {
  const spec = manifest.artifacts[key];
  assert.ok(spec, `Missing required artifact ${key}`);
  const b = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing ${spec.path}; see docs/flight-flag-alias.md`);
  });
  assert.equal(hash(b), spec.sha256, `Corrupt capture ${key}`);
  return JSON.parse(b);
}
function response(r) {
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
function batch(r) {
  const v = response(r);
  assert.equal(v.aborted, false);
  assert.ok(v.results.length > 0);
  assert.ok(v.results.every((x) => x.status === "ok"));
  return v.results;
}
const entries = parseArchive(await original("PLANE.ARC")),
  driver = parseArchive(await original("IT.DRV"))[1].data,
  poolCapture = await artifact("pool"),
  pool = Buffer.from(response(poolCapture.pool).data, "base64"),
  blit = await artifact("blit"),
  before = batch(blit.before),
  after = batch(blit.after);
assert.equal(manifest.expectedCheckpointCount, 3);
assert.equal(pool.length, 11344);
const flagDescriptor = response(poolCapture.flagDescriptor).words,
  planeDescriptor = response(poolCapture.planeDescriptor).words;
assert.deepEqual(flagDescriptor.slice(2, 7), [3, 24, 9, 24, 0]);
assert.deepEqual(planeDescriptor.slice(2, 7), [4, 32, 64, 32, 0]);
assert.equal((planeDescriptor[7] - flagDescriptor[7]) * 16, 1104);
let checked = 0;
for (const [id, offset] of [
  [58, 0],
  [61, 1104],
]) {
  const decoded = Buffer.from(decodeFlightSprite(entries[id]));
  assert.deepEqual(
    decoded,
    pool.subarray(offset, offset + decoded.length),
    `Native decoded resource${id}`,
  );
  checked++;
}
assert.equal(before[0].registers.cs, 11991);
assert.equal(before[0].registers.eip, 0x373);
assert.equal(after[0].registers.cs, 11991);
assert.equal(after[0].registers.eip, 0x50c);
assert.deepEqual(
  Buffer.from(before[2].data, "base64"),
  Buffer.from(driver.subarray(0x35d, 0x515)),
  "Live EGA blitter bytes",
);
const planes = (r) =>
  r
    .filter((x) => x.op === "mem_read" && x.addr === 0xa0000)
    .map((x) => Buffer.from(x.data, "base64"));
const initial = planes(before),
  expected = planes(after);
assert.equal(initial.length, 4);
assert.equal(expected.length, 4);
for (const b of [...initial, ...expected]) assert.equal(b.length, 16384);
const commands = [];
for (let y = 0; y < 200; y++)
  for (let x = 0; x < 320; x++) {
    let color = 0;
    for (let p = 0; p < 4; p++)
      if (initial[p][8192 + y * 40 + (x >> 3)] & (128 >> (x & 7)))
        color |= 1 << p;
    commands.push({ op: "fill", x, y, width: 1, height: 1, color });
  }
function compare(frame, expectedPlanes = expected) {
  const pixels = renderFlightPixels(
    [...commands, { op: "sprite", asset: 58, frame, x: 310, y: 116 }],
    entries,
  );
  const actual = initial.map((b) => Buffer.from(b));
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 320; x++) {
      const at = (y * 320 + x) * 4;
      const color = EGA.findIndex((c) =>
        c.every((v, i) => v === pixels[at + i]),
      );
      assert.ok(color >= 0, "Non-EGA rendered color");
      const address = 8192 + y * 40 + (x >> 3),
        bit = 128 >> (x & 7);
      for (let p = 0; p < 4; p++)
        actual[p][address] =
          (actual[p][address] & ~bit) | (color & (1 << p) ? bit : 0);
    }
  for (let p = 0; p < 4; p++)
    assert.deepEqual(actual[p], expectedPlanes[p], `Native VGA plane${p}`);
}
compare(255);
checked++;
assert.ok(
  initial.some((b, p) => !b.equals(expected[p])),
  "Vacuous unchanged capture",
);
assert.throws(() => compare(0), /Native VGA plane/);
const corrupted = expected.map((b) => Buffer.from(b));
corrupted[0][0] ^= 1;
assert.throws(() => compare(255, corrupted), /Native VGA plane/);
assert.throws(
  () =>
    renderFlightPixels(
      [{ op: "sprite", asset: 58, frame: 254, x: 310, y: 116 }],
      entries,
    ),
  /Unsupported flight animation frame/,
);
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  "Flight flag alias: 2 exact native decoded buffers, 1 conditional original blit (all65536 VGA bytes), 3 negative controls. No full campaign parity claimed.",
);
