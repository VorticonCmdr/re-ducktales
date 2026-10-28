import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import {
  securitySetup,
  securityInput,
  securityCommands,
  controlCenterDepartureCommands,
} from "../src/game/security.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
async function required(path) {
  return readFile(path).catch(() => {
    throw Error(`SETUP: missing ${path}; see docs/security.md`);
  });
}
const json = async (path) => JSON.parse(await required(path));
const m = await json("reference/security.json"),
  build = await json(m.buildManifest);
assert.equal(m.expectedArtifactCount, 43);
assert.equal(m.artifacts.length, m.expectedArtifactCount);
assert.equal(m.expectedInputCount, 7);
assert.equal(m.expectedRngCalls, 41);
assert.equal(m.expectedPixelCheckpoints, 11);
assert.equal(sha(await required(m.captureRecipe)), m.captureRecipeSha256);
assert.equal(sha(await required(m.inputStream)), m.inputStreamSha256);
const paths = new Set();
for (const f of m.artifacts) {
  assert.ok(!paths.has(f.path), "Duplicate security artifact");
  paths.add(f.path);
  const bytes = await required(f.path);
  assert.equal(bytes.length, f.bytes, `Truncated ${f.path}`);
  assert.equal(sha(bytes), f.sha256, `Corrupt ${f.path}`);
}
const original = {};
for (const [name, identity] of Object.entries(build.files)) {
  const b = await required(`game/${name}`);
  assert.equal(b.length, identity.bytes);
  assert.equal(sha(b), identity.sha256);
  original[name] = b;
}
const root = m.artifactRoot,
  capture = await json(`${root}/capture.json`);
assert.equal(capture.completed, true);
assert.equal(capture.partialRestore, false);
assert.deepEqual(capture.injections, []);
assert.equal(capture.scriptSha256, m.captureRecipeSha256);
assert.equal(capture.pid, m.emulator.pid);
assert.equal(capture.instanceId, m.emulator.instanceId);
assert.equal(capture.port, m.emulator.port);
assert.equal(capture.rngCalls, m.expectedRngCalls);
assert.equal(capture.requiredInputPolls, m.expectedInputCount);
assert.equal(capture.wrongFirst, true);
const startup = await json(`${root}/startup-inputs.json`);
const startupEvents = [
  ["KBD_n", 1500],
  ["KBD_space", 5000],
  ["KBD_space", 6500],
  ["KBD_space", 8000],
  ["KBD_enter", 9500],
].flatMap(([key, t]) => [
  { type: "key", key, pressed: true, t },
  { type: "key", key, pressed: false, t: t + 150 },
]);
assert.deepEqual(startup.events, startupEvents);
assert.equal(startup.receipt.active, false);
assert.equal(startup.receipt.total, 10);
assert.equal(startup.receipt.dispatched, 10);
assert.equal(startup.receipt.remaining, 0);
const scheduled = await json(`${root}/inputs.json`);
assert.equal(scheduled.length, 7);
assert.deepEqual(
  scheduled.map((r) => r.events),
  [
    startupEvents,
    [
      { type: "key", key: "KBD_right", pressed: true, t: 0 },
      { type: "key", key: "KBD_space", pressed: true, t: 0 },
    ],
    [
      { type: "key", key: "KBD_right", pressed: false, t: 0 },
      { type: "key", key: "KBD_space", pressed: false, t: 0 },
    ],
    ...[true, false, true, false].map((pressed) => [
      { type: "key", key: "KBD_space", pressed, t: 0 },
    ]),
  ],
);
for (const r of scheduled) {
  assert.equal(r.scheduled.status, "ok");
  assert.equal(r.scheduled.events_scheduled, r.events.length);
}
const configuration = await json(`${root}/configuration.json`);
assert.match(configuration.screen.text, /cpu_cycles\s*\n3000/);
assert.match(configuration.screen.text, /core\s*\nauto/);
assert.match(configuration.screen.text, /memsize\s*\n16/);
assert.match(configuration.screen.text, /machine\s*\nsvga_s3/);
const engine = await json(`${root}/engine.json`);
assert.equal(engine.pid, capture.pid);
assert.equal(engine.instance_id, capture.instanceId);
// Compare the complete actual game overlay after all180 relocation words.
// This checks the executable/loader mapping afresh for this independent launch.
const live = await json(`${root}/live-overlay.json`),
  map = live.mapping;
