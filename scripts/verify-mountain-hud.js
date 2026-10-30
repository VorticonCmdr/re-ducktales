// Native caller comparison with explicit effect stubs;not pixel/time acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { drawMountainHudSource } from "./lib/mountain-hud.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/mountain-hud-work.json")),
  data = {};
assert.equal(m.id, "original-mountain-hud-calls");
assert.equal(m.expectedCases, 12);
assert.equal(Object.keys(m.artifacts).length, 20);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing mountain HUD evidence " + s.path);
  });
  assert.equal(b.length, s.bytes);
  assert.equal(sha(b), s.sha256, "Corrupt HUD artifact");
  data[role] = role === "source" ? b : JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed HUD source " + p);
const { image } = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE"),
  overlay = exe.subarray(0x17600, 0x17600 + 12514),
  body = overlay.subarray(512);
assert.equal(sha(exe), m.executableSHA256);
assert.equal(sha(body), m.overlayBodySHA256);
let next = 0x1744;
const ips = new Set();
for (const i of data.disassembly.instructions) {
  const at = parseInt(i.address.split(":").at(-1), 16);
  assert.equal(at, next);
  assert.equal(body.subarray(at, at + i.length).toString("hex"), i.bytes);
  ips.add(at + 0xc170);
  next += i.length;
}
assert.equal(next, 0x189e);
assert.equal(data.disassembly.truncated, false);
// The entry result overruns its requested102-byte range by one instruction;
// check the actual contiguous104 bytes,not the tool's requested-byte summary.
let entryNext = 0;
for (const i of data.entry.instructions) {
  const at = parseInt(i.address.split(":").at(-1), 16);
  assert.equal(at, entryNext);
  assert.equal(body.subarray(at, at + i.length).toString("hex"), i.bytes);
  entryNext += i.length;
}
assert.equal(entryNext, 0x68);
for (const [at, address, value] of [
  [0x4b, 0x36d6, 40],
  [0x51, 0x36d8, 172],
  [0x57, 0x370c, 8],
  [0x5d, 0x370e, 175],
]) {
  assert.equal(body.readUInt16LE(at), 0x06c7);
  assert.equal(body.readUInt16LE(at + 2), address);
  assert.equal(body.readUInt16LE(at + 4), value);
}
for (const off of [0, 1, 2, 4, 6, 8, 12, 14, 16, 17, 18]) ips.add(0x5f7e + off);
for (const at of [0xf100, 0x4190, 0x1e67]) ips.add(at);
const cap = data.capture;
assert.equal(cap.completed, true);
assert.equal(cap.caseCount, 12);
assert.equal(cap.sourceSHA256, sha(data.source));
assert.equal(cap.pid, data.engine.pid);
assert.equal(cap.instanceId, data.engine.instance_id);
assert.equal(data.engine.capabilities.debugger.limits.effective_core, "normal");
assert.equal(data.configuration.isolatedConfiguration, true);
assert.equal(data.configuration.headless, true);
assert.equal(data.configuration.mute, true);
assert.notEqual(data.configuration.port, 8386);
assert.match(data.configuration.binary.sha256, /^[0-9a-f]{64}$/);
assert.equal(data.configuration.bridgeFiles.length, 3);
assert.deepEqual(data.configuration.argv.slice(0, 7), [
  data.configuration.binary.path,
  "--noprimaryconf",
  "--nolocalconf",
  "--set",
  "webserver_enabled=true",
  "--set",
  `webserver_port=${data.configuration.port}`,
]);
for (let i = 0; i < 3; i++)
  assert.equal(
    data.allocations[i].addr,
    [cap.codeSegment, cap.dataSegment, cap.jumpSegment][i] * 16,
  );
