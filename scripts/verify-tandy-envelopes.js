import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import manifest from "../reference/tandy-envelope.json" with { type: "json" };
import inputs from "../reference/tandy-envelope-inputs.json" with { type: "json" };
import build from "../reference/build.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
function unwrap(r) {
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
async function load(item) {
  const bytes = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/tandy-audio.md`);
  });
  assert.equal(hash(bytes), item.sha256, `SETUP: corrupt ${item.path}`);
  return JSON.parse(bytes);
}
const archive = await readFile("game/IT.DRV");
assert.equal(hash(archive), build.files["IT.DRV"].sha256);
const driver = parseArchive(archive, "IT.DRV")[4].data;
assert.equal(hash(driver), manifest.driverSHA256);
assert.equal(driver.length, 12339);
assert.equal(manifest.expectedCases, 26);
assert.equal(manifest.artifacts.length, 26);
const records = [];
for (const item of manifest.artifacts) records.push(await load(item));
const setup = await load(manifest.setup);
assert.equal(unwrap(setup.allocation).addr, 285120);
assert.equal(unwrap(setup.original).stop.registers.eip, 0x46e);
const cleanup = await load(manifest.cleanup);
assert.equal(unwrap(cleanup.freed).status, "ok");
assert.deepEqual(unwrap(cleanup.allocations).allocations, []);
assert.equal(unwrap(cleanup.breakpoints).count, 0);
const caller = unwrap(cleanup.context).results[0].registers;
const restored = unwrap(cleanup.jumped).stop.registers;
for (const key of Object.keys(caller).filter((k) => k !== "flags"))
  assert.equal(restored[key], caller[key], `restored ${key}`);

function capture(raw, ip, at) {
  const r = unwrap(raw);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, 4);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  for (const k of ["cs", "ds", "es", "ss"]) assert.equal(cpu[k], 0x459c);
  assert.equal(cpu.eip, ip);
  assert.equal(cpu.esp, 0xfef0);
  assert.equal(cpu.edi, at);
  assert.equal(cpu.flags & 0x400, 0, "direction flag");
  const [memory, envelope, harness] = r.results.slice(1).map((r, i) => {
    assert.equal(r.addr, 285120 + [0, 0x5000, 0x4000][i]);
    const b = Buffer.from(r.data, "base64");
    assert.equal(b.length, [12339, 512, 5][i]);
    return b;
  });
  return { memory, envelope, harness };
}
function compare(cases, stream) {
  assert.equal(cases.length, 26, "missing native envelope cases");
  assert.equal(stream.length, 26, "unconsumed envelope inputs");
  for (const [i, c] of stream.entries()) {
    const r = cases[i],
      at = 0x1d1 + c.channel * 0x38;
    assert.equal(r.index, i);
    assert.equal(r.name, c.name);
    assert.ok([0x910, 0x942].includes(c.entry));
    const initial = Buffer.from(driver),
      envelope = Buffer.alloc(512);
    initial[0x1b3] = c.channel;
    for (const [off, value] of [
      [10, c.mode],
      [11, c.target],
      [12, c.index],
      [15, c.delta],
      [16, c.level],
      [0x29, c.attenuation],
    ])
      initial[at + off] = value;
    initial.writeUInt16LE(0x5000, at + 13);
    initial.writeUInt16LE(0x5000 + c.releaseIndex, at + 0x34);
    initial[0x2c1 + c.channel] = 17;
    envelope.set(c.envelope);
    const relative = (c.entry - 0x4003) & 65535;
    const harness = Buffer.from([
      0xe8,
      relative & 255,
      relative >>> 8,
      0xeb,
      0xfb,
    ]);
    const before = capture(r.before, 0x4000, at);
    assert.deepEqual(
      before.memory,
      initial,
      "independent initial driver state",
    );
    assert.deepEqual(before.envelope, envelope);
    assert.deepEqual(before.harness, harness);
    const nativeStop = unwrap(r.stop);
    assert.equal(nativeStop.satisfied, true);
    assert.equal(nativeStop.protected_mode, false);
    assert.equal(nativeStop.core, "normal");
    assert.equal(nativeStop.registers.cs, 0x459c);
    assert.equal(nativeStop.registers.eip, 0x4003);
    const model = new TandyDriver(driver, {
      writePort() {
        throw Error("unexpected envelope port write");
      },
    });
    model.memory.set(initial);
    model.memory.set(envelope, 0x5000);
    if (c.entry === 0x910) model.processEnvelope(at);
    else model.selectEnvelopeStage(at);
    const after = capture(r.after, 0x4003, at);
    assert.deepEqual(
      Buffer.from(model.memory.subarray(0, 12339)),
      after.memory,
      `entire native envelope state: ${c.name}`,
    );
    assert.deepEqual(after.envelope, envelope);
    assert.deepEqual(after.harness, harness);
  }
}
compare(records, inputs.cases);
const bad = structuredClone(records),
  result = unwrap(bad[11].after);
const memory = Buffer.from(result.results[1].data, "base64");
memory[0x1e1] ^= 1;
result.results[1].data = memory.toString("base64");
bad[11].after.content[0].text = JSON.stringify(result);
assert.throws(() => compare(bad, inputs.cases), /entire native envelope state/);
assert.throws(() => compare(records.slice(1), inputs.cases), /missing native/);
assert.throws(() => compare(records, inputs.cases.slice(1)), /unconsumed/);
const changed = structuredClone(inputs.cases);
changed[0].level ^= 1;
assert.throws(
  () => compare(records, changed),
  /independent initial driver state/,
);
console.log(
  "Tandy envelopes: 26 exact conditional native cases, all six modes, wrapping and original falling-target quirk; 4 negative controls.",
);
