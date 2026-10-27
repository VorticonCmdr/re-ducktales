import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import { prepareTandySequenceCase } from "../reference/tandy-sequence-fixture.js";
import inputs from "../reference/tandy-sequence-inputs.json" with { type: "json" };
import manifest from "../reference/tandy-sequence.json" with { type: "json" };
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
const raw = {};
for (const [key, item] of Object.entries(manifest.artifacts))
  raw[key] = await load(item);
assert.equal(Object.keys(raw).length, 44);
assert.equal(manifest.expectedCases, 42);
assert.equal(manifest.expectedCheckpoints, 43);
assert.equal(manifest.expectedPortWrites, 4);
const archive = await readFile("game/IT.DRV");
assert.equal(hash(archive), build.files["IT.DRV"].sha256);
assert.equal(
  hash(await readFile("game/DUCKTALE.EXE")),
  build.files["DUCKTALE.EXE"].sha256,
);
const driver = parseArchive(archive, "IT.DRV")[4].data;
assert.equal(hash(driver), manifest.driverSHA256);
const entries = {
  0x80: 0xaf6,
  0x81: 0xb0f,
  0x82: 0xb4c,
  0x84: 0xb1b,
  0x85: 0xba9,
  0x86: 0xbe9,
  0x87: 0xa92,
  0x8c: 0xc2a,
  0x95: 0xcb3,
  0xa9: 0xaab,
};
function capture(raw, ip, c) {
  const r = unwrap(raw);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, c.kind === "tick" ? 5 : 4);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  for (const k of ["cs", "ds", "es", "ss"]) assert.equal(cpu[k], 0x459c);
  assert.equal(cpu.eip, ip);
  assert.equal(cpu.esp, 0xfef0);
  assert.equal(cpu.flags & 0x400, 0);
  const blocks = r.results.slice(1).map((x, i) => {
    assert.equal(x.addr, [285120, 285120 + 0x3000, 285120 + 0x4000, 0x418][i]);
    const b = Buffer.from(x.data, "base64");
    assert.equal(b.length, [12339, 32, 5, 1][i]);
    return b;
  });
  return {
    cpu,
    memory: blocks[0],
    args: blocks[1],
    harness: blocks[2],
    bios: blocks[3]?.[0],
  };
}
function bus(stops) {
  return stops.map((r) => {
    const s = unwrap(r),
      code = Buffer.from(s.code_bytes, "base64"),
      ip = s.registers.eip;
    assert.equal(s.protected_mode, false);
    assert.equal(s.core, "normal");
    assert.equal(s.satisfied, true);
    assert.equal(s.registers.cs, 0x459c);
    assert.deepEqual(
      code.subarray(0, 2),
      Buffer.from(driver).subarray(ip, ip + 2),
    );
    assert.equal(code[0], 0xe6);
    assert.equal(code[1], 0xc0);
    return [code[1], s.registers.eax & 255];
  });
}
function verify(data, stream = inputs.cases, events = data["runtime-events"]) {
  assert.equal(stream.length, 42, "unconsumed sequence inputs");
  assert.equal(events.length, 3, "unconsumed runtime events");
  assert.equal(
    Object.keys(data).filter((k) => /^\d\d$/.test(k)).length,
    42,
    "missing native cases",
  );
  let checkpoints = 0,
    writes = 0,
    eventIndex = 0;
  for (const [i, c] of stream.entries()) {
    const r = data[String(i).padStart(2, "0")];
    assert.ok(r);
    assert.equal(r.index, i);
    assert.equal(r.name, c.name);
    assert.ok(["control", "modulation", "tick"].includes(c.kind));
    assert.equal(
      c.entry,
      c.kind === "control"
        ? entries[c.opcode]
        : c.kind === "modulation"
          ? 0xf05
          : 0x403,
    );
    const initial = prepareTandySequenceCase(driver, c);
    let ports = [];
    const d = new TandyDriver(driver, {
      writePort: (p, v) => ports.push([p, v]),
    });
    d.memory.set(initial);
    const steps = c.kind === "tick" ? r.steps : [r];
    assert.equal(steps.length, c.ticks ?? 1, "missing carried steps");
    for (const [j, s] of steps.entries()) {
      if (c.kind === "tick") assert.equal(s.tick, j + 1);
      const before = capture(
        s.before,
        c.kind === "control" ? c.entry : 0x4000,
        c,
      );
      assert.deepEqual(
        Buffer.from(d.memory.subarray(0, 12339)),
        before.memory,
        "independent/carried sequence initial state",
      );
      assert.deepEqual(
        before.args,
        Buffer.from(initial.subarray(0x3000, 0x3020)),
      );
      assert.deepEqual(
        before.harness,
        Buffer.from(initial.subarray(0x4000, 0x4005)),
      );
      if (c.kind !== "tick") {
        assert.equal(before.cpu.edi, 0x1d1 + c.channel * 0x38);
        assert.equal(before.cpu.ebx, c.channel * 2);
      }
      let bios = before.bios;
      if (c.kind === "control")
        assert.equal(
          d.processControl(0x1d1 + c.channel * 0x38, c.channel, c.opcode),
          true,
        );
      else if (c.kind === "modulation")
        d.processVibrato(0x1d1 + c.channel * 0x38, c.channel);
      else {
        const event = events[eventIndex++];
        assert.equal(event.case, i);
        assert.equal(event.tick, j + 1);
        const external = Buffer.from(event.bios, "base64");
        assert.equal(external.length, 1);
        assert.equal(external[0], before.bios);
        bios = external[0];
        let consumed = 0;
        d.processTick({
          clearBiosFlags(mask) {
            bios &= mask;
            consumed++;
          },
        });
        assert.equal(consumed, 1);
      }
      const end = c.kind === "control" ? 0x83e : 0x4003,
        after = capture(s.after, end, c),
        stop = unwrap(s.stop);
      assert.equal(stop.registers.cs, 0x459c);
      assert.equal(stop.registers.eip, end);
      assert.equal(stop.protected_mode, false);
      assert.equal(stop.core, "normal");
      assert.equal(stop.satisfied, true);
      assert.deepEqual(
        Buffer.from(d.memory.subarray(0, 12339)),
        after.memory,
        `entire native sequence state: ${c.name}`,
      );
      assert.deepEqual(after.args, before.args);
      assert.deepEqual(after.harness, before.harness);
      if (c.kind === "tick") {
        assert.equal(after.bios, bios);
        assert.deepEqual(ports, bus(s.writes), "native scheduler port writes");
      } else assert.deepEqual(ports, [], "unexpected handler I/O");
      writes += ports.length;
      ports = [];
      checkpoints++;
    }
    if (c.kind === "tick")
      assert.equal(d.active, false, "unfinished scheduler input sequence");
  }
  assert.equal(eventIndex, 3);
  assert.equal(checkpoints, 43);
  assert.equal(writes, 4);
}
verify(raw);
const corrupt = structuredClone(raw),
  r = unwrap(corrupt["00"].after),
  m = Buffer.from(r.results[1].data, "base64");
