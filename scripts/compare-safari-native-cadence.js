// Conditional component experiment, not browser or native timing acceptance.
// Inputs come only from ENTRY memory/stack and a declared zero-phase provider.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Photography } from "../src/game/photography.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/timing.js";

execFileSync("python3", ["scripts/verify_safari_cadence.py"], {
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  stdio: "inherit",
});
const manifest = JSON.parse(
  await readFile("reference/safari-native-cadence.json"),
);
async function artifact(name) {
  const spec = manifest.artifacts[name];
  assert.ok(spec, `Missing artifact declaration: ${name}`);
  const bytes = await readFile(spec.path);
  assert.equal(bytes.length, spec.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), spec.sha256);
  return JSON.parse(bytes);
}
const entry = await artifact("safari-entry.json");
const contract = await artifact("safari-entry-contract.json");
const entryBytes = Buffer.from(entry.state.results[1].data, "base64");
assert.equal(entryBytes.length, 65536);
const build = JSON.parse(await readFile("reference/build.json"));
async function original(name) {
  const bytes = await readFile(`game/${name}`),
    spec = build.files[name];
  assert.equal(bytes.length, spec.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), spec.sha256);
  return bytes;
}
const image = unpackImage(await original("DUCKTALE.EXE"));
const entries = parseArchive(await original("PS.ARC"), "PS.ARC");
const mainEntries = parseArchive(await original("MAIN.ARC"), "MAIN.ARC");
const state = (m) => ({
  seed: m.i(0x2229) & 65535,
  film: m.b(0x5d2a),
  column: m.b(0x4dde),
  target: m.i(0x5f48),
  animals: Array.from(m.bytes.slice(0x896c, 0x8990)),
});
// Main begins PUSH BP/MOV BP,SP. Copy only its future 0x66-byte frame
// from ENTRY, before any translated initialization. No AFTER data is injected.
const bp = (entry.stop.registers.esp & 65535) - 2;
let now = 0,
  ticks = 0,
  retraces = 0,
  first = null,
  port;
const completions = [],
  inputs = [];
port = new Photography(
  {
    ...contract,
    image,
    entries,
    mainEntries,
    stackBytes: entryBytes.subarray(bp - 0x66, bp),
    clock: () => now,
    readInput: () => {
      first ??= { time: now, state: state(port.memory) };
      inputs.push(0); // Independent neutral input stream, never expected-state-derived.
      return 0;
    },
  },
  new FlightMemory(Uint8Array.from(entryBytes)),
);
let previous = 0;
for (let steps = 0; steps < 10000 && completions.length < 18; steps++) {
  const tick = ((ticks + 1) * 1000) / DRIVER_HZ;
  const retrace = ((retraces + 1) * 1000) / RETRACE_HZ;
  const graphics = port.wait?.clock === "graphics" ? port.wait.until : Infinity;
  now = Math.min(tick, retrace, graphics);
  assert.ok(
    Number.isFinite(now) && !port.outcome,
    "Unfinished neutral scenario",
  );
  if (now === graphics) port.advanceGraphics();
  else if (now === tick) {
    ticks++;
    port.advanceTick();
  } else {
    retraces++;
    port.advanceRetrace();
  }
  const counter = port.locals.i(-0x58);
  if (counter !== previous) {
    assert.equal(counter, previous + 1);
    completions.push({
      counter,
      ms: now - first.time,
      seed: state(port.memory).seed,
    });
    previous = counter;
  }
}
assert.equal(inputs.length, 18, "Unfinished or extra input sequence");
assert.ok(inputs.every((x) => x === 0));
// Expected artifacts are read only AFTER the closed-loop simulation finishes.
const expected = await artifact("safari-first-input.json");
const nativeFirst = state(
  new FlightMemory(Buffer.from(expected.state.results[1].data, "base64")),
);
const observed = (await artifact("safari-observer-result.json")).output.samples;
const samples = Object.values(observed).sort((a, b) => a.index - b.index);
const nativeCompletions = samples.filter(
  (s, i) => i && s.counter !== samples[i - 1].counter,
);
function compare(actualFirst, actual, targetFirst, target) {
  assert.deepEqual(
    actualFirst,
    targetFirst,
    "First-input gameplay state diverged",
  );
  assert.equal(actual.length, 18, "Missing port completion");
  assert.equal(target.length, 18, "Missing native completion");
  for (let i = 0; i < 18; i++) {
    assert.equal(actual[i].counter, target[i].counter, "Counter diverged");
    assert.equal(
      actual[i].seed,
      target[i].seed,
      `RNG diverged at completion ${i + 1}`,
    );
  }
}
compare(first.state, completions, nativeFirst, nativeCompletions);
assert.throws(() =>
  compare(
    { ...first.state, seed: first.state.seed ^ 1 },
    completions,
    nativeFirst,
    nativeCompletions,
  ),
);
assert.throws(() =>
  compare(first.state, completions.slice(1), nativeFirst, nativeCompletions),
);
const changed = structuredClone(completions);
changed[8].seed ^= 1;
assert.throws(() =>
  compare(first.state, changed, nativeFirst, nativeCompletions),
);
const frameMs = 1000 / RETRACE_HZ;
const timing = completions.map((c, i) => {
  const index = nativeCompletions[i].index;
  // The native counter changed between successive render callbacks. Preserve
  // that bracket, and report signed distance without fitting the port phase.
  const low = (index - 2) * frameMs,
    high = (index - 1) * frameMs;
  return {
    counter: c.counter,
    portMs: c.ms,
    nativeBracketMs: [low, high],
    outsideBracketMs: c.ms < low ? c.ms - low : c.ms > high ? c.ms - high : 0,
  };
});
console.log(
  JSON.stringify(
    {
      kind: "conditional-safari-neutral-comparison",
      portTimingAcceptance: false,
      environment:
        "ENTRY memory and future stack; zero-phase IRQ/retrace; original phase not recovered; neutral input; no browser",
      exact: {
        firstGameplayState: true,
        completionRngStates: 18,
        inputs: inputs.length,
        negatives: 3,
      },
      timing,
    },
    null,
    2,
  ),
);
