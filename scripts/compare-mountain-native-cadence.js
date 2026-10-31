// Conditional carried component comparison; not whole-level/browser acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Mountain } from "../src/game/mountain.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { OrdinaryKeyboard } from "../src/game/ordinary-keyboard.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/timing.js";

execFileSync(process.execPath, ["scripts/verify-mountain-pages.js"], {
  stdio: "inherit",
});
const manifest = JSON.parse(
  await readFile("reference/mountain-native-comparison.json"),
);
assert.equal(manifest.kind, "conditional-mountain-neutral-entry-comparison");
assert.equal(manifest.portTimingAcceptance, false);
assert.deepEqual(manifest.fittedInputs, []);
assert.deepEqual(manifest.inputContract, {
  makeFrame: 0,
  releaseFrame: 40,
  observerIntervals: 79,
  initialRepeatMilliseconds: 500,
  repeatMilliseconds: 33,
});
const parent = JSON.parse(await readFile(manifest.parent));
async function artifact(spec) {
  const b = await readFile(spec.path);
  assert.equal(b.length, spec.bytes, `Incomplete ${spec.path}`);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    spec.sha256,
    `Corrupt ${spec.path}`,
  );
  return JSON.parse(b);
}
const entry = await artifact(manifest.entry);
assert.equal(entry.stop.registers.eip, 0);
assert.equal(entry.stop.protected_mode, false);
const entryBytes = Buffer.from(entry.state.results[1].data, "base64");
assert.equal(entryBytes.length, 65536);
assert.equal(entryBytes[0x3c1], 0);
assert.equal(entry.stop.registers.ds, entry.stop.registers.ss);
const code = await artifact(parent.artifacts.code);
assert.equal(entry.stop.registers.cs, code.segment);
assert.equal(entry.stop.registers.ds, code.ds);
const { image, archives } = await originalGame();
const sp = entry.stop.registers.esp & 65535,
  bp = sp - 2;
const initial = {
  variant: entryBytes.readUInt16LE(sp + 4),
  difficulty: entryBytes[0x8990],
  day: entryBytes[0x4e0e],
  seed: entryBytes.readUInt16LE(0x2229),
  money: entryBytes.readUInt32LE(0x8cc0),
};
const frameMs = 1000 / RETRACE_HZ;
const state = (m) => ({
  x: m.i(0x5ae0),
  y: m.i(0x5c72),
  action: m.i(0x6882),
  actorFrame: m.i(0x6d3c),
  lives: m.b(0x4d34),
  seed: m.i(0x2229) & 65535,
});
function run({ omitMake = false, omitRelease = false } = {}) {
  const keyboard = new OrdinaryKeyboard(0),
    inputs = [],
    events = [],
    motion = [];
  let now = 0,
    ticks = 0,
    retraces = 0,
    port,
    anchor = null,
    first = null;
  let made = false,
    released = false,
    repeat = Infinity,
    last = "",
    finished = false;
  port = new Mountain(
    {
      ...initial,
      image,
      entries: archives.get("MT.ARC"),
      mainEntries: archives.get("MAIN.ARC"),
      // Main's future frame comes only from ENTRY,not its first-input snapshot.
      stackBytes: entryBytes.subarray(bp - 0x52, bp),
      clock: () => now,
      flushInput: () => keyboard.flush(),
      readInput: () => {
        if (anchor === null) {
          anchor = now;
          first = state(port.memory);
        }
        const byte = keyboard.poll();
        inputs.push({ ms: now - anchor, byte });
        return byte;
      },
    },
    new FlightMemory(Uint8Array.from(entryBytes)),
  );
  for (let steps = 0; steps < 10000; steps++) {
    const tick = ((ticks + 1) * 1000) / DRIVER_HZ,
      retrace = (retraces + 1) * frameMs;
    const graphics =
      port.wait?.clock === "graphics" ? port.wait.until : Infinity;
    const releaseAt = anchor === null ? Infinity : anchor + 40 * frameMs;
    const event =
      anchor === null
        ? Infinity
        : !made
          ? anchor
          : !released
            ? Math.min(releaseAt, repeat)
            : Infinity;
    const next = Math.min(tick, retrace, graphics, event);
    if (anchor !== null && next > anchor + 79 * frameMs) {
      finished = true;
      break;
    }
    now = next;
    assert.ok(
      Number.isFinite(now) && !port.outcome,
      "Unexpected mountain exit",
    );
    if (now === event) {
      if (!made) {
        made = true;
        if (!omitMake) {
          keyboard.event(0x4d, true);
          events.push({ ms: now - anchor, kind: "make" });
          repeat = now + 500;
        }
      } else if (now === releaseAt) {
        released = true;
        if (!omitRelease) {
          keyboard.event(0x4d, false);
          events.push({ ms: now - anchor, kind: "break" });
        }
      } else {
        keyboard.event(0x4d, true);
        events.push({ ms: now - anchor, kind: "repeat" });
        repeat += 33;
      }
    } else if (now === graphics) port.advanceGraphics();
    else if (now === tick) {
      ticks++;
      port.advanceTick();
    } else {
      retraces++;
      port.advanceRetrace();
    }
    const current = state(port.memory),
      key = JSON.stringify([current.x, current.y, current.action]);
    if (anchor !== null && key !== last) {
      motion.push({ ms: now - anchor, state: current });
      last = key;
    }
  }
  assert.ok(finished && first, "Unfinished mountain comparison");
  assert.ok(inputs.length > 0, "Zero executed input reads");
  return { first, motion, final: state(port.memory), events, inputs };
}
const actual = run();
// No expected data supplies input events,clock phase or intermediate state.
const first = await artifact(parent.artifacts.first);
const nativeFirst = state(
  new FlightMemory(Buffer.from(first.state.results[1].data, "base64")),
);
const samples = Object.values(
  (await artifact(parent.artifacts.result)).output.samples,
).sort((a, b) => a.index - b.index);
const nativeMotion = samples.filter(
  (s, i) => !i || ["x", "y", "action"].some((k) => s[k] !== samples[i - 1][k]),
);
const project = (s) =>
  Object.fromEntries(Object.keys(actual.first).map((k) => [k, s[k]]));
