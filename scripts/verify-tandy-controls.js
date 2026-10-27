import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import { prepareTandySequenceCase } from "../reference/tandy-sequence-fixture.js";
import inputs from "../reference/tandy-controls-inputs.json" with { type: "json" };
import manifest from "../reference/tandy-controls.json" with { type: "json" };
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
  assert.ok(b.results.every((r) => r.status === "ok"));
  return b.results;
}
const raw = {};
for (const [key, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/tandy-audio.md`);
  });
  assert.equal(hash(b), item.sha256, `SETUP: corrupt ${item.path}`);
  raw[key] = JSON.parse(b);
}
assert.equal(Object.keys(raw).length, 16);
assert.equal(manifest.expectedCases, 14);
assert.equal(manifest.expectedCheckpoints, 14);
assert.equal(manifest.expectedPortWrites, 0);
assert.equal(
  hash(await readFile("reference/tandy-controls-inputs.json")),
  manifest.inputsSHA256,
);
const archive = await readFile("game/IT.DRV");
assert.equal(hash(archive), build.files["IT.DRV"].sha256);
assert.equal(
  hash(await readFile("game/DUCKTALE.EXE")),
  build.files["DUCKTALE.EXE"].sha256,
);
const driver = parseArchive(archive, "IT.DRV")[4].data;
assert.equal(hash(driver), manifest.driverSHA256);
const entries = { 0x90: 0xc43, 0x97: 0xaab, 0xaa: 0xb18, 0x9d: 0xbfb };
function snapshot(r, ip) {
  const rows = batch(r, 4),
    cpu = rows[0].registers;
  for (const key of ["cs", "ds", "es", "ss"]) assert.equal(cpu[key], 0x459c);
  assert.equal(cpu.eip, ip);
  assert.equal(cpu.esp, 0xfef0);
  assert.equal(cpu.flags & 0x400, 0);
  const blocks = rows.slice(1).map((row, i) => {
    assert.equal(row.op, "mem_read");
    assert.equal(row.addr, [285120, 297408, 301504][i]);
    const b = Buffer.from(row.data, "base64");
    assert.equal(b.length, [12339, 32, 5][i]);
    return b;
  });
  return { cpu, blocks };
}
function boundary(s, ip, model) {
  assert.equal(s.debugging, true);
  assert.equal(s.protected_mode, false);
  assert.equal(s.core, "normal");
  assert.equal(s.registers.cs, 0x459c);
  assert.equal(s.registers.eip, ip);
  assert.equal(s.linear_eip, 285120 + ip);
  assert.deepEqual(
    Buffer.from(s.code_bytes, "base64"),
    Buffer.from(model.subarray(ip, ip + 16)),
  );
}
function verify(data, stream = inputs.cases) {
  assert.equal(stream.length, 14, "unfinished input stream");
  assert.equal(
    Object.keys(data).filter((k) => /^\d\d$/.test(k)).length,
    14,
    "missing checkpoints",
  );
  let previousIP = 0x46e;
  const kinds = {};
  for (let i = 0; i < stream.length; i++) {
    const c = stream[i],
      capture = data[String(i).padStart(2, "0")];
    assert.equal(capture.case, i);
    assert.equal(capture.name, c.name);
    const at = 0x1d1 + c.channel * 0x38;
    const model = new TandyDriver(driver, {
      writePort() {
        assert.fail("unexpected output");
      },
    });
    const prepared = prepareTandySequenceCase(driver, c);
    model.memory.set(prepared);
    if (c.opcode !== null)
      assert.equal(
        new DataView(
          driver.buffer,
          driver.byteOffset,
          driver.byteLength,
        ).getUint16(0xf5b + (c.opcode & 127) * 2, true),
        c.entry,
      );
    const target = c.kind === "pitch" ? 0x4000 : c.entry;
    // The only transfer patches are in private scratch beyond the source body.
    prepared.set(
      [0xea, target & 255, target >>> 8, 0x9c, 0x45],
      0x4000 + previousIP,
    );
    batch(capture.setup, 15);
    const step = unwrap(capture.step);
    assert.equal(step.status, "ok");
    boundary({ ...step.stop, debugging: step.debugging }, target, prepared);
    const before = snapshot(capture.before, target);
    for (const [k, v] of Object.entries({
      eax: c.note,
      ebx: c.channel * 2,
      ecx: 0,
      edx: 0,
      esi: 0,
      edi: at,
      ebp: 0,
      fs: 0,
      gs: 0,
    }))
      assert.equal(before.cpu[k], v);
    for (let j = 0; j < 3; j++)
      assert.deepEqual(
        before.blocks[j],
        Buffer.from(
          model.memory.subarray(
            [0, 0x3000, 0x4000][j],
            [12339, 0x3020, 0x4005][j],
          ),
        ),
        `${c.name}: authored initial state`,
      );
    const stop = unwrap(capture.stop),
      resumed = unwrap(capture.resumed);
    assert.equal(resumed.status, "ok");
    assert.equal(resumed.resumed_from_stop_id, step.stop.stop_id);
    assert.equal(stop.satisfied, true);
    assert.ok(stop.stop_id > step.stop.stop_id);
    assert.equal(stop.breakpoint.once, true);
    assert.equal(stop.breakpoint.hit_count, 1);
    boundary(stop, c.stop, prepared);
    if (c.kind === "control") {
      assert.equal(c.entry, entries[c.opcode]);
      assert.equal(c.stop, 0x83e);
      assert.equal(model.processControl(at, c.channel, c.opcode), true);
    } else if (c.kind === "legato") {
      assert.equal(c.entry, entries[c.opcode]);
      assert.equal(c.stop, 0x906); // No envelope, modulation or port path before this boundary.
      model.processLegato(at, c.channel);
    } else if (c.kind === "note") {
      assert.equal(c.entry, 0x84a);
      assert.equal(c.stop, 0x88b);
      model.processNote(at, c.channel, c.note);
    } else {
      assert.equal(c.kind, "pitch");
      assert.equal(c.entry, 0xea0);
      assert.equal(c.stop, 0x4003);
      model.processPitch(at, c.channel, c.note);
    }
    const after = snapshot(capture.after, c.stop);
    for (let j = 0; j < 3; j++)
      assert.deepEqual(
        after.blocks[j],
        Buffer.from(
          model.memory.subarray(
            [0, 0x3000, 0x4000][j],
            [12339, 0x3020, 0x4005][j],
          ),
        ),
        `${c.name}: native result`,
      );
    kinds[c.kind] = (kinds[c.kind] || 0) + 1;
    previousIP = c.stop;
  }
  assert.deepEqual(kinds, { control: 7, legato: 2, note: 2, pitch: 3 });
}
verify(raw);
const context = batch(raw.context.context, 2),
  cleanup = raw.cleanup;
assert.equal(unwrap(raw.context.allocation).addr, 285120);
batch(cleanup.restore, 16);
assert.equal(unwrap(cleanup.step).status, "ok");
const restored = unwrap(cleanup.cpu).registers;
for (const [k, v] of Object.entries(context[0].registers))
  if (k !== "flags") assert.equal(restored[k], v);
assert.equal(unwrap(cleanup.freed).status, "ok");
assert.deepEqual(unwrap(cleanup.allocations).allocations, []);
assert.equal(unwrap(cleanup.breakpoints).count, 0);

assert.throws(
  () => verify(raw, inputs.cases.slice(1)),
  /unfinished input stream/,
);
const missing = structuredClone(raw);
delete missing["04"];
assert.throws(() => verify(missing), /missing checkpoints/);
const wrong = structuredClone(raw);
const result = unwrap(wrong["07"].after);
const memory = Buffer.from(result.results[1].data, "base64");
memory[0x1d1 + 10] ^= 1;
result.results[1].data = memory.toString("base64");
wrong["07"].after.content[0].text = JSON.stringify(result);
assert.throws(() => verify(wrong), /native result/);
const event = structuredClone(inputs.cases);
event[0].args[0] ^= 1;
assert.throws(() => verify(raw, event), /authored initial state/);
console.log(
  "Tandy controls: 14 conditional native cases, exact full-body/argument/harness comparisons; 4 negative controls. No waveform or natural-game timing claim.",
);
