// Conditional component comparison. Native AFTER values never provide inputs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Jungle } from "../src/game/jungle.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { OrdinaryKeyboard } from "../src/game/ordinary-keyboard.js";
import { jungleComponentResources } from "./jungle-component-replay.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/timing.js";

execFileSync("python3", ["scripts/verify_jungle_cadence.py"], {
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  stdio: "inherit",
});
const manifest = JSON.parse(
  await readFile("reference/jungle-native-cadence.json"),
);
const provider = JSON.parse(
  await readFile("reference/jungle-keyboard-provider.json"),
);
assert.equal(provider.kind, "conditional-emulator-keyboard-provider");
assert.equal(provider.initialRepeatMilliseconds, 500);
assert.equal(provider.repeatMilliseconds, 33);
async function artifact(name) {
  const spec = manifest.artifacts[name];
  assert.ok(spec, `Missing artifact declaration: ${name}`);
  const bytes = await readFile(spec.path);
  assert.equal(bytes.length, spec.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), spec.sha256);
  return JSON.parse(bytes);
}
const entry = await artifact("jungle-entry.json");
const contract = await artifact("jungle-entry-contract.json");
const resources = await jungleComponentResources();
const entryBytes = Buffer.from(entry.state.results[1].data, "base64");
assert.equal(entryBytes.length, 65536);
assert.equal(
  entryBytes[0x3c1],
  0,
  "This scenario requires inherited keyboard mode0",
);
const frameMs = 1000 / RETRACE_HZ;
const state = (m) => ({
  x: m.i(0x5f46),
  y: m.i(0x6858),
  action: m.i(0x6882),
  actorFrame: m.i(0x88ae),
  lostLives: m.i(0x5cfc),
  column: m.i(0x544c),
  row: m.i(0x5462),
  scroll: m.i(0x5ed2),
  seed: m.i(0x2229) & 65535,
});
function run({ omitRepeat = false, omitRelease = false } = {}) {
  const keyboard = new OrdinaryKeyboard(0),
    inputs = [],
    motion = [],
    events = [];
  let now = 0,
    ticks = 0,
    retraces = 0,
    port,
    anchor = null,
    first = null;
  let opening = null,
    made = false,
    released = false,
    repeat = Infinity,
    last = "";
  const sync = () => {
    if (port) port.memory.bytes.set(keyboard.bytes(), 0x276c);
  };
  port = new Jungle(
    {
      ...resources,
      ...contract,
      clock: () => now,
      readInput: () => {
        first ??= state(port.memory);
        const byte = keyboard.poll();
        sync();
        inputs.push({ ms: anchor === null ? null : now - anchor, byte });
        return byte;
      },
      flushInput: () => {
        keyboard.flush();
        sync();
        // Initial wipe5 + frame wipe5 + reveal5. Source048f flush follows
        // both opening page reveals. This hook is not an expected-state probe.
        if (port?.presentations === 15 && anchor === null) {
          anchor = now;
          opening = state(port.memory);
        }
      },
    },
    new FlightMemory(Uint8Array.from(entryBytes)),
  );
  let finished = false;
  for (let steps = 0; steps < 10000; steps++) {
    const tick = ((ticks + 1) * 1000) / DRIVER_HZ;
    const retrace = (retraces + 1) * frameMs;
    const releaseAt = anchor === null ? Infinity : anchor + 40 * frameMs;
    const event =
      anchor === null
        ? Infinity
        : !made
          ? anchor
          : !released
            ? Math.min(releaseAt, repeat)
            : Infinity;
    const next = Math.min(tick, retrace, event);
    if (anchor !== null && next > anchor + 119 * frameMs) {
      finished = true;
      break;
    }
    now = next;
    assert.ok(!port.outcome && Number.isFinite(now), "Unexpected jungle exit");
    if (now === event) {
      if (!made) {
        made = true;
        keyboard.event(0x4d, true);
        events.push({ ms: now - anchor, kind: "make" });
        repeat = omitRepeat
          ? Infinity
          : now + provider.initialRepeatMilliseconds;
      } else if (now === releaseAt) {
        released = true;
        if (!omitRelease) {
          keyboard.event(0x4d, false);
          events.push({ ms: now - anchor, kind: "break" });
        } else repeat = Infinity;
      } else {
        keyboard.event(0x4d, true);
        events.push({ ms: now - anchor, kind: "repeat" });
        repeat += provider.repeatMilliseconds;
      }
      sync();
    } else if (now === tick) {
      ticks++;
      port.advanceTick();
    } else {
      retraces++;
      port.advanceRetrace();
    }
    const current = state(port.memory);
    const key = JSON.stringify([current.x, current.y, current.action]);
    if (anchor !== null && key !== last) {
      motion.push({ ms: now - anchor, state: current });
      last = key;
    }
  }
  assert.ok(
    finished && first && opening && anchor !== null,
    "Unfinished jungle comparison",
  );
  assert.ok(inputs.length > 0, "Zero executed input reads");
  return { first, opening, motion, final: state(port.memory), events, inputs };
}
const actual = run();
// Only now load expected first-input,opening and sampled outcomes.
const nativeState = async (name) =>
  state(
    new FlightMemory(
      Buffer.from((await artifact(name)).state.results[1].data, "base64"),
    ),
  );
