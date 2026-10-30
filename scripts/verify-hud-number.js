// Exact conditional original formatter/helpers/EGA text comparison.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { originalGame } from "../tests/helpers/original-game.js";
import { originalHudNumberWork } from "./lib/hud-number-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/hud-number-work.json")),
  r = {};
assert.equal(m.id, "original-hud-number-work");
assert.equal(m.expectedCases, 16);
assert.equal(Object.keys(m.artifacts).length, 26);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing original formatter evidence " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt formatter evidence size");
  assert.equal(sha(b), s.sha256, "Corrupt formatter evidence");
  r[role] = role === "source" ? b : JSON.parse(b);
}
for (const [p, h] of Object.entries(m.sources))
  assert.equal(sha(await readFile(p)), h, "Changed formatter source " + p);
const { image, archives } = await originalGame(),
  exe = await readFile("game/DUCKTALE.EXE"),
  driver = archives.get("IT.DRV")[1].data,
  font = archives.get("MAIN.ARC")[42].data;
for (const [k, b] of Object.entries({ executable: exe, driver, font }))
  assert.equal(sha(b), m[k + "SHA256"]);
function relocate(segment) {
  const loaded = Buffer.from(image);
  let cursor = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
  for (let region = 0; region < 16; region++) {
    const count = exe.readUInt16LE(cursor);
    cursor += 2;
    for (let i = 0; i < count; i++) {
      const at = exe.readUInt16LE(cursor) + region * 65536;
      cursor += 2;
      loaded.writeUInt16LE((loaded.readUInt16LE(at) + segment) & 65535, at);
    }
  }
  assert.equal(
    cursor,
    (exe.readUInt16LE(4) - 1) * 512 + (exe.readUInt16LE(2) || 512),
  );
  return loaded;
}
const loaded = relocate(0x1000);
for (const [k, start, end, base] of [
  ["numeric", 0x227, 0x2a7, 0x1c40],
  ["stack", 0x1e9e, 0x1eb1, 0x40e0],
  ["remainder", 0x4968, 0x4a0a, 0x40e0],
  ["divide", 0x4898, 0x4934, 0x40e0],
  ["assign", 0x4a22, 0x4a46, 0x40e0],
]) {
  const dis = r[k];
  assert.equal(dis.success, true);
  assert.equal(dis.truncated, false);
  let next = start;
  for (const i of dis.instructions) {
    const ip = parseInt(i.address.split(":").at(-1), 16);
    assert.equal(ip, next);
    assert.equal(
      loaded.subarray(base + ip, base + ip + i.length).toString("hex"),
      i.bytes,
      "Original formatter/helper bytes",
    );
    next += i.length;
  }
  assert.equal(next, end);
}
const cap = r.capture;
assert.equal(cap.completed, true);
assert.equal(cap.caseCount, 16);
assert.equal(cap.sourceSHA256, sha(r.source));
assert.equal(cap.pid, r.engine.pid);
assert.equal(cap.instanceId, r.engine.instance_id);
assert.equal(r.engine.capabilities.debugger.limits.effective_core, "normal");
assert.equal(r.allocations.length, 3);
for (let i = 0; i < 3; i++)
  assert.equal(
    r.allocations[i].addr,
    [cap.codeSegment, cap.dataSegment, cap.jumpSegment][i] * 16,
  );
