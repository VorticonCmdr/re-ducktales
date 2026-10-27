import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unpackImage } from "../src/game/executable.js";
import { Game } from "../src/game/application.js";
import { capture, sameBytes } from "./verify-investments.js";
import build from "../reference/build.json" with { type: "json" };

const manifest = JSON.parse(
  await readFile("reference/money-bin-input.json", "utf8"),
);
assert.equal(manifest.expectedCheckpointCount, 10);
assert.equal(Object.keys(manifest.artifacts).length, 17);
const hash = (b) => createHash("sha256").update(b).digest("hex"),
  raw = {};
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/system-controls.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = JSON.parse(b);
}
assert.equal(raw.mode.isError, false);
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
const exe = await readFile("game/DUCKTALE.EXE");
assert.equal(hash(exe), build.files["DUCKTALE.EXE"].sha256);
assert.equal(exe.length, build.files["DUCKTALE.EXE"].bytes);
const resident = Buffer.from(unpackImage(exe));
let table = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(table);
  table += 2;
  for (let i = 0; i < count; i++, table += 2) {
    const at = region * 65536 + exe.readUInt16LE(table);
    resident.writeUInt16LE((resident.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
}
let checked = 0;
const code = capture(raw.code, 6, 0xe2ea);
const overlayAt = 0x26000;
assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
assert.equal(exe.readUInt16LE(overlayAt + 6), 65);
const body = Buffer.from(exe.subarray(overlayAt + 512, overlayAt + 512 + 2836));
for (let i = 0; i < 65; i++) {
  const at = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4;
  const offset = (exe.readUInt16LE(at + 2) - 0xc17) * 16 + exe.readUInt16LE(at);
  assert.ok(offset >= 0 && offset + 2 <= body.length);
  body.writeUInt16LE((body.readUInt16LE(offset) + 0x1f5) & 65535, offset);
}
assert.equal(code.results[2].addr, 0xe0c0);
sameBytes(
  Buffer.from(code.results[2].data, "base64"),
  body,
  "money-bin relocated overlay",
);
for (const [index, at, len] of [
  [3, 0x1242, 876],
  [4, 0x20bf, 494],
  [5, 0x4eac, 53],
]) {
  assert.equal(code.results[index].addr, 0x1f50 + at);
  sameBytes(
    Buffer.from(code.results[index].data, "base64"),
    resident.subarray(at, at + len),
    "money-bin resident identity",
  );
}
checked++;
const poll = capture(raw.introPoll, 4, 0xe2ea);
for (const [index, at, len] of [
  [2, 0x5b89, 173],
  [3, 0x5aa5, 114],
]) {
  assert.equal(poll.results[index].addr, 0x1f50 + at);
  sameBytes(
    Buffer.from(poll.results[index].data, "base64"),
    resident.subarray(at, at + len),
    "money-bin keyboard identity",
  );
}
checked++;
const entry = capture(raw.introEntry, 2, 0x400f),
  wait = capture(raw.introWait, 2, 0x4165),
  after = capture(raw.introAfter, 2, 0x41fc),
  next = capture(raw.introNext, 2, 0xe2d0);
const binBP = poll.cpu.ebp;
assert.equal(binBP, 0x9f56);
const pose = (c) => [
  {
    asset: 1,
    x: c.bytes.readInt16LE(0x3b14),
    y: c.bytes.readInt16LE(0x3b16),
    frame: c.bytes[0x3b26],
  },
  {
    asset: 4,
    x: c.bytes.readInt16LE(0x3b78),
    y: c.bytes.readInt16LE(0x3b7a),
    frame: c.bytes[0x3b8a],
  },
];
function preserved(a, b, corrupt = false) {
  for (const [at, len] of [
    [0x2229, 2],
    [0x8cc0, 4],
    [0x5ae2, 4],
    [0x4e0a, 4],
    [0x54f2, 4],
    [0x4e0e, 1],
    [0x4e26, 2],
  ]) {
    const actual = Buffer.from(b.bytes.subarray(at, at + len));
    if (corrupt && at === 0x2229) actual[0] ^= 1;
    sameBytes(
      actual,
      a.bytes.subarray(at, at + len),
      "bin pause preserved state",
    );
  }
}
const zeroKeys = (c) =>
  sameBytes(
    c.bytes.subarray(0x276c, 0x27ec),
    new Uint8Array(128),
    "bin key flush",
  );
function fresh() {
  const g = new Game();
  g.rareCoinTaken = !!poll.bytes.readUInt16LE(0x4e26);
  g.money = poll.bytes.readUInt32LE(0x8cc0);
  g.seed = poll.bytes.readUInt16LE(0x2229);
  g.audioEnabled = !!poll.bytes[0x3be];
  g.input({ type: "fire" });
  g.input({ type: "fire" });
  g.input({ type: "money-bin" });
  return g;
}
const tick = (g, n) => {
  for (let i = 0; i < n; i++) g.advanceTick();
};
function introCheck(dropPause = false) {
  assert.equal(poll.bytes[0x2785], 64, "released P survives intro");
  assert.equal(poll.bytes.readInt16LE(binBP - 8), 2);
  const g = fresh();
  tick(g, 50);
  if (!dropPause) g.input({ type: "pause" });
  tick(g, 117);
  assert.equal(g.systemOverlay, null);
  tick(g, 1);
  assert.equal(g.systemOverlay?.kind, "pause", "required deferred pause");
  assert.deepEqual(g.bin.current.sprites, pose(poll));
  assert.deepEqual(pose(entry), pose(poll));
  assert.equal(g.bin.nextPose, poll.bytes.readInt16LE(binBP - 8));
  preserved(poll, entry);
  return g;
}
const g = introCheck();
assert.throws(() => introCheck(true), /required deferred pause/);
checked++;
tick(g, 35);
assert.equal(g.systemOverlay.phase, "waiting");
assert.equal(wait.bytes[0x3b9], 1);
zeroKeys(wait);
assert.deepEqual(g.bin.current.sprites, pose(wait));
preserved(poll, wait);
checked++;
tick(g, 1000);
g.input({ type: "pause" });
tick(g, 7);
assert.equal(g.systemOverlay, null);
assert.equal(after.bytes[0x3b9], 0);
zeroKeys(after);
assert.deepEqual(pose(after), pose(poll));
assert.deepEqual(g.bin.current.sprites, pose(next));
assert.equal(g.bin.nextPose, next.bytes.readInt16LE(binBP - 8) + 1);
preserved(poll, after);
preserved(poll, next);
checked++;
const idle = capture(raw.idleEntry, 2, 0x400f),
  idleWait = capture(raw.idleWait, 2, 0x4165),
  idleAfter = capture(raw.idleAfter, 2, 0x41fc),
  idleReturn = capture(raw.idleReturn, 2, 0xe2ef);
const h = fresh();
tick(h, 168);
h.input({ type: "pause" });
tick(h, 14);
assert.equal(h.systemOverlay.kind, "pause");
assert.deepEqual(h.bin.current.sprites, pose(idle));
tick(h, 35);
assert.deepEqual(h.bin.current.sprites, pose(idleWait));
assert.equal(idleWait.bytes[0x3b9], 1);
zeroKeys(idleWait);
preserved(idle, idleWait);
checked++;
tick(h, 1000);
h.input({ type: "pause" });
tick(h, 7);
assert.equal(idleAfter.bytes[0x3b9], 0);
zeroKeys(idleAfter);
assert.equal(idleReturn.cpu.eax & 255, 0, "pause returns no Fire");
assert.deepEqual(pose(idleAfter), pose(idle));
preserved(idle, idleAfter);
preserved(idle, idleReturn);
checked++;
const dive = capture(raw.diveStart, 2, 0xe3b9),
  beforeFlush = capture(raw.diveBefore, 2, 0xebc7),
  flushed = capture(raw.diveAfter, 2, 0xebcc);
const d = fresh();
tick(d, 168);
d.input({ type: "fire" });
tick(d, 14);
assert.equal(d.bin.phase, "dive");
assert.deepEqual(d.bin.current.sprites, pose(dive));
for (const type of ["quit", "pause", "toggle-sound"]) d.input({ type });
for (const at of [0x277c, 0x2785, 0x278b])
  assert.equal(beforeFlush.bytes[at], 64, "unconsumed dive key");
assert.equal(beforeFlush.bytes[0x3b8], 0);
assert.equal(beforeFlush.bytes[0x3b9], 0);
assert.equal(beforeFlush.bytes[0x3be], dive.bytes[0x3be]);
preserved(dive, beforeFlush);
checked++;
let steps = 0;
while (d.scene === "money-bin" && steps++ < 3000) {
  d.advanceTick();
  d.advanceRetrace();
  assert.equal(d.systemOverlay, null);
}
assert.equal(d.scene, "office", "unfinished dive");
assert.equal(d.pendingBinSystemKeys.size, 0);
assert.equal(d.money, flushed.bytes.readUInt32LE(0x8cc0));
assert.equal(d.seed, flushed.bytes.readUInt16LE(0x2229));
assert.equal(d.audioEnabled, !!flushed.bytes[0x3be]);
zeroKeys(flushed);
preserved(dive, flushed);
assert.throws(
  () => preserved(dive, flushed, true),
  /bin pause preserved state/,
);
checked++;
for (const [name, count] of [
  ["introReplay", 2],
  ["resumeReplay", 2],
  ["diveReplay", 6],
]) {
  assert.equal(raw[name].isError, false);
  const replay = JSON.parse(raw[name].content[0].text);
  assert.equal(replay.active, false);
  assert.equal(replay.total, count);
  assert.equal(replay.dispatched, count);
  assert.equal(replay.remaining, 0);
  assert.equal(replay.engine, "frame");
}
assert.deepEqual(
  manifest.inputEvents,
  {
    intro: [
      { frame: 10, key: "KBD_p", pressed: true },
      { frame: 20, key: "KBD_p", pressed: false },
    ],
    resume: [
      { frame: 10, key: "KBD_p", pressed: true },
      { frame: 11, key: "KBD_p", pressed: false },
    ],
    dive: [
      { frame: 10, key: "KBD_q", pressed: true },
      { frame: 11, key: "KBD_q", pressed: false },
      { frame: 12, key: "KBD_p", pressed: true },
      { frame: 13, key: "KBD_p", pressed: false },
      { frame: 14, key: "KBD_s", pressed: true },
      { frame: 15, key: "KBD_s", pressed: false },
    ],
  },
  "required original input schedules",
);
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);
console.log(
  "Money-bin input: 10 original code/poll/pause/dive-flush checks, complete frame-scheduled inputs, independent controller replay and negative controls. CPU/presentation timing and other scene input boundaries remain unproven.",
);
