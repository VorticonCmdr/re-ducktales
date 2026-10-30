// Conditional native copy-call/effect comparison. The native graphics pointer is
// an explicit preserving RETF16 stub; this is not EGA primitive/cadence parity.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  egaCopyWork,
  normalCoreGraphicsMilliseconds,
} from "../src/game/ega-work.js";
import { eraseMountainSource } from "./lib/mountain-erase.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/mountain-erase-work.json")),
  data = {};
assert.equal(m.id, "original-mountain-erase-call-plan");
assert.equal(m.expectedCases, 34);
assert.equal(m.expectedOriginalFrameStateSegments, 14);
assert.equal(m.expectedNegativeControls, 8);
assert.equal(Object.keys(m.artifacts).length, 61);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing mountain erase evidence " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt erase evidence size");
  assert.equal(sha(b), s.sha256, "Corrupt erase evidence");
  data[role] = role === "source" ? b : JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed erase source " + p);
const { image } = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE"),
  overlay = exe.subarray(0x17600, 0x17600 + 12514),
  body = overlay.subarray(512);
assert.equal(sha(exe), m.executableSHA256);
assert.equal(sha(body), m.overlayBodySHA256);
assert.equal(body.length, 12002);
function coverage(instructions, start, end, base = 0, byteCheck = true) {
  let next = start;
  for (const i of instructions) {
    const [s, o] = i.address.split(":").map((x) => parseInt(x, 16)),
      at = s * 16 + o - base;
    assert.equal(at, next, "Instruction coverage gap at" + next.toString(16));
    if (byteCheck)
      assert.equal(
        Buffer.from(body.subarray(at, at + i.length)).toString("hex"),
        i.bytes,
        "Original erase instruction bytes",
      );
    next += i.length;
  }
  assert.equal(next, end, "Incomplete erase code range");
}
for (const [role, start, end] of [
  ["erase-actor", 0x156a, 0x166c],
  ["erase-body", 0x282a, 0x2a30],
  ["erase-mid", 0x2a44, 0x2b80],
  ["erase-tail", 0x2b8c, 0x2d09],
  ["hud", 0x1744, 0x189e],
  ["draw", 0x1320, 0x1436],
]) {
  const r = data[role];
  assert.equal(r.success, true);
  assert.equal(r.truncated, false);
  coverage(r.instructions, start, end);
}
assert.throws(
  () => coverage(data.legacy.instructions, 0x282a, 0x2a8a, 0x1c170, false),
  /coverage gap at288e/,
);
assert.deepEqual(
  Array.from(
    { length: 10 },
    (_, i) => body[0x2a30 + i * 2] + body[0x2a31 + i * 2] * 256 + 0x1890,
  ),
  [
    0x2a44, 0x2a44, 0x28fa, 0x2954, 0x283f, 0x2a44, 0x2999, 0x2a44, 0x2a44,
    0x29e7,
  ],
);
assert.deepEqual(
  Array.from(
    { length: 6 },
    (_, i) => body[0x2b80 + i * 2] + body[0x2b81 + i * 2] * 256 + 0x1890,
  ),
  [0x2ab6, 0x2aff, 0x2aff, 0x2b8c, 0x2b10, 0x2b4c],
);
const cap = data.capture;
assert.equal(cap.completed, true);
assert.equal(cap.caseCount, 34);
assert.equal(cap.sourceSHA256, sha(data.source));
assert.equal(cap.pid, data.engine.pid);
assert.equal(cap.instanceId, data.engine.instance_id);
assert.equal(data.engine.capabilities.debugger.limits.effective_core, "normal");
const configuration = data.configuration;
assert.equal(configuration.binary.sha256.length, 64);
assert.ok(configuration.binary.bytes > 0);
assert.equal(configuration.bridgeFiles.length, 3);
for (const f of configuration.bridgeFiles) {
  assert.match(f.sha256, /^[0-9a-f]{64}$/);
  assert.ok(f.bytes > 0);
}
assert.equal(configuration.headless, true);
assert.equal(configuration.mute, true);
assert.equal(configuration.isolatedConfiguration, true);
assert.notEqual(configuration.port, 8386);
assert.deepEqual(configuration.argv.slice(0, 7), [
  configuration.binary.path,
  "--noprimaryconf",
  "--nolocalconf",
  "--set",
  "webserver_enabled=true",
  "--set",
  `webserver_port=${configuration.port}`,
]);
assert.equal(data.allocations.length, 3);
for (let i = 0; i < 3; i++)
  assert.equal(
    data.allocations[i].addr,
    [cap.codeSegment, cap.dataSegment, cap.jumpSegment][i] * 16,
  );