const nativeFirst = await nativeState("jungle-first-input.json");
const nativeOpening = await nativeState("jungle-first-presentation.json");
const samples = Object.values(
  (await artifact("jungle-observer-result.json")).output.samples,
).sort((a, b) => a.index - b.index);
const projected = (s) =>
  Object.fromEntries(Object.keys(actual.first).map((k) => [k, s[k]]));
const nativeMotion = samples.filter(
  (s, i) => !i || ["x", "y", "action"].some((k) => s[k] !== samples[i - 1][k]),
);
function compare(result) {
  assert.deepEqual(result.first, nativeFirst, "First input diverged");
  assert.deepEqual(
    result.opening,
    nativeOpening,
    "Opening gameplay state diverged",
  );
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ["make", "repeat", "repeat", "repeat", "break"],
    "Unfinished physical event sequence",
  );
  assert.equal(result.motion.length, 5, "Missing/extra movement transition");
  assert.equal(nativeMotion.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(
      result.motion[i].state,
      projected(nativeMotion[i]),
      `Motion state ${i} diverged`,
    );
    if (i) {
      const low = (nativeMotion[i].index - 2) * frameMs;
      const high = (nativeMotion[i].index - 1) * frameMs;
      assert.ok(
        // Subtracting the opening origin introduces double roundoff. This
        // 1e-9ms allowance is numerical only,not an extra presentation frame.
        result.motion[i].ms >= low - 1e-9 && result.motion[i].ms <= high + 1e-9,
        `Motion ${i} outside native callback bracket;phase is conditional`,
      );
    }
  }
  assert.deepEqual(
    result.final,
    projected(samples.at(-1)),
    "Final sampled gameplay diverged",
  );
}
compare(actual);
const badState = structuredClone(actual);
badState.first.seed ^= 1;
assert.throws(() => compare(badState), /First input diverged/);
const badTime = structuredClone(actual);
badTime.motion[1].ms += 2 * frameMs;
assert.throws(() => compare(badTime), /outside native callback bracket/);
const missing = structuredClone(actual);
missing.motion.pop();
assert.throws(() => compare(missing), /movement transition/);
assert.throws(
  () => compare(run({ omitRepeat: true })),
  /event sequence|transition|diverged/,
);
assert.throws(
  () => compare(run({ omitRelease: true })),
  /event sequence|transition|diverged/,
);
console.log(
  JSON.stringify(
    {
      kind: "conditional-jungle-movement-comparison",
      portTimingAcceptance: false,
      environment:
        "Native ENTRY memory;zero-phase IRQ/retrace;OrdinaryKeyboard mode0;immediate make/break plus500ms initial/33ms repeat;no i8042/IRQ delivery latency or browser",
      exact: {
        firstInput: true,
        opening: true,
        motionStates: 5,
        final: true,
        negatives: 5,
      },
      events: actual.events,
      consumedReads: actual.inputs.length,
      timing: actual.motion.slice(1).map((m, i) => ({
        state: m.state,
        portMs: m.ms,
        nativeBracketMs: [
          (nativeMotion[i + 1].index - 2) * frameMs,
          (nativeMotion[i + 1].index - 1) * frameMs,
        ],
      })),
    },
    null,
    2,
  ),
);
