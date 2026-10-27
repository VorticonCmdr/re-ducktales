import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive, imagePixels } from "../src/assets.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import { CampaignEnding } from "../src/game/ending.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/credits.json", "utf8"));
assert.equal(manifest.expectedCheckpointCount, 9);
assert.equal(Object.keys(manifest.artifacts).length, 12);
const raw = {};
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/ending.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
const files = {};
assert.equal(raw.mode.isError, false);
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
for (const name of ["DUCKTALE.EXE", "MAIN.ARC"]) {
  const b = await readFile(`game/${name}`);
  assert.equal(hash(b), build.files[name].sha256);
  assert.equal(b.length, build.files[name].bytes);
  files[name] = b;
}
const exe = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(exe));
const relocated = Buffer.from(image);
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = region * 65536 + exe.readUInt16LE(cursor);
    relocated.writeUInt16LE((relocated.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
}
const before = capture(raw.before, 4, 0x5cc6);
const first = capture(raw.line0, 2, 0x5d36);
const next = capture(raw.line1, 2, 0x5d36);
const last = capture(raw.line25, 2, 0x5d36);
const done = capture(raw.return, 2, 0x5d83);
const farewell = capture(raw.farewell, 3, 0x6004);
let checked = 0;
for (const [c, index, at, len] of [
  [before, 2, 0x3d3e, 249],
  [farewell, 2, 0x3fe8, 260],
]) {
  assert.equal(c.results[index].addr, 0x1f50 + at);
  sameBytes(
    Buffer.from(c.results[index].data, "base64"),
    relocated.subarray(at, at + len),
    "credits relocated code",
  );
  checked++;
}
function preserved(c, corrupt = false) {
  for (const [at, length] of [
    [0x2229, 2],
    [0x8cc0, 4],
    [0x5ae2, 4],
    [0x4e0a, 4],
    [0x54f2, 4],
    [0x4e0e, 1],
    [0x4e28, 280],
  ]) {
    const actual = Buffer.from(c.bytes.subarray(at, at + length));
    if (corrupt && at === 0x2229) actual[0] ^= 1;
    sameBytes(
      actual,
      before.bytes.subarray(at, at + length),
      "credits preserved campaign",
    );
  }
}
for (const [c, line] of [
  [first, 0],
  [next, 1],
  [last, 25],
  [done, 26],
]) {
  preserved(c);
  assert.equal(
    c.bytes.readInt16LE(c.cpu.ebp - 2),
    line,
    "original credit index",
  );
  checked++;
}
preserved(farewell);
assert.throws(() => preserved(last, true), /credits preserved campaign/);
assert.equal(
  next.bytes.readUInt32LE(0x2225) - first.bytes.readUInt32LE(0x2225),
  140,
);
assert.equal(
  done.bytes.readUInt32LE(0x2225) - last.bytes.readUInt32LE(0x2225),
  140,
);
for (const [name, c] of [
  ["line0Visible", first],
  ["line25Visible", last],
]) {
  const aligned = capture(raw[name], 2, 0x3192);
  preserved(aligned);
  assert.equal(
    aligned.bytes.readUInt32LE(0x2225) - c.bytes.readUInt32LE(0x2225),
    7,
    "fixed next input-poll VGA alignment",
  );
  assert.equal(aligned.bytes[0x3be], 0, "captured sound disabled");
}
const entries = parseArchive(files["MAIN.ARC"]),
  font = entries[42].data;
function expected(line) {
  const pixels = imagePixels(entries[line === null ? 0 : 1]);
  if (line === null) return pixels;
  for (let y = 192; y < 200; y++)
    for (let x = 0; x < 320; x++)
      pixels.set([0, 0, 170, 255], (y * 320 + x) * 4);
  let x = 64;
  for (const ch of executableText(image, 0x79e + line * 26)) {
    for (let y = 0; y < 8; y++)
      for (let col = 0; col < 8; col++)
        if (font[8 + ch.charCodeAt(0) * 8 + y] & (128 >> col))
          pixels.set([255, 255, 255, 255], ((192 + y) * 320 + x + col) * 4);
    x += 8;
  }
  return pixels;
}
for (const [name, line] of [
  ["line0PNG", 0],
  ["line25PNG", 25],
  ["farewellPNG", null],
]) {
  const p = PNG.sync.read(raw[name]);
  assert.deepEqual([p.width, p.height], [320, 200]);
  const pixels = expected(line);
  sameBytes(p.data, pixels, `original credits ${name}`);
  const corrupt = Uint8Array.from(pixels);
  corrupt[0] ^= 1;
  assert.throws(
    () => sameBytes(p.data, corrupt, "negative credits pixel"),
    /negative credits pixel/,
  );
  checked++;
}
// Independent state-carrying port boundary replay. Original rendering costs
// and unobserved intervening waits are not fitted into this input stream.
const ending = new CampaignEnding({ day: 1, banked: 0, rivalBanked: 0 });
ending.beginCredits();
for (let i = 0; i < 139; i++) ending.advanceTick();
assert.equal(ending.credit, -1);
ending.advanceTick();
assert.equal(ending.credit, 0);
for (let line = 0; line < 26; line++) {
  assert.equal(ending.credit, line);
  assert.equal(ending.phase, "credits");
  for (let i = 0; i < 140; i++) ending.advanceTick();
}
assert.equal(ending.phase, "farewell");
for (let i = 0; i < 279; i++) ending.advanceTick();
assert.equal(ending.phase, "farewell");
ending.advanceTick();
assert.equal(ending.phase, "closed");
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  "Credits: 9 original code/index/pixel checks, fixed7-tick VGA alignment, two140-tick wait intervals, all26 independent port credit boundaries and negative controls. Reveal costs and whole-sequence original timing remain unproven.",
);
