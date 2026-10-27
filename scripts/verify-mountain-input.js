import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { capture, sameBytes } from "./verify-investments.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import { Game } from "../src/game/application.js";
import build from "../reference/build.json" with { type: "json" };

const manifest = JSON.parse(
    await readFile("reference/mountain-input.json", "utf8"),
  ),
  hash = (b) => createHash("sha256").update(b).digest("hex"),
  raw = {},
  files = {};
assert.equal(manifest.expectedCheckpointCount, 6);
assert.equal(manifest.expectedIndependentReplayCount, 1);
assert.equal(Object.keys(manifest.artifacts).length, 14);
assert.deepEqual(manifest.injections, []);
assert.deepEqual(manifest.fittedInputs, []);
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/mountain.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
for (const name of [
  "DUCKTALE.EXE",
  "MT.ARC",
  "MAIN.ARC",
  "LOC.ARC",
  "LOOT.ARC",
]) {
  const b = (files[name] = await readFile(`game/${name}`));
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
}
const exe = files["DUCKTALE.EXE"],
  image = Buffer.from(unpackImage(exe)),
  resident = Buffer.from(image);
let at = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const n = exe.readUInt16LE(at);
  at += 2;
  for (let i = 0; i < n; i++, at += 2) {
    const p = region * 65536 + exe.readUInt16LE(at);
    resident.writeUInt16LE((resident.readUInt16LE(p) + 0x1f5) & 65535, p);
  }
}
const entry = capture(raw.entry, 7, 0xe0c0),
  first = capture(raw.first, 2, 0xe0c0 + 0x317),
  pause = capture(raw.pauseEntry, 2, 0x400f),
  wait = capture(raw.pauseWait, 2, 0x4165),
  after = capture(raw.pauseAfter, 2, 0x41fc),
  returned = capture(raw.pauseReturn, 2, 0xe0c0 + 0x31c),
  life = capture(raw.lifeFlush, 2, 0xe0c0 + 0x278),
  lifeAfter = capture(raw.lifeAfter, 2, 0xe0c0 + 0x317);
const overlayAt = 0x17600;
assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
assert.equal(exe.readUInt16LE(overlayAt + 6), 68);
assert.equal(exe.readUInt16LE(overlayAt + 8) * 16, 512);
const code = Buffer.from(
  exe.subarray(overlayAt + 512, overlayAt + 512 + 12002),
);
for (let i = 0; i < 68; i++) {
  const p = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4,
    o = (exe.readUInt16LE(p + 2) - 0xc17) * 16 + exe.readUInt16LE(p);
  assert.ok(o >= 0 && o + 2 <= code.length);
  code.writeUInt16LE((code.readUInt16LE(o) + 0x1f5) & 65535, o);
}
assert.equal(entry.results[2].addr, 0xe0c0);
sameBytes(
  Buffer.from(entry.results[2].data, "base64"),
  code,
  "complete native mountain code",
);
for (const [index, p, length] of [
  [3, 0x1242, 876],
  [4, 0x20bf, 494],
  [5, 0x9ab8, 49],
  [6, 0x5a85, 32],
]) {
  assert.equal(entry.results[index].addr, 0x1f50 + p);
  sameBytes(
    Buffer.from(entry.results[index].data, "base64"),
    resident.subarray(p, p + length),
    "mountain resident code",
  );
}
for (const p of [0x14, 0x16a, 0x278])
  sameBytes(
    code.subarray(p, p + 5),
    Buffer.from([0x9a, 0xa5, 0x19, 0x03, 0x06]),
    "original mountain flush call",
  );
sameBytes(
  code.subarray(0x317, 0x31c),
  Buffer.from([0x9a, 2, 0, 0x19, 3]),
  "original mountain input call",
);
sameBytes(
  code.subarray(0x15e, 0x16a),
  Buffer.from([0xa3, 0xf8, 0x27, 0xc7, 6, 0xfc, 0x27, 4, 0, 0xa3, 0xfe, 0x27]),
  "mountain life interval",
);
assert.equal(raw.mode.isError, false);
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.stop_id, 545);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
assert.equal(entry.bytes.readUInt16LE(entry.cpu.esp + 4), 0);
assert.equal(entry.bytes[0x9f5e], 17);
const location = entry.bytes.readUInt16LE(0x4e2a + 17 * 8);
assert.equal(
  entry.bytes
    .subarray(location, location + 32)
    .toString("ascii")
    .split("\0")[0],
  "El Capitan",
);
let checked = 1;