assert.deepEqual(cap.stackScratch, [0xfeb0, 0xfef0]);
const program = Buffer.concat([
  Buffer.from(image.subarray(0, 0xc170)),
  Buffer.from(body),
]);
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
  const pos = overlay.readUInt16LE(24) + i * 4,
    at = overlay.readUInt16LE(pos + 2) * 16 + overlay.readUInt16LE(pos);
  assert.ok(at >= 0xc170 && at < program.length - 1);
  program.writeUInt16LE(
    (program.readUInt16LE(at) + cap.codeSegment) & 65535,
    at,
  );
}
assert.equal(cap.programBytes, program.length);
assert.equal(cap.programSHA256, sha(program));
assert.equal(program.length, 61522);
const inputs = data.inputs;
const parentBytes = await readFile(inputs.parent.path);
assert.equal(sha(parentBytes), inputs.parent.sha256);
const initials = [];
for (const c of inputs.cases) {
  const b = await readFile(c.initial.path);
  assert.equal(sha(b), c.initial.sha256);
  assert.equal(b.length, c.initial.bytes);
  const r = JSON.parse(b);
  assert.equal(r.state.aborted, false);
  assert.ok(r.state.results.every((x) => x.status === "ok"));
  initials.push(Buffer.from(r.state.results[1].data, "base64"));
}
const words = (c) =>
  [c.height, c.width, c.y, c.x, c.to, c.sourceY, c.sourceX, c.from].map(
    (v) => v & 65535,
  );
