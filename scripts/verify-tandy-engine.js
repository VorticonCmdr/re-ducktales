import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import { prepareTandyEngineCase } from "../reference/tandy-engine-fixture.js";
import inputs from "../reference/tandy-engine-inputs.json" with { type: "json" };
import manifest from "../reference/tandy-engine.json" with { type: "json" };
import build from "../reference/build.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const unwrap = (r) => {
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
};
function batch(raw, n) {
  const r = unwrap(raw);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, n);
  assert.ok(r.results.every((x) => x.status === "ok"));
  return r.results;
}
const raw = {};
for (const [key, a] of Object.entries(manifest.artifacts)) {
  const b = await readFile(a.path).catch(() => {
    throw Error(`SETUP: missing ${a.path}; see docs/tandy-audio.md`);
  });
  assert.equal(hash(b), a.sha256, `SETUP: corrupt ${a.path}`);
  raw[key] = JSON.parse(b);
}
assert.equal(Object.keys(raw).length, 32);
assert.equal(hash(await readFile(manifest.inputs)), manifest.inputsSHA256);
assert.equal(
  hash(await readFile("reference/tandy-engine-fixture.js")),
  manifest.fixtureSHA256,
);
for (const n of ["IT.DRV", "DUCKTALE.EXE"])
  assert.equal(hash(await readFile(`game/${n}`)), build.files[n].sha256);
const driver = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
assert.equal(hash(driver), manifest.driverSHA256);
function snapshot(raw, ip, sp) {
  const r = batch(raw, 6),
    cpu = r[0].registers;
  for (const k of ["cs", "ds", "es", "ss"]) assert.equal(cpu[k], 0x459c);
  assert.equal(cpu.eip, ip);
  assert.equal(cpu.esp, sp);
  assert.equal(cpu.flags & 0x400, 0);
  const blocks = r.slice(1).map((x, i) => {
    assert.equal(x.addr, [285120, 297408, 301504, 305600, 0x418][i]);
    const b = Buffer.from(x.data, "base64");
    assert.equal(b.length, [12339, 32, 5, 4, 1][i]);
    return b;
  });
  return { cpu, blocks };
}
function compare(data, stream = inputs.cases) {
  assert.equal(stream.length, 29, "unconsumed engine inputs");
  assert.equal(
    Object.keys(data).filter((k) => /^\d\d$/.test(k)).length,
    29,
    "missing engine cases",
  );
  let checkpoints = 0,
    writes = 0,
    chains = 0,
    clocks = 0;
  for (let i = 0; i < stream.length; i++) {
    const c = stream[i],
      r = data[String(i).padStart(2, "0")];
    assert.equal(r.name, c.name);
    assert.equal(r.frames.length, c.repeats, "unfinished interrupt schedule");
    batch(r.seed, 2);
    const expectedBus = [],
      model = new TandyDriver(driver, {
        writePort(p, v) {
          expectedBus.push([p, v]);
        },
      });
    model.memory.set(prepareTandyEngineCase(driver, c));
    let bios = c.bios;
    const check = (capture, label) => {
      const ranges = [
        [0, 12339],
        [0x3000, 0x3020],
        [0x4000, 0x4005],
        [0x5000, 0x5004],
      ];
      for (let n = 0; n < 4; n++)
        assert.deepEqual(
          capture.blocks[n],
          Buffer.from(model.memory.subarray(...ranges[n])),
          `${c.name}: ${label}`,
        );
      assert.equal(capture.blocks[4][0], bios, `${c.name}: external BIOS`);
    };
    if (c.kind === "control")
      assert.equal(
        new DataView(driver.buffer, driver.byteOffset).getUint16(
          0xf5b + (c.opcode & 127) * 2,
          true,
        ),
        c.entry,
      );
    else {
      assert.equal(c.kind, "irq");
      assert.equal(c.entry, 0x2ed);
      assert.equal(c.stop, 0x4003);
    }
    for (const frame of r.frames) {
      batch(frame.setup, 15);
      const step = unwrap(frame.step);
      assert.equal(step.status, "ok");
      assert.equal(step.debugging, true);
      assert.equal(step.stop.registers.cs, 0x459c);
      assert.equal(step.stop.registers.eip, c.entry);
      assert.equal(step.stop.registers.flags & 0x600, 0);
      assert.equal(step.stop.protected_mode, false);
      assert.equal(step.stop.core, "normal");
      assert.deepEqual(
        Buffer.from(step.stop.code_bytes, "base64"),
        Buffer.from(driver.subarray(c.entry, c.entry + 16)),
      );
      check(
        snapshot(frame.before, c.entry, 0xfef0),
        "authored/carried before-state",
      );
      let consumedChains = 0;
      if (c.kind === "control") {
        const result = model.processControl(
          0x1d1 + c.channel * 0x38,
          c.channel,
          c.opcode,
        );
        assert.equal(result, c.stop === 0x906 ? "stop" : true);
      } else {
        const due = model.byte(0x1ca) === 1;
        let masks = 0,
          clockEvents = 0;
        assert.equal(
          model.processInterrupt({
            clearBiosFlags(mask) {
              assert.equal(mask, 0xf7);
              bios &= mask;
              masks++;
            },
            incrementClock(address) {
              assert.deepEqual(address, { offset: 0x5000, segment: 0x459c });
              model.view.setUint32(
                0x5000,
                (model.view.getUint32(0x5000, true) + 1) >>> 0,
                true,
              );
              clockEvents++;
              clocks++;
            },
            chainInterrupt(address) {
              assert.deepEqual(address, { offset: 0x4300, segment: 0x459c });
              consumedChains++;
              chains++;
            },
          }),
          due,
        );
        assert.equal(clockEvents, due ? 1 : 0);
        assert.equal(masks, due ? 1 : 0);
      }
      const actualBus = frame.writes.map((raw) => {
        const s = unwrap(raw),
          ip = s.registers.eip,
          b = Buffer.from(s.code_bytes, "base64");
        assert.equal(s.satisfied, true);
        assert.equal(s.protected_mode, false);
        assert.equal(s.core, "normal");
        assert.equal(s.registers.cs, 0x459c);
        assert.deepEqual(
          b.subarray(0, 2),
          Buffer.from(driver.subarray(ip, ip + 2)),
        );
        assert.ok([0xe6, 0xee].includes(b[0]));
        return [
          b[0] === 0xee ? s.registers.edx & 65535 : b[1],
          s.registers.eax & 255,
        ];
      });
      assert.deepEqual(actualBus, expectedBus, `${c.name}: native OUTs`);
      writes += actualBus.length;
      expectedBus.length = 0;
      assert.equal(
        frame.chains.length,
        consumedChains,
        "unconsumed chained-interrupt events",
      );
      for (const raw of frame.chains) {
        const s = unwrap(raw);
        assert.equal(s.satisfied, true);
        assert.equal(s.registers.cs, 0x459c);
        assert.equal(s.registers.eip, 0x4300);
        assert.equal(s.registers.esp, 0xfef0);
        assert.equal(Buffer.from(s.code_bytes, "base64")[0], 0xcf);
      }
      const stop = unwrap(frame.stop);
      assert.equal(stop.satisfied, true);
      assert.equal(stop.registers.eip, c.stop);
      assert.equal(stop.registers.cs, 0x459c);
      check(
        snapshot(frame.after, c.stop, c.kind === "irq" ? 0xfef6 : 0xfef0),
        "native result",
      );
      checkpoints++;
    }
  }
  assert.deepEqual(
    { checkpoints, writes, chains, clocks },
    { checkpoints: 31, writes: 30, chains: 3, clocks: 3 },
  );
}
compare(raw);
assert.deepEqual(
  [
    manifest.expectedCases,
    manifest.expectedCheckpoints,
    manifest.expectedPortWrites,
    manifest.expectedChains,
    manifest.expectedClockAdvances,
  ],
  [29, 31, 30, 3, 3],
);
const breakpoints = unwrap(raw["final-native"].breakpoints);
assert.equal(breakpoints.count, 18);
assert.ok(
  breakpoints.breakpoints.every((b) => b.active && b.segment === 0x459c),
);
assert.equal(
  breakpoints.breakpoints
    .filter((b) => b.offset !== 0x4300)
    .reduce((n, b) => n + b.hit_count, 0),
  30,
);
assert.equal(
  breakpoints.breakpoints.find((b) => b.offset === 0x4300).hit_count,
  3,
);
const cleanup = raw.cleanup,
  initial = batch(cleanup.context, 3)[0].registers,
  restored = unwrap(cleanup.jumped).stop.registers;