// Compare all mountain locals and named game state,not resident input/driver
// scratch. Device-clock comparisons are separate from these preserved ranges.
const ranges = [
  [first.cpu.ebp - 0x52, 0x52],
  [0x2229, 2],
  [0x8cc0, 4],
  [0x4e0e, 1],
  [0x2056, 16],
  [0x27f8, 8],
  [0x4d34, 1],
  [0x5c70, 2],
  [0x6df0, 2],
  [0x54f6, 2],
  [0x5ae0, 2],
  [0x5c72, 2],
  [0x6d3c, 2],
  [0x6882, 2],
  [0x3d12, 2],
  [0x6ed4, 1],
  [0x88e4, 1],
  [0x1615, 1],
  [0x17da, 12],
  [0x3742, 4],
  [0x370a, 1],
  [first.bytes.readUInt16LE(0x5d26), 150],
  ...[0x36ea, 0x36ec, 0x36ee, 0x36f0, 0x3706, 0x3708, 0x3734, 0x3736].map(
    (p) => [p, 2],
  ),
  ...[
    0x36f2,
    0x5c48,
    0x5ce8,
    0x3720,
    ...Array.from({ length: 10 }, (_, i) => 0x5804 + i * 20),
    0x36d6,
    0x370c,
  ].map((p) => [p, 20]),
];
function preserved(a, b, corrupt = false) {
  for (const [p, n] of ranges) {
    const bytes = Buffer.from(b.bytes.subarray(p, p + n));
    if (corrupt && p === 0x2229) bytes[0] ^= 1;
    sameBytes(bytes, a.bytes.subarray(p, p + n), "mountain preserved state");
  }
}
preserved(pause, wait);
preserved(pause, after);
preserved(pause, returned);
assert.equal(
  after.bytes.readUInt32LE(0x2225) - pause.bytes.readUInt32LE(0x2225),
  190,
);
assert.ok(after.bytes.readUInt32LE(0x2225) > after.bytes.readUInt32LE(0x27f8));
assert.equal(after.bytes.readUInt32LE(0x27fc), 4);
checked++;
assert.throws(() => preserved(pause, after, true), /mountain preserved state/);
function zeroKeys(c) {
  sameBytes(
    c.bytes.subarray(0x276c, 0x27ec),
    new Uint8Array(128),
    "mountain key flush",
  );
}
assert.equal(returned.cpu.ebp, first.cpu.ebp);
assert.equal(returned.cpu.eax & 255, 0);
zeroKeys(returned);
checked++;
assert.equal(life.bytes[0x4d34], 2);
assert.equal(life.bytes[0x276c + 0x4d], 128, "held Right before life flush");
assert.equal(lifeAfter.bytes[0x4d34], 2);
zeroKeys(lifeAfter);
assert.deepEqual([life.bytes[0x205b], life.bytes[0x2063]], [0x49, 0x41]);
sameBytes(
  lifeAfter.bytes.subarray(0x2056, 0x2066),
  life.bytes.subarray(0x2056, 0x2066),
  "original second-life palette",
);
const badKeys = { ...lifeAfter, bytes: Buffer.from(lifeAfter.bytes) };
badKeys.bytes[0x276c + 0x4d] = 128;
assert.throws(() => zeroKeys(badKeys), /mountain key flush/);
checked++;
const popup = PNG.sync.read(raw.pausePNG),
  shared = PNG.sync.read(raw.sharedPausePNG);
assert.deepEqual(
  [popup.width, popup.height, shared.width, shared.height],
  [320, 200, 320, 200],
);
const crop = (p) =>
  Buffer.concat(
    Array.from({ length: 24 }, (_, y) =>
      p.data.subarray(((y + 80) * 320 + 104) * 4, ((y + 80) * 320 + 208) * 4),
    ),
  );
sameBytes(crop(popup), crop(shared), "original mountain pause popup");
const badPixel = Buffer.from(crop(popup));
badPixel[0] ^= 1;
assert.throws(
  () => sameBytes(badPixel, crop(shared), "negative mountain popup"),
  /negative mountain popup/,
);
checked++;
const event = (frame, key, pressed) => ({ frame, key: "KBD_" + key, pressed });
assert.deepEqual(manifest.inputEvents, {
  pause: [event(0, "p", true), event(1, "p", false)],
  resume: [event(0, "p", false), event(140, "p", true), event(141, "p", false)],
  right: [event(0, "right", true)],
});
for (const [name, events] of Object.entries(manifest.inputEvents)) {
  assert.equal(raw[name + "Replay"].isError, false);
  const r = JSON.parse(raw[name + "Replay"].content[0].text);
  assert.equal(r.active, false);
  assert.equal(r.engine, "frame");
  assert.equal(r.remaining, 0);
  assert.equal(r.total, events.length);
  assert.equal(r.dispatched, events.length);
}
checked++;
assert.equal(checked, manifest.expectedCheckpointCount);