function compare(result) {
  assert.deepEqual(result.first, nativeFirst, "First-input state diverged");
  assert.deepEqual(
    result.events.map((e) => e.kind),
    ["make", "repeat", "repeat", "repeat", "break"],
    "Unfinished physical event sequence",
  );
  assert.equal(
    result.motion.length,
    manifest.expectedMotionStates,
    "Missing/extra movement transition",
  );
  assert.equal(result.motion.length, 7);
  assert.equal(nativeMotion.length, 7);
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(
      result.motion[i].state,
      project(nativeMotion[i]),
      `Motion state ${i} diverged`,
    );
    if (i) {
      const low = (nativeMotion[i].index - 2) * frameMs,
        high = (nativeMotion[i].index - 1) * frameMs;
      assert.ok(
        result.motion[i].ms >= low - 1e-9 && result.motion[i].ms <= high + 1e-9,
        `Motion ${i} outside native callback bracket;phase is conditional`,
      );
    }
  }
  assert.deepEqual(
    result.final,
    project(samples.at(-1)),
    "Final sampled state diverged",
  );
}
compare(actual);
const changed = structuredClone(actual);
changed.first.seed ^= 1;
assert.throws(() => compare(changed), /First-input state diverged/);
const delayed = structuredClone(actual);
delayed.motion[1].ms += 2 * frameMs;
assert.throws(() => compare(delayed), /outside native callback bracket/);
const missing = structuredClone(actual);
missing.motion.pop();
assert.throws(() => compare(missing), /movement transition/);
assert.throws(
  () => compare(run({ omitMake: true })),
  /event sequence|transition|diverged/,
);
assert.throws(
  () => compare(run({ omitRelease: true })),
  /event sequence|transition|diverged/,
);
console.log(
  JSON.stringify(
    {
      kind: manifest.kind,
      portTimingAcceptance: false,
      initial,
      environment: manifest.clock,
      exact: { firstInput: true, motionStates: 7, final: true, negatives: 5 },
      consumedReads: actual.inputs.length,
      events: actual.events,
      timing: actual.motion
        .slice(1)
        .map((m, i) => ({
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
