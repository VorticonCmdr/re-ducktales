import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { TandyDriver } from "../src/tandy-driver.js";
import build from "../reference/build.json" with { type: "json" };
const sequenceMode = process.argv.includes("--sequence");
assert.ok(
  process.argv.slice(2).every((arg) => arg === "--sequence"),
  "unknown cue verification option",
);
const manifest = JSON.parse(
  await readFile(
    new URL(
      sequenceMode
        ? "../reference/tandy-sequence-cues.json"
        : "../reference/tandy-cues.json",
      import.meta.url,
    ),
  ),
);
const requiredInputs = sequenceMode
  ? [
      { sound: 2, ticks: 27 },
      { sound: 25, ticks: 25 },
    ]
  : [
      { sound: 67, ticks: 17 },
      { sound: 68, ticks: 17 },
    ];
const requiredCheckpoints = sequenceMode ? 56 : 38;
const requiredWrites = sequenceMode ? 129 : 84;
const priorWrites = sequenceMode ? 4 : 0;
const firstSound = requiredInputs[0].sound,
  lastSound = requiredInputs[1].sound;
import driverManifest from "../reference/tandy-driver.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
const raw = {};
for (const [key, item] of Object.entries(manifest.artifacts)) {
  const b = await readFile(item.path).catch(() => {
    throw Error(`SETUP: missing ${item.path}; see docs/tandy-audio.md`);
  });
  assert.equal(hash(b), item.sha256, `SETUP: corrupt ${item.path}`);
  raw[key] = JSON.parse(b);
}
assert.equal(Object.keys(raw).length, sequenceMode ? 62 : 42);
assert.equal(manifest.expectedCheckpoints, requiredCheckpoints);
assert.equal(manifest.expectedPortWrites, requiredWrites);
for (const name of ["DUCKTALE.EXE", "IT.DRV"])
  assert.equal(hash(await readFile(`game/${name}`)), build.files[name].sha256);
const driver = parseArchive(await readFile("game/IT.DRV"), "IT.DRV")[4].data;
assert.equal(hash(driver), driverManifest.driver.sha256);
function unwrap(r) {
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
function batch(raw, length) {
  const r = unwrap(raw);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, length);
  assert.ok(r.results.every((x) => x.status === "ok"));
  return r.results;
}
function capture(raw) {
  const r = batch(raw, 3),
    cpu = r[0].registers;
  for (const k of ["cs", "ds", "es", "ss"]) assert.equal(cpu[k], 0x459c);
  assert.equal(cpu.esp, 0xfef0);
  assert.equal(cpu.flags & 0x400, 0);
  assert.equal(r[1].addr, 285120);
  assert.equal(r[2].addr, 0x418);
  const memory = Buffer.from(r[1].data, "base64"),
    bios = Buffer.from(r[2].data, "base64");
  assert.equal(memory.length, 12339);
  assert.equal(bios.length, 1);
  return { cpu, memory, bios: bios[0] };
}
function portWrites(stops) {
  return stops.map((r) => {
    const s = unwrap(r),
      ip = s.registers.eip,
      bytes = Buffer.from(s.code_bytes, "base64");
    assert.equal(s.protected_mode, false);
    assert.equal(s.core, "normal");
    assert.equal(s.satisfied, true);
    assert.equal(s.registers.cs, 0x459c);
    assert.equal(s.breakpoint.offset, ip);
    assert.deepEqual(
      bytes.subarray(0, 2),
      Buffer.from(driver).subarray(ip, ip + 2),
    );
    assert.equal(bytes[0], 0xe6);
    assert.ok([0x61, 0xc0].includes(bytes[1]));
    return [bytes[1], s.registers.eax & 255];
  });
}
function compare(data, input = manifest.inputs) {
  assert.deepEqual(input, requiredInputs, "required cue inputs");
  let checkpoints = 0,
    writes = 0;
  for (const { sound, ticks } of input) {
    if (sequenceMode) {
      const setup = batch(data[`${sound}-setup`], 2);
      assert.deepEqual(
        setup.map((r) => r.op),
        ["mem_write", "cpu_write"],
      );
      assert.equal(setup[0].addr, 285120);
      assert.equal(setup[1].value, 0xfef0);
    }
    const events = data[`${sound}-events`];
    assert.equal(events.sound, sound);
    assert.equal(events.ticks, ticks);
    assert.equal(events.bios.length, ticks, "unconsumed BIOS events");
    const resetRead = unwrap(events.resetRead);
    assert.equal(resetRead.satisfied, true);
    assert.equal(resetRead.protected_mode, false);
    assert.equal(resetRead.registers.cs, 0x459c);
    assert.equal(resetRead.registers.eip, 0x729);
    // Consumed IN61 value, captured before OR AL,60. It is not reconstructed
    // from the expected OUT value, which overwrites two of the input bits.
    assert.deepEqual(
      [...driver.subarray(0x727, 0x72b)],
      [0xe4, 0x61, 0x0c, 0x60],
    );
    assert.deepEqual(
      Buffer.from(resetRead.code_bytes, "base64").subarray(0, 2),
      Buffer.from([0x0c, 0x60]),
    );
    let bus = [];
    const model = new TandyDriver(driver, {
      writePort: (p, v) => bus.push([p, v]),
    });
    for (const label of [
      "reset",
      "start",
      ...Array.from({ length: ticks }, (_, i) =>
        String(i + 1).padStart(2, "0"),
      ),
    ]) {
      const r = data[`${sound}-${label}`];
      assert.ok(r, `missing native cue checkpoint ${sound}-${label}`);
      assert.equal(
        r.label,
        label === "reset" || label === "start" ? label : `tick${Number(label)}`,
      );
      assert.equal(
        r.entry,
        label === "reset" ? 0x727 : label === "start" ? 0x4100 : 0x403,
      );
      const before = capture(r.before);
      assert.equal(before.cpu.eip, 0x4000);
      assert.deepEqual(
        Buffer.from(model.memory.subarray(0, 12339)),
        before.memory,
        "carried native cue before-state",
      );
      let bios = before.bios,
        consumed = 0;
      if (label === "reset") model.reset(resetRead.registers.eax & 255);
      else if (label === "start") model.start(sound);
      else {
        const event = events.bios[Number(label) - 1];
        assert.equal(event.tick, Number(label));
        const b = Buffer.from(event.value, "base64");
        assert.equal(b.length, 1);
        assert.equal(b[0], before.bios, "external BIOS boundary");
        bios = b[0];
        model.processTick({
          clearBiosFlags(mask) {
            bios &= mask;
            consumed++;
          },
        });
        assert.equal(consumed, 1);
      }
      const after = capture(r.after),
        stop = unwrap(r.stop);
      assert.equal(after.cpu.eip, 0x4003);
      assert.equal(stop.registers.cs, 0x459c);
      assert.equal(stop.registers.eip, 0x4003);
      assert.equal(stop.protected_mode, false);
      assert.equal(stop.satisfied, true);
      assert.deepEqual(
        Buffer.from(model.memory.subarray(0, 12339)),
        after.memory,
        "entire native cue state",
      );
      assert.equal(after.bios, bios);
      assert.deepEqual(bus, portWrites(r.writes), "native cue port writes");
      writes += bus.length;
      bus = [];
      checkpoints++;
    }
    assert.equal(model.active, false, "unfinished native cue sequence");
  }
  assert.equal(checkpoints, requiredCheckpoints);
  assert.equal(writes, requiredWrites);
}
compare(raw);
const altered = structuredClone(raw),
  a = unwrap(altered[`${lastSound}-01`].after);