m[0x1d1] ^= 1;
r.results[1].data = m.toString("base64");
corrupt["00"].after.content[0].text = JSON.stringify(r);
assert.throws(() => verify(corrupt), /entire native sequence state/);
const omitted = structuredClone(raw);
delete omitted["01"];
assert.throws(() => verify(omitted), /missing native cases/);
assert.throws(
  () => verify(raw, inputs.cases.slice(1)),
  /unconsumed sequence inputs/,
);
assert.throws(
  () => verify(raw, inputs.cases, raw["runtime-events"].slice(1)),
  /unconsumed runtime events/,
);
const changed = structuredClone(inputs.cases);
changed[0].args[0] = 8;
assert.throws(
  () => verify(raw, changed),
  /independent\/carried sequence initial state/,
);
const altered = structuredClone(raw),
  out = unwrap(altered["40"].steps[0].writes[0]);
out.registers.eax ^= 1;
altered["40"].steps[0].writes[0].content[0].text = JSON.stringify(out);
assert.throws(() => verify(altered), /native scheduler port writes/);
const cleanup = await load(manifest.cleanup),
  caller = unwrap(cleanup.context).results[0].registers,
  restored = unwrap(cleanup.jumped).stop.registers;
for (const k of Object.keys(caller).filter((k) => k !== "flags"))
  assert.equal(restored[k], caller[k]);
assert.equal(unwrap(cleanup.freed).status, "ok");
assert.deepEqual(unwrap(cleanup.allocations).allocations, []);
assert.equal(unwrap(cleanup.breakpoints).count, 0);
assert.equal(unwrap(raw.setup.allocation).addr, 285120);
const initialized = unwrap(raw.setup.initialized);
assert.equal(initialized.aborted, false);
assert.equal(initialized.results.length, 8);
assert.ok(initialized.results.every((r) => r.status === "ok"));
assert.equal(unwrap(raw.setup.jumped).stop.registers.cs, 0x459c);
assert.equal(
  unwrap(raw.setup.jumped).stop.registers.eip,
  inputs.cases[0].entry,
);
console.log(
  "Tandy sequence: 42 conditional native cases / 43 checkpoints, companion priorities/scheduling, loops/calls, byte setters and vibrato; 4 exact port writes, 6 negative controls.",
);
