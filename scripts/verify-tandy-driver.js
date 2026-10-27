import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import build from "../reference/build.json" with { type: "json" };
import manifest from "../reference/tandy-driver.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const raw = {};
for (const [key, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/tandy-audio.md`);
  });
  assert.equal(hash(b), item.sha256, `SETUP: corrupt ${item.path}`);
  raw[key] = JSON.parse(b);
}
function unwrap(r) {
  assert.equal(r.isError, false, "capture tool failure");
  return JSON.parse(r.content[0].text);
}
function batch(r, count) {
  const b = unwrap(r);
  assert.equal(b.aborted, false);
  assert.equal(b.results.length, count);
  assert.ok(b.results.every((r) => r.status === "ok"));
  return b.results;
}
function capture(r, ip, count = 2) {
  const b = batch(r, count),
    cpu = b[0].registers;
  for (const k of ["cs", "ds", "ss", "es"])
    assert.equal(cpu[k], 0x459c, `native ${k}`);
  assert.equal(cpu.eip, ip);
  assert.equal(b[1].addr, 285120);
  const memory = Buffer.from(b[1].data, "base64");
  assert.equal(memory.length, 65535);
  if (count === 3) {
    assert.equal(b[2].addr, 0x418);
    assert.equal(Buffer.from(b[2].data, "base64").length, 1);
  }
  return {
    memory,
    bios: count === 3 ? Buffer.from(b[2].data, "base64")[0] : null,
  };
}
function ports(writes) {
  return writes.map((r) => {
    const s = unwrap(r),
      bytes = Buffer.from(s.code_bytes, "base64");
    assert.equal(s.protected_mode, false);
    assert.equal(s.core, "normal");
    assert.equal(s.satisfied, true);
    assert.equal(s.registers.cs, 0x459c);
    assert.equal(bytes[0], 0xe6, "captured OUT imm8,AL");
    assert.ok([0xc0, 0x61].includes(bytes[1]));
    assert.equal(s.registers.eip, s.breakpoint.offset);
    assert.deepEqual(
      bytes.subarray(0, 2),
      Buffer.from(driver).subarray(s.registers.eip, s.registers.eip + 2),
    );
    return [bytes[1], s.registers.eax & 255];
  });
}
for (const name of ["DUCKTALE.EXE", "IT.DRV"]) {
  const b = await readFile(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
}
const entries = parseArchive(await readFile("game/IT.DRV"), "IT.DRV"),
  driver = entries[4].data;
assert.equal(driver.length, 12339);
assert.equal(hash(driver), manifest.driver.sha256);
assert.equal(manifest.expected.checkpoints, 18);
assert.equal(manifest.expected.portWrites, 15);
// This machine had selected the speaker rendition, not resource004. Compare
// immutable routine bytes; installed driver mutable globals are not an identity.
const installed = batch(raw["original-speaker"], 1)[0];
assert.equal(installed.addr, 0x2f7b0);
assert.deepEqual(
  Buffer.from(installed.data, "base64").subarray(0x408, 0x92b),
  Buffer.from(entries[5].data).subarray(0x408, 0x92b),
);

function verify(data, input = manifest.inputs) {
  assert.equal(data.starts.length, 10, "missing start checkpoints");
  assert.equal(input.startArguments.length, 10, "unconsumed start inputs");
  assert.equal(input.tickCount, 6);
  assert.equal(
    data.tone.ticks.length,
    input.tickCount,
    "missing tick checkpoints",
  );
  let writes = [],
    checkpoints = 0,
    portCount = 0;
  let model = new TandyDriver(driver, {
    writePort: (p, v) => writes.push([p, v]),
  });
  function same(r, ip, count = 2) {
    const c = capture(r, ip, count);
    assert.deepEqual(
      Buffer.from(model.memory.subarray(0, driver.length)),
      c.memory.subarray(0, driver.length),
      "entire native driver state",
    );
    return c;
  }
  function bus(r) {
    assert.deepEqual(writes, ports(r), "native port writes");
    portCount += writes.length;
    writes = [];
  }
  assert.equal(data.reset.input, input.resetPort61);
  model.reset(input.resetPort61);
  same(data.reset.after, 0x4000);
  bus(data.reset.writes);
  checkpoints++;
  for (const [i, c] of data.starts.entries()) {
    assert.equal(c.argument, input.startArguments[i]);
    const stack = Buffer.from(c.stack, "base64");
    assert.equal(stack.length, 6);
    assert.equal(stack.readUInt16LE(0), 0x4000);
    assert.equal(stack.readUInt16LE(2), 0x459c);
    assert.equal(stack.readUInt16LE(4), input.startArguments[i]);
    same(c.before, 0x415);
    model.start(input.startArguments[i]);
    same(c.after, 0x4000);
    bus(c.writes);
    checkpoints++;
  }
  model = new TandyDriver(driver, { writePort: (p, v) => writes.push([p, v]) });
  assert.equal(data.tone.resetInput, input.toneResetPort61);
  model.reset(input.toneResetPort61);
  model.start(input.toneSound);
  // Setup port writes were not separately captured for this fresh reset.
  writes = [];
  same(data.tone.initial, 0x4000);
  checkpoints++;
  for (const [i, c] of data.tone.ticks.entries()) {
    assert.equal(c.tick, i + 1, "skipped native tick");
    const before = same(c.before, 0x403, 3);
    let bios = before.bios,
      effects = 0;
    model.processTick({
      clearBiosFlags(mask) {
        bios &= mask;
        effects++;
      },
    });
    const after = same(c.after, 0x4000, 3);
    assert.equal(effects, 1);
    assert.equal(after.bios, bios, "BIOS boundary effect");
    bus(c.writes);
    checkpoints++;
  }
  assert.equal(model.active, false, "unfinished sequence");
  assert.equal(checkpoints, 18);
  assert.equal(portCount, 15);
}
verify(raw);
// Negative controls use copies only; committed inputs and local captures stay
// independent. Each important comparison must reject a deliberate divergence.
const changed = structuredClone(raw);
const b = unwrap(changed.tone.ticks[0].after);
const memory = Buffer.from(b.results[1].data, "base64");
memory[0x1d9] ^= 1;
b.results[1].data = memory.toString("base64");
changed.tone.ticks[0].after.content[0].text = JSON.stringify(b);
assert.throws(() => verify(changed), /entire native driver state/);
const omitted = structuredClone(raw);
omitted.tone.ticks.pop();
assert.throws(() => verify(omitted), /missing tick checkpoints/);
const port = structuredClone(raw);
const out = unwrap(port.tone.ticks[0].writes[0]);
out.registers.eax ^= 1;
port.tone.ticks[0].writes[0].content[0].text = JSON.stringify(out);
assert.throws(() => verify(port), /native port writes/);
const inputs = structuredClone(manifest.inputs);
inputs.startArguments.splice(0, 1);
assert.throws(() => verify(raw, inputs), /unconsumed start inputs/);
const cleanup = unwrap(raw.cleanup.jumped).stop;
assert.equal(cleanup.protected_mode, false);
const resume = batch(raw["resume-context"], 2)[0].registers;
for (const key of Object.keys(resume).filter((k) => k !== "flags"))
  assert.equal(cleanup.registers[key], resume[key], `restored ${key}`);
assert.equal(unwrap(raw.cleanup.freed).status, "ok");
assert.deepEqual(unwrap(raw.cleanup.allocations).allocations, []);
console.log(
  "Tandy: 18 conditional native-state checkpoints, 15 exact port writes, 4 negative controls passed. PCM waveform unverified.",
);
