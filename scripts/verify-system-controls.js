import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import {
  systemOverlayLayout,
  SystemControls,
} from "../src/game/system-controls.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(
  await readFile("reference/system-controls.json", "utf8"),
);
assert.equal(manifest.expectedCheckpointCount, 7);
assert.equal(Object.keys(manifest.artifacts).length, 13);
const raw = {};
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/system-controls.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(raw.mode.isError, false);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
const exe = await readFile("game/DUCKTALE.EXE"),
  main = await readFile("game/MAIN.ARC");
for (const [name, b] of [
  ["DUCKTALE.EXE", exe],
  ["MAIN.ARC", main],
]) {
  assert.equal(hash(b), build.files[name].sha256);
  assert.equal(b.length, build.files[name].bytes);
}
const image = Buffer.from(unpackImage(exe)),
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
const before = capture(raw.pauseBefore, 5, 0x400f);
for (const [index, start, size] of [
  [2, 0x1ee7, 966],
  [3, 0x1242, 876],
  [4, 0x5a85, 32],
]) {
  assert.equal(before.results[index].addr, 0x1f50 + start);
  sameBytes(
    Buffer.from(before.results[index].data, "base64"),
    relocated.subarray(start, start + size),
    "system relocated code",
  );
}
const pause = capture(raw.pauseWait, 2, 0x4165),
  after = capture(raw.pauseAfter, 2, 0x41fc);
const quit = capture(raw.quitWait, 2, 0x3f37),
  no = capture(raw.quitNo, 2, 0x400e);
const reveal = capture(raw.quitReveal, 2, 0x3f37),
  visible = capture(raw.quitVisible, 2, 0x3f37),
  yes = capture(raw.quitYes, 2, 0x5f38),
  sound = capture(raw.soundOff, 2, 0x3354);
let checked = 0;
function preserved(a, b, alter = false) {
  for (const at of [
    0x2229, 0x4e0e, 0x5b3c, 0x8990, 0x96ba, 0x8eb4, 0x7900, 0x715e, 0x581,
  ])
    assert.equal(
      a.bytes.readUInt16LE(at) + (alter && at === 0x2229 ? 1 : 0),
      b.bytes.readUInt16LE(at),
      `preserved state ${at.toString(16)}`,
    );
  for (const at of [0x8cc0, 0x5ae2, 0x4e0a, 0x54f2])
    assert.equal(
      a.bytes.readUInt32LE(at),
      b.bytes.readUInt32LE(at),
      "preserved accounts",
    );
  for (let i = 0; i < 35; i++)
    sameBytes(
      a.bytes.subarray(0x4e30 + i * 8, 0x4e32 + i * 8),
      b.bytes.subarray(0x4e30 + i * 8, 0x4e32 + i * 8),
      "preserved collected flags",
    );
}
assert.equal(pause.bytes[0x3b9], 1);
assert.equal(after.bytes[0x3b9], 0);
preserved(before, pause);
preserved(before, after);
sameBytes(
  after.bytes.subarray(0x276c, 0x27ec),
  new Uint8Array(128),
  "pause input flush",
);
checked++;
assert.equal(quit.bytes[0x3b8], 1);
assert.equal(no.bytes[0x3b8], 0);
preserved(quit, no);
sameBytes(
  no.bytes.subarray(0x276c, 0x27ec),
  new Uint8Array(128),
  "cancelled quit input flush",
);
checked++;
assert.equal(yes.bytes[0x3b8], 1);
preserved(visible, yes);
checked++;
assert.equal(yes.bytes[0x3be], 1);
assert.equal(sound.bytes[0x3be], 0);
preserved(yes, sound);
checked++;
assert.equal(
  visible.bytes.readUInt32LE(0x2225) - reveal.bytes.readUInt32LE(0x2225),
  2,
  "fixed quit VGA alignment",
);
assert.throws(() => preserved(before, after, true), /preserved state/);
const entries = parseArchive(main),
  font = entries[42].data;
