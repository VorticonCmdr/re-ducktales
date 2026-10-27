import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { advanceRival } from "../src/game/rival.js";
import { parseArchive, imagePixels } from "../src/assets.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/rival.json", "utf8"));
assert.equal(manifest.expectedCheckpointCount, 9);
assert.equal(Object.keys(manifest.artifacts).length, 17);
const raw = {};
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/rival.md`);
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
const executable = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(executable));
const relocated = Buffer.from(image);
let cursor =
  executable.readUInt16LE(8) * 16 + executable.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = executable.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = region * 65536 + executable.readUInt16LE(cursor);
    relocated.writeUInt16LE((relocated.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
}
const identity = capture(raw.inactiveBefore, 3, 0x4608);
assert.equal(identity.results[2].addr, 0x4608);
sameBytes(
  Buffer.from(identity.results[2].data, "base64"),
  relocated.subarray(0x26b8, 0x26b8 + 1275),
  "rival relocated code",
);

// Decode incoming resource pointers, never reconstruct inputs from the outcome.
function state(m) {
  const loot = [];
  const locations = Array.from({ length: 35 }, (_, i) => {
    const p = m.readUInt16LE(0x4e2a + i * 8),
      l = m.readUInt16LE(0x4e2c + i * 8);
    assert.ok(p >= 0x71f6 && p + 40 <= 65536, `location pointer ${i}`);
    assert.ok(l >= 0x6f52 && l + 4 <= 65536, `loot pointer ${i}`);
    loot.push({ value: m.readInt16LE(l + 2) });
    return {
      x: m.readInt16LE(p + 32),
      y: m.readInt16LE(p + 34),
      treasure: i + 1,
      playerCollected: !!m[0x4e30 + i * 8],
      rivalCollected: !!m[0x4e31 + i * 8],
    };
  });
  return {
    day: m[0x4e0e],
    difficulty: m[0x8990],
    unlockMask: m[0x96ba],
    seed: m.readUInt16LE(0x2229),
    rival: {
      day: m[0x715e],
      location: m[0x581],
      money: m.readUInt32LE(0x4e0a),
      banked: m.readUInt32LE(0x54f2),
    },
    locations,
    loot,
  };
}
let checked = 0;
function compare(name, negative = null) {
  const before = capture(
    raw[`${name}Before`],
    name === "inactive" ? 3 : 2,
    0x4608,
  );
  // Nearest was observed in the subsequent bin animation, not at routine return.
  // This case is conditional evidence only; all compared fields and RNG are exact.
  const after = capture(
    raw[`${name}After`],
    2,
    name === "nearest" ? 0x6e1b : 0x4928,
  );
  assert.equal(
    before.m.i(before.cpu.esp + 4),
    0,
    "normal rival entry argument",
  );
  const b = state(before.bytes),
    expected = state(after.bytes);
  if (negative === "remove-unlock") b.unlockMask = 0;
  const result = advanceRival(b);
  b.seed = result.seed;
  for (const at of [0x4e0e, 0x8990, 0x96ba])
    assert.equal(
      after.bytes[at],
      before.bytes[at],
      `${name} preserves player setup ${at.toString(16)}`,
    );
  for (const at of [0x8cc0, 0x5ae2])
    assert.equal(
      after.bytes.readUInt32LE(at),
      before.bytes.readUInt32LE(at),
      `${name} preserves player account ${at.toString(16)}`,
    );
  if (negative === "alter-money") b.rival.money++;
  assert.equal(b.seed, expected.seed, `${name} RNG`);
  assert.deepEqual(b.rival, expected.rival, `${name} rival fields`);
  for (let i = 0; i < 35; i++) {
    assert.equal(
      b.locations[i].playerCollected,
      expected.locations[i].playerCollected,
      `${name} player flag ${i}`,
    );
    assert.equal(
      b.locations[i].rivalCollected,
      expected.locations[i].rivalCollected,
      `${name} rival flag ${i}`,
    );
  }
  assert.equal(
    result.draws,
    { inactive: 0, easy: 2, nearest: 3, bank: 0, value: 3, ratio: 3, loss: 3 }[
      name
    ],
  );
  if (result.acted)
    assert.equal(
      result.target,
      after.bytes[0x358e],
      `${name} chosen destination`,
    );
  if (name === "loss") {
    assert.equal(result.lostCash, true);
    assert.equal(before.bytes.readUInt32LE(0x4e0a), 1000);
    assert.equal(b.rival.money, 8000, "new treasure follows the cash loss");
  }
  return { before, after, result };
}
for (const name of [
  "inactive",
  "easy",
  "nearest",
  "bank",
  "value",
  "ratio",
  "loss",
]) {
  compare(name);
  checked++;
}
assert.throws(() => compare("value", "remove-unlock"), /RNG|rival fields/);
assert.throws(() => compare("bank", "alter-money"), /rival fields/);
const report = capture(raw.valueReport, 2, 0x4897),
  value = compare("value");
assert.equal(
  report.bytes[0x581],
  value.before.bytes[0x581],
  "location changes after the report",
);
assert.equal(report.bytes[0x358e], value.result.target);
assert.equal(report.bytes.readUInt16LE(0x2229), value.result.seed);
assert.equal(
  report.bytes.readUInt32LE(0x4e0a),
  value.after.bytes.readUInt32LE(0x4e0a),
);
checked++;

const entries = parseArchive(files["MAIN.ARC"]),
  pixels = Uint8Array.from(imagePixels(entries[33]));
const font = entries[42].data;
function text(s, x, y) {
  for (const c of s) {
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++)
        if (font[8 + c.charCodeAt(0) * 8 + row] & (128 >> col))
          pixels.set([255, 255, 255, 255], ((y + row) * 320 + x + col) * 4);
    x += 8;
  }
}
const speech = value.result.report.variant ? [0x52c, 0x538] : [0x541, 0x552];
for (const [at, y] of [
  [speech[0], 60],
  [speech[1], 76],
  [0x562, 100],
  [0x571, 116],
])
  text(executableText(image, at), 168, y);
const p = value.before.bytes.readUInt16LE(0x4e2a + value.result.target * 8);
const end = value.before.bytes.indexOf(0, p);
assert.ok(end > p && end < p + 32);
const name = value.before.bytes.toString("ascii", p, end);
text(name, 224 - name.length * 4, 132);
text(executableText(image, 0x57f), 224 + name.length * 4, 132);
const png = PNG.sync.read(raw.reportPNG);
assert.deepEqual([png.width, png.height], [320, 200]);
sameBytes(png.data, pixels, "rival report RGBA");
const corrupted = Uint8Array.from(pixels);
corrupted[0] ^= 1;
assert.throws(
  () => sameBytes(png.data, corrupted, "negative rival pixel"),
  /negative rival pixel/,
);
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  `Rival: ${checked} conditional original checks, relocated code identity, exact report pixels and negative controls passed. Campaign integration is separate.`,
);
