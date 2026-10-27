import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive, imagePixels } from "../src/assets.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import {
  atomicRoll,
  misdirectedDestination,
} from "../src/game/atomic-transport.js";
import { travelDays } from "../src/game/campaign.js";
import { u8 } from "../src/game/integer.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/atomic.json", "utf8"));
assert.equal(manifest.expectedCheckpointCount, 5);
assert.equal(Object.keys(manifest.artifacts).length, 10);
const raw = {};
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/atomic-transport.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(raw.mode.isError, false);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
const files = {};
for (const name of ["DUCKTALE.EXE", "MAIN.ARC"]) {
  const b = await readFile(`game/${name}`);
  assert.equal(hash(b), build.files[name].sha256);
  assert.equal(b.length, build.files[name].bytes);
  files[name] = b;
}
const exe = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(exe)),
  relocated = Buffer.from(image);
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = region * 65536 + exe.readUInt16LE(cursor);
    relocated.writeUInt16LE((relocated.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
}
const first = capture(raw.firstBefore, 4, 0x23a4);
assert.equal(first.results[2].addr, 0x23a4);
sameBytes(
  Buffer.from(first.results[2].data, "base64"),
  relocated.subarray(0x454, 0x6b8),
  "atomic resident identity",
);
// Read overlay2 directly from the original appended MZ files; no generated copy
// can supply the expected bytes. Resident fixups use the verified load paragraph.
let offset =
    Math.ceil(
      ((exe.readUInt16LE(4) - 1) * 512 + (exe.readUInt16LE(2) || 512)) / 512,
    ) * 512,
  map;
while (offset < exe.length) {
  assert.equal(exe.readUInt16LE(offset), 0x5a4d);
  const length =
    (exe.readUInt16LE(offset + 4) - 1) * 512 +
    (exe.readUInt16LE(offset + 2) || 512);
  if (exe.readUInt16LE(offset + 26) === 2) {
    const header = exe.readUInt16LE(offset + 8) * 16;
    map = Buffer.from(exe.subarray(offset + header, offset + length));
    const table = offset + exe.readUInt16LE(offset + 24);
    for (let i = 0; i < exe.readUInt16LE(offset + 6); i++) {
      const at =
        exe.readUInt16LE(table + i * 4) +
        16 * exe.readUInt16LE(table + i * 4 + 2) -
        0xc170;
      map.writeUInt16LE((map.readUInt16LE(at) + 0x1f5) & 65535, at);
    }
    break;
  }
  offset = Math.ceil((offset + length) / 512) * 512;
}
assert.ok(map, "missing original map overlay");
assert.equal(first.results[3].addr, 0xe0c0 + 0x1757);
sameBytes(
  Buffer.from(first.results[3].data, "base64"),
  map.subarray(0x1757, 0x1ec8),
  "atomic map selector identity",
);
function locations(m) {
  return Array.from({ length: 35 }, (_, i) => {
    const p = m.readUInt16LE(0x4e2a + i * 8);
    assert.ok(p >= 0x71f6 && p + 40 < 65536);
    return {
      x: m.readInt16LE(p + 32),
      y: m.readInt16LE(p + 34),
      playerCollected: !!m[0x4e30 + i * 8],
      rivalCollected: !!m[0x4e31 + i * 8],
    };
  });
}
let checked = 0;
function compare(name, mutation = null) {
  const b = capture(raw[name + "Before"], name === "first" ? 4 : 2, 0x23a4),
    a = capture(raw[name + "After"], 2, 0x242a);
  assert.equal(b.bytes[0x7900], 1, "atomic choice flag");
  assert.equal(b.bytes[0x8eb4], 1, "atomic unlock flag");
  const target = b.bytes[b.cpu.ebp - 30],
    from = b.bytes[0x5b3c],
    ls = locations(b.bytes);
  const plan = atomicRoll(b.bytes.readUInt16LE(0x2229), b.bytes[0x8990]);
  if (mutation === "drop-draw") plan.seed = b.bytes.readUInt16LE(0x2229);
  let destination = plan.success ? target : misdirectedDestination(ls, target);
  if (mutation === "wrong-target") destination = 34;
  const day = u8(b.bytes[0x4e0e] + travelDays(ls, from, destination));
  assert.equal(a.bytes.readUInt16LE(0x2229), plan.seed, `${name} RNG`);
  assert.equal(a.bytes[0x5b3c], destination, `${name} destination`);
  assert.equal(a.bytes[0x4e0e], day, `${name} calendar`);
  assert.equal(a.bytes[a.cpu.ebp - 30], destination);
  for (const at of [0x8cc0, 0x5ae2, 0x4e0a, 0x54f2])
    assert.equal(
      a.bytes.readUInt32LE(at),
      b.bytes.readUInt32LE(at),
      `${name} preserves accounts`,
    );
  for (let i = 0; i < 35; i++)
    sameBytes(
      a.bytes.subarray(0x4e30 + i * 8, 0x4e32 + i * 8),
      b.bytes.subarray(0x4e30 + i * 8, 0x4e32 + i * 8),
      `${name} collected flags`,
    );
  assert.equal(plan.success, name === "success");
  return { b, a, plan, destination, target, from };
}
for (const name of ["first", "redirect", "success"]) {
  compare(name);
  checked++;
}
assert.throws(() => compare("success", "drop-draw"), /RNG/);
assert.throws(
  () => compare("redirect", "wrong-target"),
  /destination|calendar/,
);
const c = compare("first"),
  report = capture(raw.firstReport, 2, 0x25ce);
assert.equal(
  report.bytes[0x4e0e],
  c.b.bytes[0x4e0e],
  "failed journey day is added after report",
);
assert.equal(report.bytes[0x5b3c], c.from);
assert.equal(report.bytes[report.cpu.ebp - 30], c.destination);
assert.equal(report.bytes.readUInt16LE(0x2229), c.plan.seed);
assert.equal(report.m.i(report.cpu.esp), 60, "report poll count");
checked++;
const entries = parseArchive(files["MAIN.ARC"]),
  pixels = Uint8Array.from(imagePixels(entries[41])),
  font = entries[42].data;
function text(s, x, y) {
  for (const ch of s) {
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++)
        if (font[8 + ch.charCodeAt(0) * 8 + row] & (128 >> col))
          pixels.set([255, 255, 255, 255], ((y + row) * 320 + x + col) * 4);
    x += 8;
  }
}
[0x147, 0x159, 0x166, 0x174].forEach((at, i) =>
  text(executableText(image, at), 168, 60 + i * 16),
);
const p = c.b.bytes.readUInt16LE(0x4e2a + c.destination * 8),
  end = c.b.bytes.indexOf(0, p);
assert.ok(end > p && end < p + 32);
const name = c.b.bytes.toString("ascii", p, end);
text(name, 232 - name.length * 4, 124);
text(executableText(image, 0x184), 232 + name.length * 4, 124);
const png = PNG.sync.read(raw.reportPNG);
assert.deepEqual([png.width, png.height], [320, 200]);
sameBytes(png.data, pixels, "atomic report RGBA");
const corrupted = Uint8Array.from(pixels);
corrupted[0] ^= 1;
assert.throws(
  () => sameBytes(png.data, corrupted, "negative atomic pixel"),
  /negative atomic pixel/,
);
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  `Atomic transport: ${checked} conditional original checks, resident/map code identities, exact report pixels and negative controls passed. Original sound latency and whole-campaign replay are outside this scope.`,
);