function compare(records = data, cases = inputs.cases) {
  assert.equal(cases.length, 34, "Missing required erase cases");
  let total = 0;
  const costs = [];
  for (let i = 0; i < 34; i++) {
    const event = cases[i],
      r = records["case-" + String(i).padStart(2, "0")];
    assert.equal(r.index, i);
    assert.deepEqual(event, r.input, "Native erase input changed");
    const b = Buffer.from(initials[i]);
    for (const [at, width, value] of event.patches) {
      if (width === 1) b[at] = value & 255;
      else b.writeUInt16LE(value & 65535, at);
    }
    b.writeUInt16LE(0xf100, 0x1fec);
    b.writeUInt16LE(cap.codeSegment, 0x1fee);
    b.writeUInt16LE(0, 0x295c);
    const memory = new FlightMemory(b),
      copies = [];
    eraseMountainSource(memory, event.firstRow, (c) => copies.push(c));
    assert.deepEqual(
      copies.map(words),
      r.copies,
      "Native erase copy arguments",
    );
    assert.equal(r.entry.registers.cs, cap.codeSegment + 0xc17);
    assert.equal(r.entry.registers.eip, 0x156a);
    assert.equal(r.entry.registers.esp, 0xfeea);
    assert.equal(r.final.registers.cs, cap.codeSegment);
    assert.equal(r.final.registers.eip, 0xf20a);
    assert.equal(r.final.registers.esp, 0xfeee);
    assert.equal(r.final.registers.flags & 0x600, 0);
    assert.ok(r.trace.length > 0, "No native erase instructions executed");
    assert.equal(r.trace[0], 0xc170 + 0x156a);
    for (const at of r.trace)
      assert.ok(
        Number.isInteger(at) &&
          ((at >= 0x5f7e && at < 0x5f91) ||
            (at >= 0xd6da && at < 0xd7dc) ||
            (at >= 0xe99a && at < 0xee79) ||
            at === 0xf100),
        "Unsupported native erase instruction",
      );
    assert.equal(
      r.trace.filter((at) => at === 0xf100).length,
      r.copies.length,
      "Unconsumed native copy observations",
    );
    assert.equal(r.after.aborted, false);
    assert.equal(r.after.results.length, 2);
    assert.ok(r.after.results.every((x) => x.status === "ok"));
    const actual = Buffer.from(r.after.results[0].data, "base64"),
      expected = Buffer.from(memory.bytes.subarray(0, 65535));
    assert.equal(actual.length, 65535);
    actual.fill(0, 0xfeb0, 0xfef0);
    expected.fill(0, 0xfeb0, 0xfef0);
    assert.deepEqual(actual, expected, "Native erase DS effects");
    assert.deepEqual(
      Buffer.from(r.after.results[1].data, "base64"),
      program,
      "Original erase code modified",
    );
    total += copies.length;
    if (i < 14) {
      // Actual original frame segment (unmodified graphics vector),separate
      // from the private stub experiment. Compare only declared game state;
      // original IRQ clocks,stack and EGA pixels are outside this claim.
      const original =
        records["profile-" + String(i).padStart(2, "0") + "-after"];
      assert.equal(original.state.aborted, false);
      assert.ok(original.state.results.every((x) => x.status === "ok"));
      const originalDS = Buffer.from(original.state.results[1].data, "base64");
      const ranges = [
        [memory.view.getUint16(0x5d26, true), 150],
        [0x17da, 12],
        [0x4cf2, 2],
        [0x3706, 6],
        [0x2229, 2],
        [0x8cc0, 4],
        [0x4e0e, 1],
      ];
      for (const [at, length] of ranges)
        assert.deepEqual(
          Buffer.from(memory.bytes.subarray(at, at + length)),
          originalDS.subarray(at, at + length),
          "Original frame erase game-state range " + at.toString(16),
        );
      const sum = {
        instructions: 0,
        portWrites: 0,
        repeatOpcodes: 0,
        repeatIterations: 0,
      };
      for (const c of copies) {
        assert.ok(
          c.sourceY >= 0 && c.y >= 0,
          "Native walk left bounded copy work domain",
        );
        const cost = egaCopyWork({
          width: c.width,
          height: c.height,
          sourceX: 0,
          sourceY: c.sourceY,
          destinationX: 0,
          destinationY: c.y,
          sourceStrideBytes: 40,
          destinationStrideBytes: 40,
          sourceVideo: false,
          destinationVideo: true,
        });
        for (const k of Object.keys(sum)) sum[k] += cost[k];
      }
      costs.push({
        id: event.id,
        copies: copies.length,
        ...sum,
        milliseconds: normalCoreGraphicsMilliseconds(sum, 3000),
      });
    }
  }
  assert.equal(total, m.expectedCopyCalls);
  assert.equal(costs.length, 14);
  return { total, costs };
}
const result = compare();
const wrong = structuredClone(data);
wrong["case-00"].copies[0][3] ^= 8;
assert.throws(() => compare(wrong), /copy arguments/);
const ds = structuredClone(data);
let b = Buffer.from(ds["case-00"].after.results[0].data, "base64");
b[0x2229] ^= 1;
ds["case-00"].after.results[0].data = b.toString("base64");
assert.throws(() => compare(ds), /DS effects/);
const code = structuredClone(data);
b = Buffer.from(code["case-00"].after.results[1].data, "base64");
b[0xc170 + 0x156a] ^= 1;
code["case-00"].after.results[1].data = b.toString("base64");
assert.throws(() => compare(code), /code modified/);
assert.throws(() => compare(data, inputs.cases.slice(1)), /Missing required/);
const input = structuredClone(inputs.cases);
input[0].firstRow = 1;
assert.throws(() => compare(data, input), /input changed/);
const emptyTrace = structuredClone(data);
emptyTrace["case-00"].trace = [];
assert.throws(() => compare(emptyTrace), /No native erase instructions/);
const unsupportedTrace = structuredClone(data);
unsupportedTrace["case-00"].trace.push(0);
assert.throws(
  () => compare(unsupportedTrace),
  /Unsupported native erase instruction/,
);
const unknown = new FlightMemory(initials[0]);
unknown.b(0x17db, 3);
assert.throws(() => eraseMountainSource(unknown, 0, () => {}), /cloud state/);
console.log(
  JSON.stringify(
    {
      scope:
        "Conditional erase call-plan/effects comparison with explicit copy stub,not primitive/pixel/natural timing or runtime acceptance.",
      cases: 34,
      copies: result.total,
      matchedDSBytesPerCase: 65471,
      codeBytes: 61522,
      negativeControls: 8,
      originalFrameStateSegments: 14,
      walkCosts: result.costs,
    },
    null,
    2,
  ),
);
