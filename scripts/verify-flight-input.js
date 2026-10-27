import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { capture, sameBytes } from "./verify-investments.js";
import { unpackImage, executableText } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { Flight } from "../src/game/flight.js";
import { Game } from "../src/game/application.js";
import { FLIGHT_SPRITES } from "../src/game/flight-setup.js";
import build from "../reference/build.json" with { type: "json" };

const manifest = JSON.parse(
  await readFile("reference/flight-input.json", "utf8"),
);
assert.equal(manifest.expectedCheckpointCount, 9);
assert.equal(manifest.expectedIndependentReplayCount, 1);
assert.equal(Object.keys(manifest.artifacts).length, 18);
const raw = {},
  hash = (b) => createHash("sha256").update(b).digest("hex");
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/system-controls.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
assert.equal(raw.mode.isError, false);
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
const files = {};
for (const name of ["DUCKTALE.EXE", "PLANE.ARC", "MAIN.ARC"]) {
  files[name] = await readFile(`game/${name}`);
  assert.equal(hash(files[name]), build.files[name].sha256);
  assert.equal(files[name].length, build.files[name].bytes);
}
const exe = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(exe)),
  resident = Buffer.from(image);
let at = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(at);
  at += 2;
  for (let i = 0; i < count; i++, at += 2) {
    const offset = region * 65536 + exe.readUInt16LE(at);
    resident.writeUInt16LE(
      (resident.readUInt16LE(offset) + 0x1f5) & 65535,
      offset,
    );
  }
}
const code = capture(raw.code, 8, 0xe36e),
  overlayAt = 0x12c00;
assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
assert.equal(exe.readUInt16LE(overlayAt + 6), 248);
const body = Buffer.from(
  exe.subarray(overlayAt + 1024, overlayAt + 1024 + 17548),
);
for (let i = 0; i < 248; i++) {
  const p = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4,
    offset = (exe.readUInt16LE(p + 2) - 0xc17) * 16 + exe.readUInt16LE(p);
  assert.ok(offset >= 0 && offset + 2 <= body.length);
  body.writeUInt16LE((body.readUInt16LE(offset) + 0x1f5) & 65535, offset);
}
// The original hardware-FPU handler patches executed escape prefixes in place.
// Match the handler and vector ownership,then derive each allowed replacement
// from original bytes. No operand or unlisted code byte is excluded.
assert.equal(raw.fpuHandler.isError, false);
const handler = JSON.parse(raw.fpuHandler.content[0].text);
assert.equal(handler.aborted, false);
assert.equal(handler.results.length, 1);
assert.equal(handler.results[0].status, "ok");
assert.equal(handler.results[0].addr, 0xc2e5);
sameBytes(
  Buffer.from(handler.results[0].data, "base64"),
  resident.subarray(0xa395, 0xa416),
  "original FPU patcher identity",
);
assert.equal(raw.fpuVectors.isError, false);
const vectors = JSON.parse(raw.fpuVectors.content[0].text);
assert.equal(vectors.aborted, false);
assert.equal(vectors.results.length, 2);
assert.ok(vectors.results.every((r) => r.status === "ok"));
assert.equal(vectors.results[1].addr, 0xd0);
const ivt = Buffer.from(vectors.results[1].data, "base64");
assert.equal(ivt.length, 40);
for (let n = 0; n < 10; n++) {
  assert.equal(ivt.readUInt16LE(n * 4 + 2), 0xbb9);
  assert.equal(
    ivt.readUInt16LE(n * 4),
    n === 8 ? 0x755 : n === 9 ? 0x782 : 0x78a,
  );
}
assert.equal(manifest.runtimeFpuPatchedOffsets.length, 91);
assert.equal(new Set(manifest.runtimeFpuPatchedOffsets).size, 91);
for (const text of manifest.runtimeFpuPatchedOffsets) {
  const p = parseInt(text, 16);
  assert.equal(body[p], 0xcd);
  const interrupt = body[p + 1];
  if (interrupt === 0x3d) {
    body.writeUInt16LE((body.readUInt16LE(p) - 0xa23d) & 65535, p);
    continue;
  }
  assert.ok(interrupt >= 0x34 && interrupt <= 0x3b);
  body.writeUInt16LE((body.readUInt16LE(p) - 0x5c32) & 65535, p);
  const operand = body.readUInt16LE(p + 1);
  const keepWait =
    ((operand & 0x30fb) === 0x30d9 && body[p + 2] < 0xf0) ||
    (operand & 0xfeff) === 0xe2db ||
    operand === 0xe0df;
  if (!keepWait) body[p] = 0x90;
}
assert.equal(code.results[2].addr, 0xe0c0);
const liveOverlay = Buffer.from(code.results[2].data, "base64");
sameBytes(liveOverlay, body, "flight-input overlay identity");
const badCode = Buffer.from(body);
badCode[0x21] ^= 1;
assert.throws(
  () => sameBytes(liveOverlay, badCode, "negative FPU operand"),
  /negative FPU operand/,
);
for (const [index, start, len] of [
  [3, 0x1242, 876],
  [4, 0x20bf, 494],
  [5, 0x9ab8, 49],
  [6, 0x2635, 88],
  [7, 0x1ee7, 472],
]) {
  assert.equal(code.results[index].addr, 0x1f50 + start);
  sameBytes(
    Buffer.from(code.results[index].data, "base64"),
    resident.subarray(start, start + len),
    "flight-input resident identity",
  );
}
let checked = 1;
const entry = capture(raw.pauseEntry, 2, 0x400f),
  wait = capture(raw.pauseWait, 2, 0x4165),
  after = capture(raw.pauseAfter, 2, 0x41fc),
  returned = capture(raw.pauseReturn, 2, 0xe373);
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
  [0x4f42, 520],
  [0x79f2, 3640],
  ...[...FLIGHT_SPRITES.values()].map((a) => [a, 20]),
];
function preserved(a, b, corrupt = false) {
  for (const [offset, len] of ranges) {
    const actual = Buffer.from(b.bytes.subarray(offset, offset + len));
    if (corrupt && offset === 0x2229) actual[0] ^= 1;
    sameBytes(
      actual,
      a.bytes.subarray(offset, offset + len),
      "flight pause preservation",
    );
  }
}
for (const c of [wait, after, returned]) {
  preserved(entry, c);
  assert.equal(
    c.bytes.readUInt32LE(0x27f8),
    entry.bytes.readUInt32LE(0x27f8),
    "pause preserves separate deadline",
  );
}
assert.equal(wait.bytes[0x3b9], 1);
assert.equal(after.bytes[0x3b9], 0);
assert.ok(
  after.bytes.readUInt32LE(0x2225) - entry.bytes.readUInt32LE(0x2225) > 140,
);
assert.throws(() => preserved(entry, after, true), /flight pause preservation/);
checked++;
assert.equal(returned.cpu.eax & 255, 0);
sameBytes(
  after.bytes.subarray(0x276c, 0x27ec),
  new Uint8Array(128),
  "flight pause input flush",
);
checked++;
const d0 = capture(raw.deadlineEntry, 2, 0xba08),
  d1 = capture(raw.deadlineAfter, 2, 0xba38);
