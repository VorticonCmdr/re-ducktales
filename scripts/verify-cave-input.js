import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { capture, sameBytes } from "./verify-investments.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
import { parseCaveMaps, CAVE_SPRITES } from "../src/game/cave-scene.js";
import { parseLocations, parseLoot } from "../src/game/campaign.js";
import { Game } from "../src/game/application.js";
import build from "../reference/build.json" with { type: "json" };
const manifest = JSON.parse(
    await readFile("reference/cave-input.json", "utf8"),
  ),
  hash = (b) => createHash("sha256").update(b).digest("hex"),
  raw = {},
  files = {};
assert.equal(manifest.expectedCheckpointCount, 8);
assert.equal(manifest.expectedIndependentReplayCount, 1);
assert.equal(Object.keys(manifest.artifacts).length, 18);
for (const [name, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/cave.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[name] = item.path.endsWith(".json") ? JSON.parse(b) : b;
}
for (const name of [
  "DUCKTALE.EXE",
  "EXP.ARC",
  "CAVEMAPS.ARC",
  "LOC.ARC",
  "LOOT.ARC",
]) {
  const b = (files[name] = await readFile(`game/${name}`));
  assert.equal(hash(b), build.files[name].sha256);
  assert.equal(b.length, build.files[name].bytes);
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
const first = capture(raw.first, 3, 0xe0c0 + 0x9a1),
  entry = capture(raw.pauseEntry, 6, 0x400f),
  wait = capture(raw.pauseWait, 2, 0x4165),
  after = capture(raw.pauseAfter, 2, 0x41fc),
  returned = capture(raw.pauseReturn, 2, 0xe0c0 + 0x9a6);
const overlayAt = 0x1a800;
assert.equal(exe.readUInt16LE(overlayAt), 0x5a4d);
assert.equal(exe.readUInt16LE(overlayAt + 26), 6);
assert.equal(exe.readUInt16LE(overlayAt + 6), 196);
assert.equal(exe.readUInt16LE(overlayAt + 8) * 16, 1024);
const body = Buffer.from(exe.subarray(overlayAt + 1024, overlayAt + 12078));
assert.equal(body.length, 11054);
assert.equal(Buffer.from(first.results[2].data, "base64").length, 16384);
for (let i = 0; i < 196; i++) {
  const p = overlayAt + exe.readUInt16LE(overlayAt + 24) + i * 4,
    o = (exe.readUInt16LE(p + 2) - 0xc17) * 16 + exe.readUInt16LE(p);
  assert.ok(o >= 0 && o + 2 <= body.length);
  body.writeUInt16LE((body.readUInt16LE(o) + 0x1f5) & 65535, o);
}
assert.equal(first.results[2].addr, 0xe0c0);
sameBytes(
  Buffer.from(first.results[2].data, "base64").subarray(0, body.length),
  body,
  "original cave complete code identity",
);
for (const [index, start, len] of [
  [2, 0x1242, 876],
  [3, 0x20bf, 494],
  [4, 0x9ab8, 49],
  [5, 0x5a85, 32],
]) {
  assert.equal(entry.results[index].addr, 0x1f50 + start);
  sameBytes(
    Buffer.from(entry.results[index].data, "base64"),
    resident.subarray(start, start + len),
    "cave resident code identity",
  );
}
const mode = JSON.parse(raw.mode.content[0].text);
assert.equal(raw.mode.isError, false);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
assert.equal(mode.stop.stop_id, 525);
let checked = 1;
// Entire original cave local frame,plus globals/descriptors that Pause and19a5 preserve.
const ranges = [
  [first.cpu.ebp - 0x86, 0x86],
  [0x2229, 2],
  [0x8cc0, 4],
  [0x4d32, 2],
  [0x97b0, 2],
  [0x6810, 2],
  [0x8eb2, 2],
  [0x4e08, 2],
  [0x54ac, 2],
  [0x8b3e, 2],
  [0x8b54, 1],
  [0x4e28, 2],
  [0x546a, 1],
  [0x54aa, 1],
  [0x8990, 1],
  [0x5d2b, 1],
  [0x5a42, 128],
  ...[...CAVE_SPRITES.values()].map((p) => [p, 20]),
];
function preserved(a, b, corrupt = false) {
  for (const [p, len] of ranges) {
    const bytes = Buffer.from(b.bytes.subarray(p, p + len));
    if (corrupt && p === 0x2229) bytes[0] ^= 1;
    sameBytes(bytes, a.bytes.subarray(p, p + len), "cave preserved state");
  }
}
const zeroKeys = (c) =>
  sameBytes(
    c.bytes.subarray(0x276c, 0x27ec),
    new Uint8Array(128),
    "cave input flush",
  );
preserved(entry, wait);
preserved(entry, after);
preserved(entry, returned);
assert.equal(
  entry.bytes.readUInt32LE(0x27f8),
  after.bytes.readUInt32LE(0x27f8),
);
assert.equal(
  after.bytes.readUInt32LE(0x2225) - entry.bytes.readUInt32LE(0x2225),
  191,
);
checked++;
assert.throws(() => preserved(entry, after, true), /cave preserved state/);
assert.equal(returned.cpu.ebp, first.cpu.ebp);
assert.equal(returned.cpu.eax & 255, 0);
zeroKeys(returned);
checked++;
const d0 = capture(raw.deadlineEntry, 2, 0xba08),
  d1 = capture(raw.deadlineAfter, 2, 0xba38);
assert.ok(d0.bytes.readUInt32LE(0x2225) > d0.bytes.readUInt32LE(0x27f8));
assert.equal(d0.bytes.readUInt32LE(0x2225), d1.bytes.readUInt32LE(0x2225));
assert.equal(d1.bytes.readUInt32LE(0x27f8), d1.bytes.readUInt32LE(0x2225) + 6);
checked++;
for (const [name, room] of [
  ["right", 18],
  ["left", 17],
]) {
  const before = capture(raw[name + "Before"], 2, 0xe0c0 + 0x997),
    done = capture(raw[name + "After"], 2, 0xe0c0 + 0x9a6);
  assert.equal(before.cpu.ebp, first.cpu.ebp);
  assert.equal(done.cpu.ebp, first.cpu.ebp);
  assert.equal(before.bytes.readInt16LE(0x4d32), room);
  preserved(before, done);
  assert.equal(done.cpu.eax & 255, 0);
  zeroKeys(done);
  if (name === "left") {
    const queued = (c) =>
      assert.equal(c.bytes[0x2785], 64, "required queued passage P");
    queued(before);
    const bad = { ...before, bytes: Buffer.from(before.bytes) };
    bad.bytes[0x2785] = 0;
    assert.throws(() => queued(bad), /required queued passage P/);
  }
  checked++;
}
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
sameBytes(crop(popup), crop(shared), "original cave pause popup");
const bad = Buffer.from(crop(popup));
bad[0] ^= 1;
assert.throws(
  () => sameBytes(bad, crop(shared), "negative cave popup"),
  /negative cave popup/,
);
checked++;
const event = (frame, key, pressed) => ({ frame, key: "KBD_" + key, pressed });
const schedules = {
  pause: [event(0, "p", true), event(1, "p", false)],
  resume: [event(0, "p", false), event(140, "p", true), event(141, "p", false)],
  right: [
    event(0, "right", true),
    event(0, "space", true),
    event(10, "right", false),
    event(10, "space", false),
  ],
  left: [
    event(0, "left", true),
    event(0, "space", true),
    event(10, "left", false),
    event(10, "space", false),
    event(20, "p", true),
    event(21, "p", false),
  ],
};
assert.deepEqual(manifest.inputEvents, schedules);
for (const [name, events] of Object.entries(schedules)) {
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
const resources = {
  image,
  entries: parseArchive(files["EXP.ARC"]),
  maps: parseCaveMaps(parseArchive(files["CAVEMAPS.ARC"])),
  mapEntries: parseArchive(files["CAVEMAPS.ARC"]),
};
function replay({ dropPause = false, dropClock = false } = {}) {
  const g = new Game({
    locations: parseLocations(parseArchive(files["LOC.ARC"])),
    loot: parseLoot(parseArchive(files["LOOT.ARC"])),
    expeditionResources: resources,
  });
  g.seed = 0;
  g.campaign.location = 30;
  g.briefing = { activity: "cave", variant: 0 };
  g.startExpedition();
  for (let i = 0; i < 100 && g.cave.phase !== "exploring"; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(g.cave.phase, "exploring");
  if (!dropPause) g.input({ type: "pause" });
  for (let i = 0; i < 50 && !g.systemOverlay; i++) {
    g.advanceTick();
    g.advanceRetrace();
  }
  assert.equal(g.systemOverlay?.kind, "pause", "required cave pause input");
  const c = g.cave,
    bytes = Uint8Array.from(c.memory.bytes),
    tick = c.tick,
    n = c.inputs.length;
  for (let i = 0; i < 200; i++) {
    if (dropClock) g.systemOverlay.advanceTick();
    else g.advanceTick();
    g.advanceRetrace();
  }
  sameBytes(c.memory.bytes, bytes, "independent paused cave state");
  assert.equal(c.tick, tick + 200, "required cave device clocks");
  g.input({ type: "pause" });
  for (let i = 0; i < 7; i++) g.advanceTick();
  assert.equal(g.systemOverlay, null);
  assert.equal(c.inputs.length, n + 1);
  assert.equal(c.inputs.at(-1).code, 0);
  assert.equal(c.wait.clock, "graphics");
  for (let i = 0; i < 200 && c.wait.clock === "graphics"; i++) g.advanceTick();
  assert.equal(c.wait.clock, "retrace", "unfinished resumed cave drawing");
  assert.equal(c.inputs.length, n + 1);
  g.advanceRetrace();
  assert.equal(c.inputs.length, n + 2, "overdue cave deadline");
  return 1;
}
assert.equal(replay(), manifest.expectedIndependentReplayCount);
assert.throws(() => replay({ dropPause: true }), /required cave pause input/);
assert.throws(() => replay({ dropClock: true }), /required cave device clocks/);
console.log(
  "Cave input:8 original code/pause/deadline/room-flush/popup/event checks,1 independent controller replay and5 negative controls. No whole-original cave movement/audio/timing replay claimed.",
);