const memory = Buffer.from(a.results[1].data, "base64");
memory[0x1ef] ^= 1;
a.results[1].data = memory.toString("base64");
altered[`${lastSound}-01`].after.content[0].text = JSON.stringify(a);
assert.throws(() => compare(altered), /entire native cue state/);
const missing = structuredClone(raw);
delete missing[`${firstSound}-09`];
assert.throws(() => compare(missing), /missing native cue checkpoint/);
const event = structuredClone(raw);
event[`${lastSound}-events`].bios.pop();
assert.throws(() => compare(event), /unconsumed BIOS events/);
const out = structuredClone(raw),
  p = unwrap(out[`${firstSound}-01`].writes[0]);
p.registers.eax ^= 1;
out[`${firstSound}-01`].writes[0].content[0].text = JSON.stringify(p);
assert.throws(() => compare(out), /native cue port writes/);
assert.throws(
  () => compare(raw, manifest.inputs.slice(1)),
  /required cue inputs/,
);
const final = raw["final-native"],
  breakpoints = unwrap(final.breakpoints);
assert.equal(breakpoints.count, 17);
const expected = [
  0x729, 0x72b, 0x321, 0x327, 0x493, 0x4c5, 0x784, 0x7ad, 0x7d6, 0x7ff, 0x8c2,
  0x8ee, 0x903, 0xa57, 0xe41, 0xe4e, 0x4003,
];
assert.deepEqual(
  breakpoints.breakpoints.map((b) => b.offset).sort((a, b) => a - b),
  expected.sort((a, b) => a - b),
);
assert.ok(
  breakpoints.breakpoints.every((b) => b.active && b.segment === 0x459c),
);
assert.equal(
  breakpoints.breakpoints
    .filter((b) => ![0x729, 0x4003].includes(b.offset))
    .reduce((n, b) => n + b.hit_count, 0),
  requiredWrites + priorWrites,
);
const wrapper = batch(final.reads, 3)[1];
assert.deepEqual(
  Buffer.from(wrapper.data, "base64"),
  Buffer.from([
    0x68,
    lastSound,
    0,
    0x9a,
    0x15,
    4,
    0x9c,
    0x45,
    0x83,
    0xc4,
    2,
    0xc3,
  ]),
);
const cleanup = raw.cleanup,
  initial = batch(cleanup.context, 2)[0].registers,
  restored = unwrap(cleanup.jumped).stop.registers;
for (const k of Object.keys(initial).filter((k) => k !== "flags"))
  assert.equal(restored[k], initial[k], `restored ${k}`);
assert.equal(unwrap(cleanup.freed).status, "ok");
assert.deepEqual(unwrap(cleanup.allocations).allocations, []);
assert.equal(unwrap(cleanup.breakpoints).count, 0);
console.log(
  `Tandy ${firstSound}/${lastSound}: ${requiredCheckpoints} carried native driver checkpoints, ${requiredWrites} exact port writes, separate consumed input streams, 5 negative controls. IRQ scheduling and waveform unverified.`,
);