// Initial state and event stream are authored independently of original output.
// No captured end-state,clock,allocator or sprite state is fed into this replay.
function replay({
  dropPause = false,
  dropClock = false,
  dropFlush = false,
} = {}) {
  const g = new Game({
    locations: parseLocations(parseArchive(files["LOC.ARC"])),
    loot: parseLoot(parseArchive(files["LOOT.ARC"])),
    expeditionResources: {
      image,
      mountainEntries: parseArchive(files["MT.ARC"]),
      mainEntries: parseArchive(files["MAIN.ARC"]),
    },
  });
  g.seed = 0;
  g.campaign.location = 31;
  g.briefing = { activity: "mountain", variant: 0 };
  g.startExpedition();
  const m = g.mountain;
  assert.equal(m.frames, 0);
  assert.equal(m.presentations, 0);
  if (!dropPause) g.input({ type: "pause" });
  assert.equal(g.systemOverlay, null, "mountain input waits for normal reader");
  assert.equal(g.pendingMountainSystemKeys.size, dropPause ? 0 : 1);
  g.advanceRetrace();
  assert.equal(g.systemOverlay, null);
  g.advanceRetrace();
  assert.equal(g.systemOverlay?.kind, "pause", "required mountain pause input");
  assert.equal(m.wait.clock, "input");
  assert.equal(m.inputs.length, 0);
  const bytes = Uint8Array.from(m.memory.bytes),
    locals = Uint8Array.from(m.locals.bytes),
    tick = m.tick,
    retrace = m.retrace;
  for (let i = 0; i < 200; i++) {
    if (dropClock) g.systemOverlay.advanceTick();
    else g.advanceTick();
    g.advanceRetrace();
  }
  sameBytes(m.memory.bytes, bytes, "independent paused mountain state");
  sameBytes(m.locals.bytes, locals, "independent paused mountain locals");
  assert.equal(m.tick, tick + 200, "required mountain device clocks");
  assert.equal(m.retrace, retrace + 200);
  g.input({ type: "pause" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.equal(m.inputs.length, 1);
  assert.equal(m.inputs[0].input, 0);
  g.advanceRetrace();
  assert.equal(m.inputs.length, 2, "resumed mountain input loop");
  g.input({ type: "controls", fire: false, direction: "right" });
  g.advanceRetrace();
  assert.equal(m.inputs.at(-1).input, 3);
  g.input({ type: "quit" });
  g.advanceRetrace();
  assert.equal(g.systemOverlay?.kind, "quit");
  assert.equal(m.wait.clock, "input");
  assert.equal(
    m.locals.b(-0x1e),
    0,
    "0313 clears previous joystick before poll",
  );
  g.input({ type: "quit-no" });
  assert.equal(g.systemOverlay, null);
  assert.equal(m.inputs.at(-1).input, 0);
  // Walk through a natural life reset using the actual controller adapter.
  g.input({ type: "controls", fire: false, direction: "right" });
  let calls = 0;
  const flush = m.onFlushInput;
  m.onFlushInput = () => {
    calls++;
    // An authored unread key at this consumption boundary must be discarded.
    g.input({ type: "pause" });
    if (!dropFlush) flush();
  };
  for (let i = 0; i < 4000 && m.memory.b(0x4d34) === 3; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(m.memory.b(0x4d34), 2, "required mountain life loss");
  for (let i = 0; i < 100 && calls === 0; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(calls, 1, "required mountain life flush");
  assert.equal(
    g.pendingMountainSystemKeys.size,
    0,
    "required unread mountain key flush",
  );
  assert.deepEqual(g.controls, { fire: false, direction: null });
  assert.deepEqual(m.controls, { fire: false, direction: null });
  const frame = m.frames;
  for (let i = 0; i < 10; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(g.systemOverlay, null);
  assert.ok(m.frames > frame);
  assert.equal(m.memory.b(0x4d34), 2);
  return 1;
}
assert.equal(replay(), manifest.expectedIndependentReplayCount);
assert.throws(
  () => replay({ dropPause: true }),
  /required mountain pause input/,
);
assert.throws(
  () => replay({ dropClock: true }),
  /required mountain device clocks/,
);
assert.throws(
  () => replay({ dropFlush: true }),
  /required unread mountain key flush/,
);
console.log(
  "Mountain input:6 original code/pause/input-return/life-flush/popup/event checks,1 independent controller replay and6 negative controls. No whole-original mountain movement,timing or framebuffer parity claimed.",
);
