// Conditional native instruction/port comparison; not scanout or cadence parity.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { egaTransparentTextWork } from "./lib/ega-text-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/ega-text-native.json")),
  records = {};
assert.equal(m.expectedCases, 14);
assert.equal(m.expectedInstructions, 2963);
assert.equal(m.expectedPortWrites, 312);
assert.equal(Object.keys(m.artifacts).length, 38);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing native text evidence " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt text evidence size");
  assert.equal(sha(b), s.sha256, "Corrupt text evidence");
  records[role] = role.endsWith("source") ? b : JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed native text source " + p);
const { archives } = await originalGame(),
  driver = archives.get("IT.DRV")[1].data,
  font = archives.get("MAIN.ARC")[42].data;
assert.equal(sha(driver), m.driverSHA256);
assert.equal(sha(font), m.fontSHA256);
const cap = records.capture;
assert.equal(cap.completed, true);
assert.equal(cap.caseCount, 14);
assert.equal(cap.captureToolSHA256, sha(records.source));
assert.equal(cap.driverSHA256, m.driverSHA256);
assert.equal(cap.fontSHA256, m.fontSHA256);
assert.equal(cap.pid, records.engine.pid);
assert.equal(cap.instanceId, records.engine.instance_id);
assert.equal(
  records.engine.capabilities.debugger.limits.effective_core,
  "normal",
);
assert.equal(cap.segment * 16, records.allocation.addr);
function ports(c) {
  const result = [
    { ip: 0x875, port: 0x3ce, word: 5 },
    { ip: 0x87c, port: 0x3c4, word: 0xf02 },
    { ip: 0x883, port: 0x3ce, word: 0xf01 },
    { ip: 0x889, port: 0x3ce, word: c.color << 8 },
  ];
  let x = c.x & 65535,
    di = (x + c.surfaceOffset) & 65535;
  for (const ch of c.text.split("\0")[0]) {
    const glyph = ch.charCodeAt(0),
      shift = 8 - (di & 7);
    for (let y = 0; y < 8; y++) {
      const bitmap = font[8 + glyph * 8 + y];
      if (shift === 8)
        result.push({ ip: 0x8c9, port: 0x3ce, word: (bitmap << 8) | 8 });
      else {
        const mask = (bitmap << shift) & 65535;
        result.push(
          { ip: 0x8df, port: 0x3ce, word: (mask & 0xff00) | 8 },
          { ip: 0x8e5, port: 0x3ce, word: ((mask & 255) << 8) | 8 },
        );
      }
    }
    x = (x + 8) & 65535;
    di = x;
  }
  return result;
}
function compare(data = records, inputs = records.inputs, context = cap) {
  assert.equal(inputs.cases.length, 14, "Missing required text cases");
  assert.equal(inputs.driverSHA256, m.driverSHA256);
  assert.equal(inputs.fontSHA256, m.fontSHA256);
  let instructions = 0,
    writes = 0;
  const expectedDriver = Uint8Array.from(driver),
    v = new DataView(expectedDriver.buffer);
  v.setUint16(0x1e, 0x2000, true);
  v.setUint16(0x22, 0x2020, true);
  for (let i = 0; i < 14; i++) {
    const c = inputs.cases[i],
      r = data["case-" + String(i).padStart(2, "0")];
    assert.equal(r.index, i);
    assert.deepEqual(r.input, c, "Independent text input changed");
    const trace = [],
      work = egaTransparentTextWork(c, { instruction: (ip) => trace.push(ip) });
    assert.deepEqual(trace, r.trace, "Native text instruction path");
    assert.equal(work.instructions, r.trace.length);
    assert.equal(work.portWrites, r.ports.length);
    assert.deepEqual(ports(c), r.ports, "Native text port values");
    assert.equal(r.final.registers.cs, context.segment);
    assert.equal(r.final.registers.eip, 0x4019);
    assert.equal(r.final.registers.esp, 0xfef0);
    assert.equal(r.final.registers.flags & 0x600, 0);
    assert.equal(r.driver.aborted, false);
    assert.equal(r.driver.results.length, 1);
    assert.equal(r.driver.results[0].status, "ok");
    assert.deepEqual(
      new Uint8Array(Buffer.from(r.driver.results[0].data, "base64")),
      expectedDriver,
      "Unexpected text driver modification",
    );
    instructions += trace.length;
    writes += r.ports.length;
  }
  assert.equal(instructions, 2963);
  assert.equal(writes, 312);
  return { instructions, writes };
}
const result = compare();
const repeat = Object.fromEntries(
  Object.entries(records)
    .filter(([k]) => k.startsWith("repeat-"))
    .map(([k, v]) => [k.slice(7), v]),
);
assert.equal(repeat.capture.completed, true);
assert.equal(
  repeat.engine.capabilities.debugger.limits.effective_core,
  "normal",
);
assert.equal(repeat.capture.caseCount, 14);
assert.equal(repeat.capture.captureToolSHA256, sha(repeat.source));
assert.equal(repeat.capture.captureToolSHA256, cap.captureToolSHA256);
assert.equal(repeat.capture.driverSHA256, m.driverSHA256);
assert.equal(repeat.capture.fontSHA256, m.fontSHA256);
assert.notEqual(repeat.capture.instanceId, cap.instanceId);
assert.equal(repeat.capture.instanceId, repeat.engine.instance_id);
assert.equal(repeat.capture.pid, repeat.engine.pid);
assert.equal(repeat.capture.segment * 16, repeat.allocation.addr);
assert.deepEqual(repeat.inputs, records.inputs);
assert.deepEqual(compare(repeat, repeat.inputs, repeat.capture), result);

const path = structuredClone(records);
path["case-00"].trace[0]++;
assert.throws(() => compare(path), /instruction path/);
const output = structuredClone(records);
output["case-00"].ports[0].word++;
assert.throws(() => compare(output), /port values/);
const input = structuredClone(records.inputs);
input.cases[0].x = 1;
assert.throws(() => compare(records, input), /input changed/);
const missing = structuredClone(records.inputs);
missing.cases.pop();
assert.throws(() => compare(records, missing), /Missing required/);
const altered = structuredClone(records);
const b = Buffer.from(altered["case-00"].driver.results[0].data, "base64");
b[0x81f] ^= 1;
altered["case-00"].driver.results[0].data = b.toString("base64");
assert.throws(() => compare(altered), /driver modification/);
console.log(
  `Original transparent text:two independent private captures of14 carried native calls each,${result.instructions} exact instruction addresses,${result.writes} exact port writes,all2599 driver bytes;5 negative controls. RAM target,not pixels,natural cadence or runtime timing integration.`,
);
