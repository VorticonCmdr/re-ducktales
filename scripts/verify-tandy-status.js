import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import { prepareTandyStatusCase } from "../reference/tandy-status-fixture.js";
import inputs from "../reference/tandy-status-inputs.json" with { type: "json" };
import manifest from "../reference/tandy-status.json" with { type: "json" };
import build from "../reference/build.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
function unwrap(r) {
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
function batch(r, count) {
  const b = unwrap(r);
  assert.equal(b.aborted, false);
  assert.equal(b.results.length, count);
  assert.ok(b.results.every((x) => x.status === "ok"));
  return b.results;
}
const raw = {};
assert.equal(manifest.expectedCases, 12);
for (const [key, artifact] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(artifact.path).catch(() => {
    throw Error(`SETUP: missing ${artifact.path}; see docs/tandy-audio.md`);
  });
  assert.equal(hash(bytes), artifact.sha256, `SETUP: corrupt ${artifact.path}`);
  raw[key] = JSON.parse(bytes);
}
assert.equal(hash(await readFile(manifest.inputs)), manifest.inputsSHA256);
assert.equal(
  hash(await readFile("reference/tandy-status-fixture.js")),
  manifest.fixtureSHA256,
);
for (const file of ["IT.DRV", "DUCKTALE.EXE"])
  assert.equal(hash(await readFile(`game/${file}`)), build.files[file].sha256);
const source = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
assert.equal(hash(source), manifest.driverSHA256);
// The resident initializer copies these nine near offsets into four-byte far
// pointers at DS:2010. Pin their identities without storing original code.
const table = new DataView(source.buffer, source.byteOffset, source.byteLength);
for (const [index, entry] of [
  [5, 0x68d],
  [6, 0x6c8],
  [7, 0x686],
])
  assert.equal(table.getUint16(index * 2, true), entry);

function snapshot(capture, model, ip, sp) {
  const parts = batch(capture, 4),
    cpu = parts[0].registers;
  assert.equal(cpu.cs, 0x459c);
  assert.equal(cpu.ss, 0x459c);
  assert.equal(cpu.eip, ip);
  assert.equal(cpu.esp, sp);
  assert.equal(cpu.flags & 0x600, 0, "unexpected IRQ/direction flag");
  for (const [i, off, len] of [
    [1, 0, 12339],
    [2, 0xfef0, 4],
    [3, 0x4003, 2],
  ]) {
    assert.equal(parts[i].addr, 285120 + off);
    const bytes = Buffer.from(parts[i].data, "base64");
    assert.equal(bytes.length, len);
    assert.deepEqual(
      bytes,
      Buffer.from(model.memory.subarray(off, off + len)),
      "entire query memory",
    );
  }
  return cpu;
}
function stopped(capture, ip) {
  const s = unwrap(capture.end),
    run = unwrap(capture.run);
  assert.equal(run.status, "ok");
  assert.equal(s.satisfied, true, "unfinished native query/wait");
  assert.equal(s.debugging, true);
  assert.equal(s.core, "normal");
  assert.equal(s.protected_mode, false);
  assert.ok(s.stop_id > run.resumed_from_stop_id);
  assert.equal(s.registers.cs, 0x459c);
  assert.equal(s.registers.eip, ip);
  const bytes = ip === 0x4003 ? [0xeb, 0xfe] : source.subarray(ip, ip + 16);
  assert.deepEqual(
    Buffer.from(s.code_bytes, "base64").subarray(0, bytes.length),
    Buffer.from(bytes),
  );
  return s.registers;
}
function seeded(c, capture) {
  batch(capture.setup, 16);
  const step = unwrap(capture.step),
    s = step.stop;
  assert.equal(step.status, "ok");
  assert.equal(step.debugging, true);
  assert.equal(s.core, "normal");
  assert.equal(s.protected_mode, false);
  assert.equal(s.registers.cs, 0x459c);
  assert.equal(s.registers.eip, c.entry);
  assert.equal(s.registers.flags & 0x600, 0);
  assert.deepEqual(
    Buffer.from(s.code_bytes, "base64"),
    Buffer.from(source.subarray(c.entry, c.entry + 16)),
  );
  const model = new TandyDriver(source, {
    writePort() {
      throw Error("unexpected query I/O");
    },
  });
  model.memory.set(prepareTandyStatusCase(source, c));
  const before = snapshot(capture.before, model, c.entry, 0xfef0);
  assert.equal(before.ds, 0x1403);
  assert.equal(before.eax, 0x1234abcd);
  assert.equal(before.ebx, 0x5678beef);
  return { model, before };
}
function preserved(before, after) {
  for (const key of [
    "ds",
    "es",
    "ss",
    "esi",
    "edi",
    "ecx",
    "edx",
    "ebp",
    "fs",
    "gs",
  ])
    assert.equal(after[key], before[key], `preserved ${key}`);
  assert.equal(after.eax >>> 16, before.eax >>> 16);
  assert.equal(after.ebx >>> 16, before.ebx >>> 16);
}
function compare(data, stream = inputs) {
  assert.equal(stream.cases.length, 12, "unconsumed query inputs");
  assert.equal(Object.keys(data).length, 16, "missing status artifacts");
  let checkpoints = 0,
    events = 0;
  for (let i = 0; i < stream.cases.length; i++) {
    const c = stream.cases[i],
      capture = data[String(i).padStart(2, "0")];
    assert.ok(capture, "missing query case");
    assert.equal(capture.name, c.name);
    const { model, before } = seeded(c, capture);
    const result = c.entry === 0x686 ? model.marker : model.playbackStatus;
    assert.ok([0x686, 0x6c8].includes(c.entry));
    stopped(capture, 0x4003);
    const after = snapshot(capture.after, model, 0x4003, 0xfef4);
    preserved(before, after);
    assert.equal(after.eax & 65535, result, "query return value");
    if (c.entry === 0x686) assert.equal(after.ebx, before.ebx);
    else {
      assert.equal(after.ebx & 65535, result ? (4 - result) * 2 : 6);
      assert.equal(model.active, result !== 0);
      assert.equal(model.pollWait(), result === 0);
    }
    checkpoints++;
  }
  const c = stream.wait,
    capture = data.wait;
  assert.equal(c.entry, 0x68d);
  assert.equal(capture.name, c.name);
  assert.equal(c.events.length, 4, "unfinished wait input schedule");
  assert.equal(
    capture.frames.length,
    c.events.length,
    "skipped wait checkpoints",
  );
  const { model, before } = seeded(c, capture);
  stopped(capture.arrival, 0x694);
  snapshot(capture.arrival.snapshot, model, 0x694, 0xfeea);
  for (let i = 0; i < c.events.length; i++) {
    const frame = capture.frames[i],
      event = c.events[i];
    assert.deepEqual(event, { clearChannel: i }, "unexpected wait event");
    assert.deepEqual(frame.event, event, "unconsumed wait event");
    const native = stopped(frame.blocked, 0x694);
    snapshot(frame.blocked.snapshot, model, 0x694, 0xfeea);
    assert.equal(native.edi & 65535, 0x1d1 + i * 0x38);
    assert.equal(model.playbackStatus, 4 - i);
    assert.equal(model.pollWait(), false, "premature wait completion");
    batch(frame.cleared, 1);
    model.word(model.word(0x2b1 + event.clearChannel * 2), 0);
    snapshot(frame.after, model, 0x694, 0xfeea);
    events++;
    checkpoints++;
  }
  assert.equal(model.pollWait(), true);
  stopped(capture.finish, 0x4003);
  const after = snapshot(capture.finish.snapshot, model, 0x4003, 0xfef4);
  preserved(before, after);
  assert.equal(after.eax & 65535, 0x459c);
  assert.equal(after.ebx & 65535, 6);
  checkpoints++;
  assert.equal(checkpoints, manifest.expectedCheckpoints);
  assert.equal(events, manifest.expectedEvents);
}
compare(raw);
// Deliberately corrupt independent inputs, outcomes, and completion schedules.
const changedReturn = structuredClone(raw);
const returnJSON = unwrap(changedReturn["04"].after);
returnJSON.results[0].registers.eax--;
changedReturn["04"].after.content[0].text = JSON.stringify(returnJSON);
assert.throws(() => compare(changedReturn), /query return value/);
const missing = structuredClone(raw);
delete missing["05"];
assert.throws(() => compare(missing), /missing status artifacts/);
const changedInput = structuredClone(inputs);
changedInput.cases[4].pointers[0] = 0;
assert.throws(() => compare(raw, changedInput), /entire query memory/);
const durationSubstitute = structuredClone(inputs);
durationSubstitute.cases[10].durations[0] = 0;
assert.throws(() => compare(raw, durationSubstitute), /entire query memory/);
const skipped = structuredClone(raw);
skipped.wait.frames.pop();
assert.throws(() => compare(skipped), /skipped wait checkpoints/);
const omitted = structuredClone(inputs);
omitted.wait.events.pop();
assert.throws(() => compare(raw, omitted), /unfinished wait input schedule/);
const late = structuredClone(raw);
late.wait.finish.end.content[0].text = JSON.stringify({
  ...unwrap(late.wait.finish.end),
  satisfied: false,
});
assert.throws(() => compare(late), /unfinished native query\/wait/);

const cleanup = raw.cleanup,
  original = batch(raw.context.context, 3)[0].registers;
const final = batch(cleanup.final, 2);
for (const [key, value] of Object.entries(original))
  if (key !== "flags") assert.equal(final[0].registers[key], value);
// Bits4/5 are hardware timer/refresh observations, not writable control state.
assert.equal(
  final[1].value & 0xcf,
  batch(raw.context.context, 3)[2].value & 0xcf,
);
assert.equal(unwrap(cleanup.freed).status, "ok");
assert.equal(unwrap(cleanup.breakpoints).count, 0);
assert.deepEqual(unwrap(cleanup.allocations).allocations, []);
const bridge = unwrap(raw.environment.bridge);
assert.equal(bridge.instance_id, manifest.configuration.instance);
assert.equal(bridge.engine_version, "0.84.0-vc1 (f6d9b)");
assert.equal(bridge.bridge_version, "0.1.1");
assert.equal(bridge.protocol, "1.14");
assert.equal(bridge.capabilities.debugger.limits.effective_core, "normal");
const machine = unwrap(raw.environment.machine);
assert.equal(machine.canonical_name, "C:\\DUCKTALE.EXE");
assert.equal(machine.mounted_drives.C.read_only, true);
assert.equal(unwrap(raw.environment.debug).debugging, true);
assert.equal(
  unwrap(raw.environment.debug).stop.stop_id,
  unwrap(cleanup.step).stop.stop_id,
);
console.log(
  "Tandy status: 12 native queries and 5 carried wait checkpoints, all 4 external clear events consumed, exact source/body and unsigned return values; 7 negative controls. Conditional polling evidence, not natural IRQ timing or in-game integration.",
);
