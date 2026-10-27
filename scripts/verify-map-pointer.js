import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { advanceMapPointer } from "../src/game/map-pointer.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/map-pointer.json" with { type: "json" };
import inputs from "../reference/map-pointer-inputs.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(manifest.expectedRoutineCases, 24);
assert.equal(manifest.expectedAuthoredInputCount, 16);
assert.equal(Object.keys(manifest.artifacts).length, 4);
const raw = {};
for (const [key, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/campaign-travel.md`);
  });
  assert.equal(hash(b), item.sha256, `corrupt ${item.path}`);
  raw[key] = JSON.parse(b);
}
function unwrap(r) {
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
const mode = unwrap(raw.mode.mode);
assert.equal(mode.debugging, true);
assert.equal(mode.stop.protected_mode, false);
assert.equal(mode.stop.core, "normal");
assert.equal(unwrap(raw.mode.breakpoints).count, 0);
const replay = unwrap(raw.mode.replay);
assert.equal(replay.active, false);
assert.equal(replay.total, 3);
assert.equal(replay.dispatched, 3);
assert.equal(replay.remaining, 0);
function capture(raw, ip, count, index) {
  const r = unwrap(raw);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[index - 1].registers;
  assert.equal(cpu.cs, 0xed6);
  assert.equal(cpu.ds, 0x1403);
  assert.equal(cpu.ss, 0x1403);
  assert.equal(cpu.eip, ip);
  const bytes = Buffer.from(r.results[index].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: r.results };
}
const start = capture(raw.start, 0x1228, 3, 1),
  exe = await readFile("game/DUCKTALE.EXE");
assert.equal(hash(exe), build.files["DUCKTALE.EXE"].sha256);
assert.equal(exe.length, build.files["DUCKTALE.EXE"].bytes);
const at = 0xf600;
assert.equal(exe.readUInt16LE(at), 0x5a4d);
assert.equal(exe.readUInt16LE(at + 6), 180);
const body = Buffer.from(exe.subarray(at + 1024, at + 9392));
assert.equal(body.length, 8368);
for (let i = 0; i < 180; i++) {
  const p = at + exe.readUInt16LE(at + 24) + i * 4,
    o = (exe.readUInt16LE(p + 2) - 0xc17) * 16 + exe.readUInt16LE(p);
  assert.ok(o >= 0 && o + 2 <= body.length);
  body.writeUInt16LE((body.readUInt16LE(o) + 0x1f5) & 65535, o);
}
const live = Buffer.from(start.results[2].data, "base64");
function sameCode(b) {
  assert.deepEqual(live, b, "original map body identity");
}
sameCode(body);
// Runtime CS is allocation+ca paragraphs. Its CS-relative table at1320 lives
// at body1fc0; assuming CS=allocation misdirects Ghidra's switch/decompilation.
assert.deepEqual(
  Array.from(
    { length: 8 },
    (_, i) => body.readUInt16LE(0x1fc0 + i * 2) + 0xca0,
  ),
  [0x1f06, 0x1f1a, 0x1f34, 0x1f48, 0x1f5b, 0x1f68, 0x1f81, 0x1f8e],
);
assert.equal(start.bytes.readUInt16LE(start.cpu.esp + 4), 0x9f46);
assert.equal(start.bytes.readUInt16LE(start.cpu.esp + 6), 0x9f42);
const fields = {
  x: 0x9f46,
  y: 0x9f42,
  acceleration: 0x5514,
  dx: 0x4dc8,
  dy: 0x4e10,
  firstPollLatch: 0x697c,
  inputWord: 0x7948,
  spriteX: 0x8dfa,
  spriteY: 0x8dfc,
};
function state(c) {
  return {
    ...Object.fromEntries(
      Object.entries(fields).map(([k, at]) => [k, c.bytes.readInt16LE(at)]),
    ),
    drawEnabled: !!c.bytes[0x3c1],
  };
}
function compare(trace, codes, authored, { alterState = false } = {}) {
  assert.equal(trace.length, authored ? 16 : 8, "missing map checkpoints");
  assert.equal(codes.length, trace.length, "unconsumed map events");
  let s = state(
      capture(trace[0].before, 0x123d, authored ? 3 : 2, authored ? 2 : 1),
    ),
    checked = 0;
  for (const [i, c] of trace.entries()) {
    const before = capture(
        c.before,
        0x123d,
        authored ? 3 : 2,
        authored ? 2 : 1,
      ),
      incoming = state(before);
    for (const k of Object.keys(fields))
      assert.equal(s[k], incoming[k], `carried map state ${i}:${k}`);
    assert.equal(
      before.cpu.eax & 65535,
      codes[i],
      "unexpected consumed map input",
    );
    if (authored) {
      assert.equal(c.input, codes[i]);
      assert.deepEqual(c.request, {
        ops: [
          { op: "cpu_write", register: "eax", value: codes[i] },
          { op: "cpu_read" },
          { op: "mem_read", segment: "ds", offset: 0, len: 65536 },
        ],
      });
    }
    s = advanceMapPointer(s, codes[i]);
    if (alterState && i === 4) s.acceleration++;
    const after = capture(c.after, 0x140e, 2, 1),
      expected = state(after);
    for (const [at, length] of [
      [0x2229, 2],
      [0x4e0e, 1],
      [0x8cc0, 4],
      [0x5ae2, 4],
      [0x4e0a, 4],
      [0x54f2, 4],
    ])
      assert.deepEqual(
        before.bytes.subarray(at, at + length),
        after.bytes.subarray(at, at + length),
        `map changed RNG/calendar/accounts at ${at.toString(16)}`,
      );
    for (const [k, v] of Object.entries(expected))
      assert.equal(s[k], v, `map divergence ${i}:${k}`);
    assert.equal(Number(s.fire), after.cpu.eax & 65535, `map return ${i}`);
    checked++;
  }
  assert.equal(checked, trace.length);
  return checked;
}
assert.deepEqual(
  inputs.codes,
  [3, 3, 3, 3, 2, 4, 6, 8, 7, 1, 5, 0, 3, 3, 0, 0x43],
);
assert.equal(
  compare(raw.authored, inputs.codes, true) +
    compare(raw.native, [3, 0, 0, 0, 0, 0, 0, 0], false),
  24,
);
assert.throws(
  () => compare(raw.authored, inputs.codes.slice(1), true),
  /unconsumed map events/,
);
assert.throws(
  () => compare(raw.authored, inputs.codes, true, { alterState: true }),
  /map divergence/,
);
const bad = Buffer.from(body);
bad[0x1f34] ^= 1;
assert.throws(() => sameCode(bad), /original map body identity/);
console.log(
  "Map pointer:24 original routine cases,16 carried authored reader inputs,8 native-reader observations,full8368-byte relocated body identity;3 negative controls. Native held-key cadence and whole-map timing are not established.",
);