const program = Buffer.alloc(0xb000);
relocate(cap.codeSegment).copy(program, 0, 0, 0x8b26);
Buffer.from(driver).copy(program, 0xa000);
program.writeUInt16LE(0x2000, 0xa01e);
program.writeUInt16LE(0x2020, 0xa022);
assert.equal(cap.programBytes, program.length);
assert.equal(cap.programSHA256, sha(program));
function expectedPorts(text, x, color) {
  const writes = [
    { ip: 0xa875, port: 0x3ce, word: 5 },
    { ip: 0xa87c, port: 0x3c4, word: 0xf02 },
    { ip: 0xa883, port: 0x3ce, word: 0xf01 },
    { ip: 0xa889, port: 0x3ce, word: color << 8 },
  ];
  for (const ch of text) {
    const shift = 8 - (x & 7);
    for (let y = 0; y < 8; y++) {
      const bitmap = font[8 + ch.charCodeAt(0) * 8 + y];
      if (shift === 8)
        writes.push({ ip: 0xa8c9, port: 0x3ce, word: (bitmap << 8) | 8 });
      else {
        const mask = bitmap << shift;
        writes.push(
          { ip: 0xa8df, port: 0x3ce, word: (mask & 0xff00) | 8 },
          { ip: 0xa8e5, port: 0x3ce, word: ((mask & 255) << 8) | 8 },
        );
      }
    }
    x = (x + 8) & 65535;
  }
  return writes;
}
function compare(records = r, inputs = r.inputs) {
  assert.equal(inputs.cases.length, 16, "Missing required formatter cases");
  let instructions = 0,
    writes = 0;
  const bases = {
    formatter: 0x1c40,
    stack: 0x40e0,
    divide: 0x40e0,
    remainder: 0x40e0,
    assign: 0x40e0,
    driver: 0xa000,
  };
  for (let i = 0; i < 16; i++) {
    const c = inputs.cases[i],
      n = records["case-" + String(i).padStart(2, "0")];
    assert.equal(n.index, i);
    assert.deepEqual(n.input, c, "Independent formatter input changed");
    const trace = [],
      got = originalHudNumberWork(c, {
        instruction: (kind, ip) => trace.push(bases[kind] + ip),
      });
    assert.deepEqual(trace, n.trace, "Original formatter instruction path");
    assert.equal(got.instructions, n.trace.length);
    assert.equal(got.portWrites, n.ports.length);
    assert.deepEqual(
      expectedPorts(got.text, got.x, c.color),
      n.ports,
      "Original formatter port values",
    );
    assert.equal(n.textCall.string, got.text, "Original formatted number");
    assert.deepEqual(
      n.textCall.words,
      [
        c.color,
        c.y,
        got.x & 65535,
        0xfed8 - got.text.length,
        0x3000,
        cap.dataSegment,
      ],
      "Original text arguments",
    );
    assert.equal(n.entry.registers.cs, cap.codeSegment + 0x1c4);
    assert.equal(n.entry.registers.eip, 0x227);
    assert.equal(n.entry.registers.ds, cap.dataSegment);
    assert.equal(n.entry.registers.ss, cap.dataSegment);
    assert.equal(n.entry.registers.esp, 0xfede);
    assert.equal(n.final.registers.cs, cap.codeSegment);
    assert.equal(n.final.registers.eip, 0xc01c);
    assert.equal(n.final.registers.esp, 0xfee2);
    assert.equal(n.final.registers.flags & 0x600, 0);
    assert.equal(n.code.aborted, false);
    assert.equal(n.code.results.length, 1);
    assert.equal(n.code.results[0].status, "ok");
    assert.deepEqual(
      Buffer.from(n.code.results[0].data, "base64"),
      program,
      "Original formatter code modified",
    );
    instructions += trace.length;
    writes += n.ports.length;
  }
  assert.equal(instructions, m.expectedInstructions);
  assert.equal(writes, m.expectedPortWrites);
  return { instructions, writes };
}
const result = compare();
const path = structuredClone(r);
path["case-00"].trace[1]++;
assert.throws(() => compare(path), /instruction path/);
const ports = structuredClone(r);
ports["case-00"].ports[0].word++;
assert.throws(() => compare(ports), /port values/);
const text = structuredClone(r);
text["case-11"].textCall.string = "2147483648";
assert.throws(() => compare(text), /formatted number/);
const input = structuredClone(r.inputs);
input.cases[0].value = 1;
assert.throws(() => compare(r, input), /input changed/);
const missing = structuredClone(r.inputs);
missing.cases.pop();
assert.throws(() => compare(r, missing), /Missing required/);
const code = structuredClone(r);
let b = Buffer.from(code["case-00"].code.results[0].data, "base64");
b[0x8a48] ^= 1;
code["case-00"].code.results[0].data = b.toString("base64");
assert.throws(() => compare(code), /code modified/);
assert.throws(
  () => originalHudNumberWork({ value: 0, x: 0, stackAvailable: false }),
  /stack exhaustion/,
);
console.log(
  `Original HUD formatter:16 carried private native calls,${result.instructions} exact instruction addresses,${result.writes} port values,all45056 relocated code/driver bytes;6 negative controls. Signed32 quirks and actual text arguments exact. Conditional RAM surface,not pixels or natural cadence.`,
);
