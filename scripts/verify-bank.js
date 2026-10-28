import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { BankScene, BANK_SPRITES } from "../src/game/bank.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { Scheduler } from "../src/game/scheduler.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/bank.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const inputCases = [
  [0, 0],
  [9999, 0],
  [10000, 29999],
  [40000, 0],
  [0, 99999],
  [2147483647, 0],
  [2147483648, 4294967295],
  [4294957296, 0],
];
assert.equal(manifest.expectedArithmeticCases, 8);
assert.equal(manifest.expectedCleanupCases, 1);
assert.equal(manifest.expectedPixelCheckpoints, 2);
assert.equal(manifest.expectedRngCheckpoints, 1);
assert.deepEqual(manifest.caseInputs, inputCases);
const artifacts = {};
for (const [key, a] of Object.entries(manifest.artifacts)) {
  const raw = await readFile(a.path).catch(() => {
    throw Error(`SETUP: missing ${a.path}; see docs/bank.md`);
  });
  assert.equal(hash(raw), a.sha256, `corrupt ${a.path}`);
  artifacts[key] = a.path.endsWith(".png")
    ? PNG.sync.read(raw)
    : JSON.parse(raw);
}
assert.equal(Object.keys(artifacts).length, 26);
function batch(r, count) {
  assert.equal(r.isError, false);
  const p = JSON.parse(r.content[0].text);
  assert.equal(p.aborted, false);
  assert.equal(p.results.length, count);
  for (const q of p.results) assert.equal(q.status, "ok");
  return p.results;
}
function bytes(r, length, address) {
  assert.equal(r.op, "mem_read");
  if (address !== undefined) assert.equal(r.addr, address);
  const b = Buffer.from(r.data, "base64");
  assert.equal(b.length, length);
  return b;
}
async function original(name) {
  const b = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}`);
  });
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
  return b;
}
const exe = await original("DUCKTALE.EXE"),
  image = Buffer.from(unpackImage(exe));
const entries = parseArchive(await original("MAC.ARC")),
  font = parseArchive(await original("MAIN.ARC"))[42].data;
const graphics = parseArchive(await original("IT.DRV"))[1].data;
assert.equal(hash(graphics), manifest.source.graphicsSha256);
assert.equal(manifest.expectedArtifactCount, 26);
const reset = artifacts["bank-pure-code-reset"];
assert.equal(reset.isError, false);
assert.deepEqual(JSON.parse(reset.content[0].text), {
  status: "ok",
  addr: 0xe0c0 + 0x6c8,
});
const resident = Buffer.from(image);
const packed = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16;
let cursor = packed + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++, cursor += 2) {
    const at = region * 65536 + exe.readUInt16LE(cursor);
    resident.writeUInt16LE((resident.readUInt16LE(at) + 0x1f5) & 65535, at);
  }
}
const before = batch(artifacts["bank-before-deposit"], 4);
assert.deepEqual(
  bytes(before[2], 74, 0x1f50 + 0x1036),
  resident.subarray(0x1036, 0x1080),
  "original relocated bank caller",
);
assert.deepEqual(
  bytes(before[3], 16, 0x6030 + 0xeb8),
  image.subarray(0x4f98, 0x4fa8),
  "original RNG code",
);
assert.equal(
  hash(image.subarray(0x1036, 0x1080)),
  manifest.source.caller.sha256,
);
const overlay = Buffer.from(exe.subarray(72704, 72704 + 3830));
assert.equal(hash(overlay), manifest.source.overlay.sha256);
const relocated = Buffer.from(overlay.subarray(512));
for (let i = 0; i < overlay.readUInt16LE(6); i++) {
  const at = overlay.readUInt16LE(24) + i * 4;
  const pos =
    overlay.readUInt16LE(at) + (overlay.readUInt16LE(at + 2) - 0xc17) * 16;
  assert.ok(pos >= 0 && pos + 2 <= relocated.length);
  relocated.writeUInt16LE((relocated.readUInt16LE(pos) + 0x1f5) & 65535, pos);
}
const entry = batch(artifacts["bank-original-entry"], 4);
assert.deepEqual(
  [
    entry[0].registers.cs,
    entry[0].registers.eip,
    entry[0].registers.ds,
    entry[0].registers.ss,
  ],
  [0xe0c, 0, 0x1403, 0x1403],
);
assert.deepEqual(
  bytes(entry[2], 3318, 0xe0c0),
  relocated,
  "whole original relocated bank overlay",
);
assert.deepEqual(
  bytes(entry[3], 2599, 0x2ed70).subarray(0xe5, 0x1b1),
  Buffer.from(graphics.subarray(0xe5, 0x1b1)),
  "original EGA flip/reveal/wipe code",
);
const ds = bytes(batch(artifacts["bank-pure-start"], 3)[1], 65536, 0x14030);
assert.equal(ds.readUInt32LE(0x5ae2), 0);
assert.equal(ds.readUInt32LE(0x54f2), 0);
const fresh = (options) =>
  new BankScene({
    entries,
    image,
    banked: 0,
    rivalBanked: 0,
    seed: ds.readUInt16LE(0x2229),
    ...options,
  });
function compareArithmetic({ alter = false, omit = false } = {}) {
  let checked = 0;
  for (let i = 0; i < (omit ? 7 : 9); i++) {
    const a = artifacts[`bank-pure-${i}`],
      expected = i === 8 ? [0, 0] : inputCases[i];
    assert.equal(a.id, i);
    assert.deepEqual([a.banked, a.rivalBanked], expected);
    const setup = JSON.parse(a.setup.content[0].text);
    assert.equal(a.setup.isError, false);
    assert.equal(setup.aborted, false);
    assert.ok(setup.results.length >= 17);
    for (const r of setup.results) assert.equal(r.status, "ok");
    const stop = JSON.parse(a.stopped.content[0].text);
    assert.equal(stop.satisfied, true);
    assert.equal(stop.debugging, true);
    assert.equal(stop.protected_mode, false);
    assert.equal(stop.core, "normal");
    assert.deepEqual([stop.registers.cs, stop.registers.eip], [0xe0c, 0x6c8]);
    const r = batch(a.after, 5),
      b = bytes(r[1], 80, 0x14030 + 40712),
      bp = r[0].registers.ebp;
    const local = (o) => b.readInt16LE(bp + o - 40712);
    const bank = fresh({ banked: a.banked, rivalBanked: a.rivalBanked });
    assert.deepEqual(
      [
        bank.rivalTier,
        bank.playerTier + (alter && i === 0 ? 1 : 0),
        bank.target,
        bank.scaleLimit,
      ],
      [local(-0x12), local(-0x26), local(-0x22), local(-0x14)],
      `bank arithmetic case${i}`,
    );
    assert.equal(bytes(r[3], 4).readUInt32LE(), a.banked);
    assert.equal(bytes(r[4], 4).readUInt32LE(), a.rivalBanked);
    checked++;
  }
  assert.equal(checked, 9, "unfinished bank arithmetic cases/cleanup");
}
compareArithmetic();
assert.throws(() => compareArithmetic({ alter: true }), /bank arithmetic/);
assert.throws(() => compareArithmetic({ omit: true }), /unfinished/);
const bank = fresh({ pollInput: () => false }),
  clock = new Scheduler(bank);
function exactPixels(name, alter = false) {
  const a = artifacts[name],
    r = batch(a.state, 2),
    native = bytes(r[1], 65536, 0x14030);
  const expected = PNG.sync.read(
    Buffer.from(
      a.picture.content.find((c) => c.type === "image").data,
      "base64",
    ),
  );
  assert.deepEqual([expected.width, expected.height], [320, 200]);
  assert.deepEqual(
    expected.data,
    artifacts[`${name}-png`].data,
    "extracted original PNG identity",
  );
  const actual = Buffer.from(
    renderFlightPixels(bank.frame, entries, font, "MAC.ARC"),
  );
  if (alter) actual[0] ^= 1;
  assert.deepEqual(actual, expected.data, `bank original pixels ${name}`);
  for (const [at] of BANK_SPRITES)
    for (const offset of [0, 2, 4, 6, 8, 10])
      assert.equal(
        bank.memory.i(at + offset),
        native.readInt16LE(at + offset),
        `bank sprite${at.toString(16)} field${offset}`,
      );
  for (const [at] of BANK_SPRITES)
    assert.equal(bank.memory.b(at + 18), native[at + 18], "bank sprite frame");
  assert.equal(bank.seed, native.readUInt16LE(0x2229));
}
for (let i = 0; i < 50; i++) bank.advanceRetrace();
exactPixels("bank-first-reveal");
assert.throws(
  () => exactPixels("bank-first-reveal", true),
  /bank original pixels/,
);
let steps = 0;
while (!bank.snapshot().waitingForInputPoll && steps++ < 20000)
  clock.advanceTo(Math.min(clock.tickAt, clock.retraceAt));
assert.equal(bank.phase, "idle");
assert.equal(bank.snapshot().waitingForInputPoll, true);
exactPixels("bank-idle-before-input");
bank.resumeInputPoll();
const random = batch(artifacts["bank-first-random"], 3);
assert.equal(bank.randomDraws, 1);
assert.equal(bank.seed, bytes(random[1], 2).readUInt16LE());
assert.equal(bank.seed, random[0].registers.eax & 65535);

assert.equal(manifest.expectedStreamInputCount, 4);
assert.deepEqual(manifest.streamInputs, [0, 0, 0, 192]);
function stream({ drop = false, alter = false } = {}) {
  const r = batch(artifacts["bank-stream-start"], 3),
    before = bytes(r[1], 65536);
  assert.deepEqual(
    bytes(r[2], 3318, 0xe0c0),
    relocated,
    "fresh second bank overlay identity",
  );
  const b = fresh({
      banked: before.readUInt32LE(0x5ae2),
      rivalBanked: before.readUInt32LE(0x54f2),
      seed: before.readUInt16LE(0x2229),
      pollInput: () => false,
    }),
    scheduler = new Scheduler(b);
  let clocks = 0,
    consumed = 0,
    checked = 0;
  const pump = () => {
    while (!b.snapshot().waitingForInputPoll && clocks++ < 50000)
      scheduler.advanceTo(Math.min(scheduler.tickAt, scheduler.retraceAt));
    assert.equal(
      b.snapshot().waitingForInputPoll,
      true,
      "unfinished bank input reader",
    );
  };
  pump();
  const inputs = drop ? manifest.streamInputs.slice(1) : manifest.streamInputs;
  for (const [i, input] of inputs.entries()) {
    const capture = artifacts[`bank-stream-poll-${i}`];
    assert.equal(capture.id, i);
    assert.equal(input, capture.input, "changed bank input event");
    const stop = JSON.parse(capture.stop.content[0].text);
    assert.equal(stop.satisfied, true);
    assert.equal(stop.debugging, true);
    const c = batch(capture.state, 4),
      cpu = c[0].registers;
    assert.deepEqual(
      [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
      [0xe0c, 0xab1, 0x1403, 0x1403],
    );
    assert.equal(cpu.eax & 255, input);
    const locals = bytes(c[3], 80, 0x14030 + 40710),
      local = (o) => locals.readInt16LE(cpu.ebp + o - 40710);
    if (alter && i === 1) b.seed ^= 1;
    assert.equal(b.seed, bytes(c[1], 2).readUInt16LE(), `bank stream seed${i}`);
    assert.deepEqual(
      [b.idleFrame, b.idleSide],
      [local(-0x1a), local(-0x2a)],
      `bank stream locals${i}`,
    );
    assert.equal(b.phase, "idle");
    checked++;
    b.setControls({ fire: !!(input & 0xc0), direction: null });
    b.resumeInputPoll();
    consumed++;
    pump();
  }
  assert.equal(consumed, 4, "unconsumed required bank input");
  assert.equal(checked, 4, "unfinished bank stream checkpoints");
  assert.equal(b.phase, "outro");
  const wait = artifacts["bank-stream-outro-wait"],
    after = artifacts["bank-stream-main-return"];
  for (const a of [wait, after]) {
    const stop = JSON.parse(a.stop.content[0].text);
    assert.equal(stop.satisfied, true);
    assert.equal(stop.debugging, true);
  }
  const w = batch(wait.state, 2),
    a = batch(after.state, 2),
    wm = bytes(w[1], 65536),
    am = bytes(a[1], 65536);
  assert.deepEqual([w[0].registers.cs, w[0].registers.eip], [0x3b9, 0x9f5]);
  assert.equal(wm.readUInt16LE(w[0].registers.esp + 4), 40);
  assert.deepEqual([a[0].registers.cs, a[0].registers.eip], [0x1f5, 0x1076]);
  assert.equal(b.seed, wm.readUInt16LE(0x2229));
  assert.equal(b.seed, am.readUInt16LE(0x2229));
  // Separate neutral provider for the shared40-read wait. The captured hardware
  // input stream above ends at Fire; this is a conditional wait comparison.
  b.setControls({ fire: false, direction: null });
  const tick = b.tick;
  for (let read = 0; read < 40; read++) {
    assert.equal(b.snapshot().waitingForInputPoll, true);
    b.resumeInputPoll();
    for (let n = 0; n < 7; n++) b.advanceTick();
  }
  assert.equal(b.phase, "return");
  assert.equal(b.complete, false);
  assert.equal(b.tick - tick, 280);
  assert.equal(
    (am.readUInt32LE(0x2225) - wm.readUInt32LE(0x2225)) >>> 0,
    280,
    "native neutral bank wait",
  );
  b.advanceRetrace();
  assert.equal(b.complete, true);
  assert.deepEqual(scheduler.events, []);
}
stream();
assert.throws(
  () => stream({ drop: true }),
  /changed bank input|unconsumed|unfinished/,
);
assert.throws(() => stream({ alter: true }), /bank stream seed/);
console.log(
  "Bank:8 conditional original arithmetic cases plus required zero cleanup,whole relocated overlay/EGA identity,2 exact original PNGs,first RNG checkpoint,4 consumed native inputs/carried checkpoints and conditional280-tick outro;5 negative controls. Full original CPU/IRQ and nonzero animation parity remain unverified.",
);