const exe = original["DUCKTALE.EXE"],
  at = 0xf600;
assert.equal(exe.readUInt16LE(at + 26), 2);
assert.equal(exe.readUInt16LE(at + 6), 180);
const length =
  (exe.readUInt16LE(at + 4) - 1) * 512 + (exe.readUInt16LE(at + 2) || 512);
const body = Buffer.from(
  exe.subarray(at + exe.readUInt16LE(at + 8) * 16, at + length),
);
assert.equal(body.length, 8368);
for (let i = 0; i < 180; i++) {
  const r = at + exe.readUInt16LE(at + 24) + i * 4;
  const pos = exe.readUInt16LE(r) + exe.readUInt16LE(r + 2) * 16 - 0xc170;
  assert.ok(pos >= 0 && pos + 1 < body.length);
  body.writeUInt16LE((body.readUInt16LE(pos) + map.load) & 65535, pos);
}
assert.equal(map.ds, map.load + 0x120e);
assert.equal(live.read.aborted, false);
assert.equal(live.read.results.length, 1);
assert.equal(live.read.results[0].status, "ok");
assert.equal(live.read.results[0].addr, map.overlay * 16);
const sameCode = (bytes) =>
  assert.deepEqual(bytes, body, "Security original code mapping");
sameCode(Buffer.from(live.read.results[0].data, "base64"));
const changedCode = Buffer.from(body);
changedCode[0x8e7] ^= 1;
assert.throws(() => sameCode(changedCode), /Security original code mapping/);
async function state(name, ip) {
  const r = await json(`${root}/${name}.json`),
    cpu = r.stop.registers;
  assert.equal(r.stop.satisfied, true);
  assert.equal(r.stop.reason, "breakpoint");
  assert.equal(r.stop.protected_mode, false);
  assert.equal(r.stop.core, "normal");
  assert.equal(cpu.cs, map.overlay);
  assert.equal(cpu.ds, map.ds);
  assert.equal(cpu.ss, map.ds);
  assert.equal(cpu.eip, ip);
  assert.equal(r.state.aborted, false);
  assert.equal(r.state.results.length, 2);
  const [observedCpu, memory] = r.state.results;
  assert.equal(observedCpu.status, "ok");
  assert.equal(memory.status, "ok");
  assert.deepEqual(observedCpu.registers, cpu);
  assert.equal(memory.addr, map.ds * 16);
  const ds = Buffer.from(memory.data, "base64");
  assert.equal(ds.length, 65536);
  return { cpu, ds };
}
const stream = await json(m.inputStream);
assert.equal(stream.expectedEventCount, m.expectedInputCount);
assert.equal(stream.events.length, m.expectedInputCount);
const start = stream.initialState,
  entry = await state("entry", 0x7ad);
assert.equal(entry.ds.readUInt16LE(0x2229), start.seed);
assert.equal(entry.ds[0x4e0e], start.day);
assert.equal(entry.ds.readInt32LE(0x8cc0), start.money);
const setup = securitySetup(start.seed),
  rng = await json(`${root}/rng-consumption.json`);
function compareDraws(draws) {
  assert.equal(
    draws.length,
    m.expectedRngCalls,
    "Incomplete security RNG sequence",
  );
  assert.equal(rng.length, draws.length);
  for (const [i, d] of draws.entries()) {
    const r = rng[i];
    assert.equal(r.stop.registers.cs, map.overlay);
    assert.equal(d.source, r.stop.registers.eip, `RNG call site ${i}`);
    assert.equal(r.state.aborted, false);
    assert.equal(r.state.results.length, 2);
    const read = r.state.results[0];
    assert.equal(read.status, "ok");
    assert.equal(read.addr, map.ds * 16 + 0x2229);
    assert.equal(
      d.before,
      Buffer.from(read.data, "base64").readUInt16LE(),
      `Security RNG before ${i}`,
    );
  }
}
compareDraws(setup.draws);
assert.throws(() => compareDraws([]), /Incomplete security RNG sequence/);
const alteredDraws = setup.draws.map((d) => ({ ...d }));
alteredDraws[1].before ^= 1;
assert.throws(() => compareDraws(alteredDraws), /Security RNG before 1/);
const generated = await state("generated", 0xa42);
assert.equal(generated.ds.readUInt16LE(0x2229), setup.seed);
assert.equal(
  generated.ds.toString(
    "ascii",
    generated.cpu.ebp - 28,
    generated.cpu.ebp - 24,
  ),
  setup.target,
);
assert.equal(generated.ds.readUInt16LE(generated.cpu.ebp - 4), setup.targetRow);
assert.equal(setup.seed, capture.finalSeed);
let selection = start.selection,
  failures = start.failures,
  consumed = 0,
  last;
