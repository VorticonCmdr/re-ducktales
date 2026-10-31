// Exploratory strict comparison. A native divergence exits1,not acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Cave } from "../src/game/cave.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { OrdinaryKeyboard } from "../src/game/ordinary-keyboard.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { parseCaveMaps } from "../src/game/cave-scene.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/timing.js";

execFileSync("python3", ["scripts/verify_cave_cadence.py"], {
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  stdio: "inherit",
});
const manifest = JSON.parse(
  await readFile("reference/cave-native-cadence.json"),
);
async function artifact(name) {
  const spec = manifest.artifacts[name],
    b = await readFile(spec.path);
  assert.equal(b.length, spec.bytes);
  assert.equal(createHash("sha256").update(b).digest("hex"), spec.sha256);
  return JSON.parse(b);
}
const entry = await artifact("cave-entry.json");
const contract = await artifact("cave-entry-contract.json");
const { image, archives } = await originalGame();
const entryBytes = Buffer.from(entry.state.results[1].data, "base64");
assert.equal(entryBytes.length, 65536);
assert.equal(entryBytes[0x3c1], 0);
const frameMs = 1000 / RETRACE_HZ;
const state = (m) => ({
  room: m.i(0x4d32),
  torch: m.b(0x8b54),
  money: m.view.getUint32(0x8cc0, true),
  seed: m.i(0x2229) & 65535,
  enemy: m.i(0x6810),
  partyX: m.i(0x54fc) & 65535,
  partyY: m.i(0x54fe) & 65535,
  partyFrame: m.b(0x550e),
  entering: m.i(0x8eb2),
});
const keyboard = new OrdinaryKeyboard(0),
  inputs = [],
  events = [],
  changes = [];
let now = 0,
  ticks = 0,
  retraces = 0,
  port,
  anchor = null,
  first = null;
let made = false,
  released = false,
  finished = false,
  last = "";
port = new Cave(
  {
    ...contract,
    image,
    entries: archives.get("EXP.ARC"),
    maps: parseCaveMaps(archives.get("CAVEMAPS.ARC")),
    clock: () => now,
    readInput: () => {
      if (anchor === null) {
        anchor = now;
        first = state(port.memory);
        // Capture at the reader boundary,not after synchronous post-read
        // party/RNG work in this same scheduler callback.
        changes.push({ ms: 0, state: first });
        last = JSON.stringify([first.room, first.torch, first.money, first.entering]);
      }
      const byte = keyboard.poll();
      inputs.push({ ms: now - anchor, byte });
      return byte;
    },
    flushInput: () => keyboard.flush(),
  },
  new FlightMemory(Uint8Array.from(entryBytes)),
);
for (let steps = 0; steps < 20000; steps++) {
  const tick = ((ticks + 1) * 1000) / DRIVER_HZ,
    retrace = (retraces + 1) * frameMs;
  const graphics = port.wait?.clock === "graphics" ? port.wait.until : Infinity;
  const event =
    anchor === null
      ? Infinity
      : !made
        ? anchor
        : !released
          ? anchor + 10 * frameMs
          : Infinity;
  const next = Math.min(tick, retrace, graphics, event);
  if (anchor !== null && next > anchor + 479 * frameMs) {
    finished = true;
    break;
  }
  now = next;
  assert.ok(Number.isFinite(now) && !port.outcome, "Unexpected cave exit");
  if (now === event) {
    const pressed = !made;
    for (const scan of [0x4d, 0x39]) {
      keyboard.event(scan, pressed);
      events.push({ ms: now - anchor, scan, pressed });
    }
    if (!made) made = true;
    else released = true;
  } else if (now === graphics) port.advanceGraphics();
  else if (now === tick) {
    ticks++;
    port.advanceTick();
  } else {
    retraces++;
    port.advanceRetrace();
  }
  const current = state(port.memory),
    key = JSON.stringify([
      current.room,
      current.torch,
      current.money,
      current.entering,
    ]);
  if (anchor !== null && key !== last) {
    changes.push({ ms: now - anchor, state: current });
    last = key;
  }
}
assert.ok(finished && first && released, "Unfinished cave probe");
assert.ok(inputs.length > 0);
assert.deepEqual(
  events.map((e) => [e.scan, e.pressed]),
  [
    [0x4d, true],
    [0x39, true],
    [0x4d, false],
    [0x39, false],
  ],
);
const expectedFirst = state(
  new FlightMemory(
    Buffer.from(
      (await artifact("cave-first-input.json")).state.results[1].data,
      "base64",
    ),
  ),
);
assert.deepEqual(first, expectedFirst, "First-input state diverged");
const csv = (await artifact("cave-observer-result.json")).output.samplesCSV;
const columns = [
  "index",
  "frame",
  "clock",
  "page",
  "room",
  "torch",
  "money",
  "seed",
  "enemy",
  "partyX",
  "partyY",
  "partyFrame",
  "entering",
];
const samples = csv.split("\n").map((line) => {
  const values = line.split(",");
  assert.equal(values.length, columns.length);
  return Object.fromEntries(columns.map((k, i) => [k, Number(values[i])]));
});
assert.equal(samples.length, 480);
const nativeChanges = samples.filter(
  (s, i) =>
    !i ||
    ["room", "torch", "money", "entering"].some(
      (k) => s[k] !== samples[i - 1][k],
    ),
);
const expected = nativeChanges.map((s) => ({
  state: Object.fromEntries(Object.keys(first).map((k) => [k, s[k]])),
  bracketMs: [Math.max(0, s.index - 2) * frameMs, (s.index - 1) * frameMs],
}));
const final = state(port.memory),
  nativeFinal = Object.fromEntries(
    Object.keys(first).map((k) => [k, samples.at(-1)[k]]),
  );
let firstDifference = null;
for (let i = 0; i < Math.max(changes.length, expected.length); i++) {
  if (!changes[i] || !expected[i]) {
    firstDifference = {
      index: i,
      kind: "transition-count",
      port: changes[i] ?? null,
      native: expected[i] ?? null,
    };
    break;
  }
  try {
    assert.deepEqual(changes[i].state, expected[i].state);
    assert.ok(
      changes[i].ms >= expected[i].bracketMs[0] - 1e-9 &&
        changes[i].ms <= expected[i].bracketMs[1] + 1e-9,
    );
  } catch {
    firstDifference = {
      index: i,
      kind: "state-or-timing",
      port: changes[i],
      native: expected[i],
    };
    break;
  }
}
const passed =
  firstDifference === null &&
  JSON.stringify(final) === JSON.stringify(nativeFinal);
console.log(
  JSON.stringify(
    {
      kind: "exploratory-cave-native-comparison",
      accepted: false,
      comparisonPassed: passed,
      environment:
      "Native ENTRY memory;zero-phase IRQ/retrace;immediate ordinary mode0 makes at0ms and breaks after10 render intervals;no repeat before release;counted resident LZW/RAM conversion only;no original i8042,complete DOS/allocator/IRQ reconstruction or browser",
      firstInputMatches: true,
      consumedReads: inputs.length,
      events,
      firstDifference,
      portChanges: changes,
      nativeChanges: expected,
      final,
      nativeFinal,
    },
    null,
    2,
  ),
);
if (!passed) process.exitCode = 1;