function popup(kind) {
  const { box, fill, rows } = systemOverlayLayout(kind),
    pixels = new Uint8Array(box.width * box.height * 4);
  assert.deepEqual(
    box,
    kind === "pause"
      ? { x: 104, y: 80, width: 104, height: 24 }
      : { x: 39, y: 87, width: 234, height: 18 },
    "original popup comparison bounds",
  );
  const put = (x, y, c) =>
    pixels.set(c, ((y - box.y) * box.width + x - box.x) * 4);
  for (let y = box.y; y < box.y + box.height; y++)
    for (let x = box.x; x < box.x + box.width; x++) put(x, y, [0, 0, 0, 255]);
  for (let y = fill.y; y < fill.y + fill.height; y++)
    for (let x = fill.x; x < fill.x + fill.width; x++)
      put(x, y, [0, 0, 170, 255]);
  for (const row of rows) {
    let x = row.x;
    for (const ch of executableText(image, row.at)) {
      for (let y = 0; y < 8; y++)
        for (let col = 0; col < 8; col++)
          if (font[8 + ch.charCodeAt(0) * 8 + y] & (128 >> col))
            put(x + col, row.y + y, [255, 255, 255, 255]);
      x += 8;
    }
  }
  for (let x = box.x; x < box.x + box.width; x++) {
    put(x, box.y, [255, 255, 255, 255]);
    put(x, box.y + box.height - 1, [255, 255, 255, 255]);
  }
  for (let y = box.y; y < box.y + box.height; y++) {
    put(box.x, y, [255, 255, 255, 255]);
    put(box.x + box.width - 1, y, [255, 255, 255, 255]);
  }
  return { box, pixels };
}
for (const kind of ["pause", "quit"]) {
  const p = PNG.sync.read(raw[kind + "PNG"]);
  assert.deepEqual([p.width, p.height], [320, 200]);
  const { box, pixels } = popup(kind),
    actual = new Uint8Array(pixels.length);
  for (let y = 0; y < box.height; y++)
    actual.set(
      p.data.subarray(
        ((y + box.y) * 320 + box.x) * 4,
        ((y + box.y) * 320 + box.x + box.width) * 4,
      ),
      y * box.width * 4,
    );
  sameBytes(actual, pixels, `${kind} original popup RGBA`);
  const broken = Uint8Array.from(pixels);
  broken[0] ^= 1;
  assert.throws(
    () => sameBytes(actual, broken, "negative popup"),
    /negative popup/,
  );
  checked++;
}
// Bounded interface audit: linked file-writing helpers exist,but no resident
// or overlay contains their canonical far pointers or aliased direct far calls.
const parts = [image];
let at =
  Math.ceil(
    ((exe.readUInt16LE(4) - 1) * 512 + (exe.readUInt16LE(2) || 512)) / 512,
  ) * 512;
while (at < exe.length) {
  assert.equal(exe.readUInt16LE(at), 0x5a4d);
  const length =
    (exe.readUInt16LE(at + 4) - 1) * 512 + (exe.readUInt16LE(at + 2) || 512);
  parts.push(exe.subarray(at + 16 * exe.readUInt16LE(at + 8), at + length));
  at = Math.ceil((at + length) / 512) * 512;
}
assert.equal(parts.length, 11);
for (const entry of [0x1f7, 0x22d, 0x2dc, 0x338]) {
  const ptr = Buffer.alloc(4);
  ptr.writeUInt16LE(entry);
  ptr.writeUInt16LE(0x40e, 2);
  for (const p of parts) {
    assert.equal(p.indexOf(ptr), -1, "unexpected file writer reference");
    for (let i = 0; i + 4 < p.length; i++)
      if (p[i] === 0x9a || p[i] === 0xea)
        assert.notEqual(
          p.readUInt16LE(i + 1) + 16 * p.readUInt16LE(i + 3),
          0x40e0 + entry,
          "aliased file writer call",
        );
  }
}
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  `System controls: ${checked} original state/popup/interface checks, complete input/dialog/flush code identities and negative controls passed. No whole-campaign elapsed-time or proof of absent computed code paths claimed.`,
);