for (const [k, v] of Object.entries(initial))
  if (k !== "flags") assert.equal(restored[k], v);
assert.equal(unwrap(cleanup.freed).status, "ok");
assert.deepEqual(unwrap(cleanup.allocations).allocations, []);
assert.equal(unwrap(cleanup.breakpoints).count, 0);
const missing = structuredClone(raw);
delete missing["03"];
assert.throws(() => compare(missing), /missing engine cases/);
const result = structuredClone(raw),
  r = unwrap(result["28"].frames[2].after),
  b = Buffer.from(r.results[1].data, "base64");
b[0x1c8] ^= 1;
r.results[1].data = b.toString("base64");
result["28"].frames[2].after.content[0].text = JSON.stringify(r);
assert.throws(() => compare(result), /native result/);
const input = structuredClone(inputs.cases);
input[6].extra[0][2] ^= 1;
assert.throws(() => compare(raw, input), /before-state/);
const out = structuredClone(raw),
  o = unwrap(out["06"].frames[0].writes[0]);
o.registers.eax ^= 1;
out["06"].frames[0].writes[0].content[0].text = JSON.stringify(o);
assert.throws(() => compare(out), /native OUTs/);
const chain = structuredClone(raw);
chain["22"].frames[0].chains.pop();
assert.throws(() => compare(chain), /unconsumed chained/);
const unfinished = structuredClone(raw);
unfinished["28"].frames.pop();
assert.throws(() => compare(unfinished), /unfinished interrupt schedule/);
console.log(
  "Tandy engine/IRQ:29 conditional native cases,31 exact checkpoints,30 OUTs,3 clock advances and3 chained events;6 negative controls. No natural-machine timing or waveform parity claimed.",
);