assert.ok(d0.bytes.readUInt32LE(0x2225) > d0.bytes.readUInt32LE(0x27f8));
assert.equal(
  d0.bytes.readUInt32LE(0x2225),
  d1.bytes.readUInt32LE(0x2225),
  "overdue deadline consumes no driver clock",
);
assert.equal(d1.bytes.readUInt32LE(0x27f8), d1.bytes.readUInt32LE(0x2225) + 6);
preserved(entry, d1);
checked++;
capture(raw.returnEntry, 2, 0xefe7);
const dialogue = capture(raw.returnDialogue, 2, 0x4585);
assert.equal(dialogue.bytes.readInt16LE(dialogue.cpu.esp + 4), 20);
checked++;
const first = capture(raw.returnFirst, 2, 0x45c3),
  last = capture(raw.returnLast, 2, 0x45d6);
assert.equal(first.bytes.readInt16LE(first.cpu.ebp - 6), 0);
sameBytes(
  first.bytes.subarray(0x276c, 0x27ec),
  new Uint8Array(128),
  "flight final input flush",
);
checked++;
assert.equal(last.bytes.readInt16LE(last.cpu.ebp - 6), 20);
assert.equal(last.bytes.readInt16LE(last.cpu.ebp - 4), 0);
assert.equal(
  last.bytes.readUInt32LE(0x2225) - first.bytes.readUInt32LE(0x2225),
  140,
);
preserved(first, last);
checked++;

const entries = parseArchive(files["MAIN.ARC"]),
  font = entries[42].data;
const png = PNG.sync.read(raw.pausePNG);
assert.deepEqual([png.width, png.height], [320, 200]);
const expected = new Uint8Array(104 * 24 * 4),
  actual = new Uint8Array(expected.length);