for (const event of stream.events) {
  const r = await state(event.checkpoint, 0xac4);
  assert.equal(r.cpu.eax & 255, event.byte);
  assert.equal(r.ds.readUInt16LE(r.cpu.ebp - 18), selection);
  assert.equal(r.ds[r.cpu.ebp - 2], failures);
  last = securityInput(selection, failures, setup.targetRow, event.byte);
  selection = last.selection;
  failures = last.failures;
  consumed++;
}
assert.equal(consumed, capture.requiredInputPolls);
assert.equal(last.action, "alarm");
assert.equal(failures, 2);
for (const [name, ip, expectedFailures] of [
  ["first-result", 0xb94, 0],
  ["cleanup", 0xc70, 2],
  ["return", 0xca5, 2],
]) {
  const r = await state(name, ip);
  assert.equal(r.ds.readUInt16LE(0x2229), setup.seed);
  assert.equal(r.ds[r.cpu.ebp - 2], expectedFailures);
  if (name === "return") assert.equal(r.cpu.eax, 1);
}
for (let i = 0; i < 6; i++) {
  const r = await state(`alarm-${i}`, i % 2 === 0 ? 0xc24 : 0xc5e);
  assert.equal(r.ds.readUInt16LE(0x2229), setup.seed);
  assert.equal(r.ds.readUInt16LE(r.cpu.ebp - 18), selection);
}
const entries = parseArchive(original["MAIN.ARC"]),
  image = unpackImage(exe);
const pictures = new Map();
for (const c of m.pixelCases) {
  const png = PNG.sync.read(await required(`${root}/${c.name}.png`));
  assert.equal(png.width, 320);
  assert.equal(png.height, 200);
  assert.ok(!pictures.has(c.name));
  pictures.set(c.name, png.data);
}
function comparePictures(cases) {
  assert.equal(
    cases.length,
    m.expectedPixelCheckpoints,
    "Incomplete security pictures",
  );
  const seen = new Set();
  for (const c of cases) {
    assert.ok(!seen.has(c.name));
    seen.add(c.name);
    assert.ok(
      ["office", "challenge", "warning", "alarm", "return"].includes(c.kind),
      "Unsupported security picture",
    );
    const commands =
      c.kind === "office"
        ? controlCenterDepartureCommands()
        : c.kind === "return"
          ? [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 }]
          : securityCommands(image, setup, {
              ...start,
              selection,
              warning: c.kind === "warning",
              alarm: c.kind === "alarm" ? c.red : null,
            });
    assert.deepEqual(
      Buffer.from(
        renderFlightPixels(commands, entries, entries[42].data, "MAIN.ARC"),
      ),
      pictures.get(c.name),
      `Security pixels ${c.name}`,
    );
  }
}
comparePictures(m.pixelCases);
assert.throws(
  () => comparePictures(m.pixelCases.slice(1)),
  /Incomplete security pictures/,
);
pictures.get("initial-poll-3")[0] ^= 1;
assert.throws(
  () => comparePictures(m.pixelCases),
  /Security pixels initial-poll-3/,
);
pictures.get("initial-poll-3")[0] ^= 1;
console.log(
  "Security segment:41 carried native RNG boundaries,7 consumed inputs,11 exact pictures,return1 and5 negative controls. Not browser integration, native movement/correct-first-choice coverage or whole-campaign parity.",
);
