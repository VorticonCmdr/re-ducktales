import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { SpeakerDriver } from "../src/speaker-driver.js";
import { originalGame } from "../tests/helpers/original-game.js";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(await readFile("reference/speaker-engine.json"));
assert.equal(manifest.expectedCases, 12);
assert.equal(manifest.expectedIRQs, 408);
assert.equal(manifest.expectedWrites, 1128);
assert.equal(manifest.port61Mask, 0xcf);
const artifacts = {};
for (const [role, a] of Object.entries(manifest.artifacts)) {
  const b = await readFile(a.path).catch(() => {
    throw Error(`SETUP: missing ${a.path};see docs/speaker-audio.md`);
  });
  assert.equal(b.length, a.bytes, `Corrupt ${role} size`);
  assert.equal(hash(b), a.sha256, `Corrupt ${role} artifact`);
  artifacts[role] = role === "capture-source" ? b : JSON.parse(b);
}
for (const [path, expected] of Object.entries(manifest.sources))
  assert.equal(
    hash(await readFile(path)),
    expected,
    `Changed speaker source ${path}`,
  );
assert.equal(Object.keys(artifacts).length, 17);
const { archives } = await originalGame();
const driver = archives.get("IT.DRV")[5].data;
assert.equal(hash(driver), manifest.driverSHA256);
const capture = artifacts.capture,
  inputs = artifacts.inputs;
assert.equal(capture.completed, true);
assert.equal(capture.caseCount, 12);
assert.equal(capture.irqCount, 408);
assert.equal(capture.naturalMachineCheckpoint, false);
assert.equal(hash(artifacts["capture-source"]), capture.scriptSha256);
assert.equal(artifacts.allocation.addr, capture.segment * 16);
assert.equal(artifacts.engine.pid, capture.pid);
assert.equal(artifacts.engine.instance_id, capture.engineInstanceId);
assert.equal(
  artifacts.engine.capabilities.debugger.limits.effective_core,
  "normal",
);
const allocationSegment = artifacts.allocation.addr >>> 4;
assert.equal(inputs.schedule.length, 12);

function compare({
  skipIRQ = false,
  corruptRNG = false,
  snapshots = artifacts,
} = {}) {
  const d = new SpeakerDriver(driver, { port61: inputs.initialPort61Control });
  // Explicit allocator/vector providers for this private native fixture.
  // No captured final memory,expected RNG or device output initializes state.
  d.w(0x288, 0x4300);
  d.w(0x28a, allocationSegment);
  d.w(0x28c, 0x5000);
  d.w(0x28e, allocationSegment);
  if (corruptRNG) d.b(0x281, d.b(0x281) ^ 1);
  let checked = 0,
    writes = 0,
    irqs = 0,
    chainedEvents = 0;
  for (let i = 0; i < inputs.schedule.length; i++) {
    const record = snapshots[`case-${String(i).padStart(2, "0")}`];
    assert.ok(record, "Missing native speaker checkpoint");
    assert.equal(record.index, i);
    assert.deepEqual(
      record.input,
      inputs.schedule[i],
      "Changed native input schedule",
    );
    const input = inputs.schedule[i];
    if (input.request !== undefined) d.request(input.request);
    else if (input.irqs)
      for (let n = 0; n < input.irqs; n++) {
        if (skipIRQ && i === 5 && n === 0) continue;
        d.interrupt();
        irqs++;
      }
    else assert.equal(input.reset, true); // Constructor performed native0576.
    const state = record.state;
    assert.equal(state.aborted, false);
    assert.equal(state.results.length, 3);
    assert.ok(state.results.every((r) => r.status === "ok"));
    const cpu = state.results[0].registers;
    for (const segment of ["cs", "ds", "es", "ss"])
      assert.equal(cpu[segment], capture.segment);
    assert.equal(cpu.eip, 0x4100);
    assert.equal(cpu.esp, 0xfef0);
    assert.equal(cpu.flags & 0x600, 0, "Native fixture must have IF/DF clear");
    const native = Buffer.from(state.results[1].data, "base64");
    assert.equal(native.length, 7253);
    assert.equal(
      Buffer.compare(Buffer.from(d.memory), native),
      0,
      `Speaker memory mismatch at case${i}`,
    );
    const clock = Buffer.from(state.results[2].data, "base64");
    assert.equal(clock.length, 4);
    assert.equal(clock.readUInt32LE(), d.ticks);
    const events = d.drainEvents(),
      io = events.filter((e) => e.type === "out");
    assert.ok(
      events.every((e) => ["out", "chain"].includes(e.type)),
      "Unsupported speaker device event",
    );
    chainedEvents += events.filter((e) => e.type === "chain").length;
    assert.equal(io.length, record.io.length, "Missing speaker port writes");
    for (let n = 0; n < io.length; n++) {
      const expected = record.io[n],
        actual = io[n];
      assert.equal(driver[expected.ip], 0xe6, "Native OUT instruction changed");
      assert.equal(driver[expected.ip + 1], expected.port);
      assert.equal(actual.port, expected.port, "Speaker port order mismatch");
      const mask = actual.port === 0x61 ? manifest.port61Mask : 255;
      assert.equal(
        actual.value & mask,
        expected.value & mask,
        "Speaker port value mismatch",
      );
    }
    writes += io.length;
    checked++;
  }
  assert.equal(checked, 12);
  assert.equal(irqs, 408);
  assert.equal(writes, 1128);
  assert.equal(d.ticks, 34);
  assert.equal(d.chains, 8);
  assert.equal(chainedEvents, 8);
  assert.equal(d.acknowledgements, 400);
  assert.equal(d.busy, false);
  assert.equal(d.events.length, 0, "Unconsumed required device events");
}
compare();
assert.throws(() => compare({ skipIRQ: true }), /Speaker memory mismatch/);
assert.throws(() => compare({ corruptRNG: true }), /Speaker memory mismatch/);
const missing = structuredClone(artifacts);
delete missing["case-05"];
assert.throws(
  () => compare({ snapshots: missing }),
  /Missing native speaker checkpoint/,
);
const drop = structuredClone(artifacts);
drop["case-05"].io.pop();
assert.throws(
  () => compare({ snapshots: drop }),
  /Missing speaker port writes/,
);
const control = structuredClone(artifacts);
control["case-00"].io[0].value ^= 0x40;
assert.throws(
  () => compare({ snapshots: control }),
  /Speaker port value mismatch/,
);
const status = structuredClone(artifacts);
status["case-00"].io[0].value ^= 0x30;
compare({ snapshots: status }); // Only asynchronous refresh/timer bits excluded.
let stopped = 0,
  active = 0;
for (let id = 0; id < 121; id++) {
  const d = new SpeakerDriver(driver);
  d.request(id);
  for (let n = 0; n < 6000 && d.busy; n++) {
    d.interrupt();
    d.drainEvents();
  }
  if (d.busy) active++;
  else stopped++;
}
assert.deepEqual([stopped, active], [93, 28]);
console.log(
  "Speaker engine:12 carried native checkpoints,408 scheduled IRQs,1128 port writes,34 clock advances;all7253 driver bytes exact;5 negatives. All121 requests audited through6000 IRQs (93 stopped,28 still active);not browser playback or whole-driver native parity.",
);