const put = (x, y, c) => expected.set(c, ((y - 80) * 104 + x - 104) * 4);
for (let y = 80; y < 104; y++)
  for (let x = 104; x < 208; x++) put(x, y, [0, 0, 170, 255]);
for (const [row, offset] of [0x483, 0x491, 0x49f].entries()) {
  let x = 104;
  for (const ch of executableText(image, offset)) {
    for (let y = 0; y < 8; y++)
      for (let col = 0; col < 8; col++)
        if (font[8 + ch.charCodeAt(0) * 8 + y] & (128 >> col))
          put(x + col, 80 + row * 8 + y, [255, 255, 255, 255]);
    x += 8;
  }
}
for (let x = 104; x < 208; x++) {
  put(x, 80, [255, 255, 255, 255]);
  put(x, 103, [255, 255, 255, 255]);
}
for (let y = 80; y < 104; y++) {
  put(104, y, [255, 255, 255, 255]);
  put(207, y, [255, 255, 255, 255]);
  actual.set(
    png.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
    (y - 80) * 104 * 4,
  );
}
sameBytes(actual, expected, "original flight pause popup");
const corrupt = Uint8Array.from(expected);
corrupt[0] ^= 1;
assert.throws(
  () => sameBytes(actual, corrupt, "negative flight popup"),
  /negative flight popup/,
);
checked++;

const schedules = {
  pause: [
    { frame: 0, key: "KBD_p", pressed: true },
    { frame: 1, key: "KBD_p", pressed: false },
  ],
  resume: [
    { frame: 0, key: "KBD_p", pressed: false },
    { frame: 140, key: "KBD_p", pressed: true },
    { frame: 141, key: "KBD_p", pressed: false },
  ],
  fly: [
    { frame: 0, key: "KBD_space", pressed: true },
    { frame: 80, key: "KBD_down", pressed: true },
    { frame: 100, key: "KBD_down", pressed: false },
    { frame: 160, key: "KBD_space", pressed: false },
  ],
};
assert.deepEqual(
  manifest.inputEvents,
  schedules,
  "required flight input schedules",
);
for (const [name, key] of [
  ["pauseReplay", "pause"],
  ["resumeReplay", "resume"],
  ["flyReplay", "fly"],
]) {
  assert.equal(raw[name].isError, false);
  const r = JSON.parse(raw[name].content[0].text),
    count = schedules[key].length;
  assert.equal(r.active, false);
  assert.equal(r.engine, "frame");
  assert.equal(r.dispatched, count);
  assert.equal(r.total, count);
  assert.equal(r.remaining, 0);
}
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);

// Independent model state and authored inputs,not the original captured clock
// values. Dropping a required input or device clock must break this replay.
function replay({ dropPause = false, dropClock = false } = {}) {
  const g = new Game();
  g.scene = "flight";
  const f = new Flight({
    image,
    entries: parseArchive(files["PLANE.ARC"]),
    day: 1,
    days: 1,
    difficulty: 0,
    racing: false,
    seed: 1960,
    money: 0,
    pollInput: () => g.pollFlightSystemInput(),
    flushInput: () => g.flushFlightInput(),
  });
  g.flight = f;
  if (!dropPause) g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null);
  g.advanceRetrace();
  assert.equal(g.systemOverlay?.kind, "pause", "required flight pause input");
  const state = Uint8Array.from(f.memory.bytes),
    frames = f.frames;
  for (let i = 0; i < 200; i++) {
    if (dropClock) g.systemOverlay.advanceTick();
    else g.advanceTick();
    g.advanceRetrace();
  }
  sameBytes(f.memory.bytes, state, "independent paused flight state");
  assert.equal(f.tick, 200, "required flight device clocks");
  g.input({ type: "pause" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.equal(
    f.frames,
    frames + 1,
    "expired flight deadline resumes immediately",
  );
  assert.equal(f.inputLog.at(-1).code, 0);
  assert.deepEqual(f.controls, { fire: false, direction: null });
  return 1;
}
assert.equal(replay(), manifest.expectedIndependentReplayCount);
assert.throws(() => replay({ dropPause: true }), /required flight pause input/);
assert.throws(
  () => replay({ dropClock: true }),
  /required flight device clocks/,
);
console.log(
  "Flight input: 9 original code/pause/deadline/final-wait/popup/input checks,1 independent controller replay and negative controls. No whole-original flight timing or new original flight Quit-No replay claimed.",
);