const program = Buffer.concat([Buffer.from(image.subarray(0, 0xc170)), body]);
let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(cursor);
  cursor += 2;
  for (let i = 0; i < count; i++) {
    const at = exe.readUInt16LE(cursor) + region * 65536;
    cursor += 2;
    if (at < 0xc170)
      program.writeUInt16LE(
        (program.readUInt16LE(at) + cap.codeSegment) & 65535,
        at,
      );
  }
}
assert.equal(
  cursor,
  (exe.readUInt16LE(4) - 1) * 512 + (exe.readUInt16LE(2) || 512),
);
assert.equal(overlay.readUInt16LE(6), 68);
for (let i = 0; i < 68; i++) {
  const p = overlay.readUInt16LE(24) + i * 4,
    at = overlay.readUInt16LE(p + 2) * 16 + overlay.readUInt16LE(p);
  assert.ok(at >= 0xc170 && at < program.length - 1);
  program.writeUInt16LE(
    (program.readUInt16LE(at) + cap.codeSegment) & 65535,
    at,
  );
}
// Explicit preserving observers;original HUD and stack helper stay untouched.
program[0x4190] = 0xcb;
program[0x1e67] = 0xcb;
assert.equal(sha(program), cap.programSHA256);
assert.equal(program.length, 61522);
const inputs = data.inputs;
assert.equal(inputs.cases.length, 12);
const parent = await readFile(inputs.parent.path);
assert.equal(sha(parent), inputs.parent.sha256);
const initials = [];
for (const event of inputs.cases) {
  const b = await readFile(event.initial.path);
  assert.equal(sha(b), event.initial.sha256);
  const r = JSON.parse(b);
  assert.equal(r.state.aborted, false);
  initials.push(Buffer.from(r.state.results[1].data, "base64"));
}
function compare(records = data, cases = inputs.cases) {
  assert.equal(cases.length, 12, "Missing HUD cases");
  let count = 0;
  for (let i = 0; i < 12; i++) {
    const event = cases[i],
      r = records["case-" + String(i).padStart(2, "0")];
    assert.equal(r.index, i);
    assert.deepEqual(r.input, event, "HUD input changed");
    const b = Buffer.from(initials[i]);
    for (const [at, w, v] of event.patches)
      if (w === 1) b[at] = v & 255;
      else b.writeUInt16LE(v & 65535, at);
    b.writeUInt16LE(0xf100, 0x1ff0);
    b.writeUInt16LE(cap.codeSegment, 0x1ff2);
    b.writeUInt16LE(0, 0x295c);
    b.writeUInt16LE(0x3000, 0x2034);
    b.writeUInt16LE(cap.dataSegment, 0x2036);
    b[0x3000] = 14;
    const memory = new FlightMemory(b),
      calls = [];
    drawMountainHudSource(memory, {
      line: (c) =>
        calls.push({
          kind: "line",
          args: [c.x, c.y, c.x2, c.y2].map((v) => v & 65535),
          color: c.color,
        }),
      draw: (at) => calls.push({ kind: "draw", args: [at] }),
      number: (c) =>
        calls.push({
          kind: "number",
          args: [
            c.x,
            c.y,
            c.value & 65535,
            (c.value >>> 16) & 65535,
            c.color,
            c.background,
            Number(c.rightAlign),
          ],
        }),
    });
    assert.deepEqual(calls, r.calls, "Native HUD calls");
    count += calls.length;
    assert.equal(r.entry.registers.cs, cap.codeSegment + 0xc17);
    assert.equal(r.entry.registers.eip, 0x1744);
    assert.equal(r.entry.registers.esp, 0xfeec);
    assert.equal(r.final.registers.cs, cap.codeSegment);
    assert.equal(r.final.registers.eip, 0xf207);
    assert.equal(r.final.registers.esp, 0xfef0);
    assert.equal(r.final.registers.flags & 0x600, 0);
    assert.equal(r.final.protected_mode, false);
    assert.ok(r.trace.length > 0, "No HUD execution");
    assert.equal(r.trace[0], 0xd8b4);
    for (const at of r.trace)
      assert.ok(ips.has(at), "Unsupported HUD instruction");
    assert.equal(
      r.trace.filter((at) => [0x1e67, 0x4190, 0xf100].includes(at)).length,
      calls.length,
      "Unconsumed HUD calls",
    );
    assert.equal(r.after.aborted, false);
    assert.equal(r.after.results.length, 2);
    assert.ok(r.after.results.every((v) => v.status === "ok"));
    const actual = Buffer.from(r.after.results[0].data, "base64"),
      expected = Buffer.from(memory.bytes.subarray(0, 65535));
    assert.equal(actual.length, 65535);
    actual.fill(0, 0xfeb0, 0xfef0);
    expected.fill(0, 0xfeb0, 0xfef0);
    assert.deepEqual(actual, expected, "HUD DS effects");
    assert.deepEqual(
      Buffer.from(r.after.results[1].data, "base64"),
      program,
      "HUD code changed",
    );
  }
  assert.equal(count, 486);
  return count;
}
const count = compare();
const bad = structuredClone(data);
bad["case-00"].calls[0].color ^= 1;
assert.throws(() => compare(bad), /HUD calls/);
const number = structuredClone(data);
number["case-00"].calls.at(-1).args[0]++;
assert.throws(() => compare(number), /HUD calls/);
const ds = structuredClone(data);
let b = Buffer.from(ds["case-00"].after.results[0].data, "base64");
b[0x3732] ^= 1;
ds["case-00"].after.results[0].data = b.toString("base64");
assert.throws(() => compare(ds), /DS effects/);
const code = structuredClone(data);
b = Buffer.from(code["case-00"].after.results[1].data, "base64");
b[0xd8b4] ^= 1;
code["case-00"].after.results[1].data = b.toString("base64");
assert.throws(() => compare(code), /code changed/);
assert.throws(() => compare(data, inputs.cases.slice(1)), /Missing HUD/);
const input = structuredClone(inputs.cases);
input[0].patches.push([0x4e0e, 1, 9]);
assert.throws(() => compare(data, input), /input changed/);
const trace = structuredClone(data);
trace["case-00"].trace.push(0);
assert.throws(() => compare(trace), /Unsupported HUD/);
const empty = structuredClone(data);
empty["case-00"].trace = [];
assert.throws(() => compare(empty), /No HUD execution/);
console.log(
  JSON.stringify(
    {
      scope:
        "Conditional original full-HUD caller with declared effect stubs,not primitives/pixels/natural cadence",
      cases: 12,
      calls: count,
      matchedDSBytesPerCase: 65471,
      codeBytes: 61522,
      negativeControls: 8,
    },
    null,
    2,
  ),
);
