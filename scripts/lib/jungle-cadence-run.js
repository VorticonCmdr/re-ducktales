// Shared conditional movement runner. Inputs and clocks are independent of expected outcomes.
import assert from "node:assert/strict";
import { Jungle } from "../../src/game/jungle.js";
import { FlightMemory } from "../../src/game/flight-physics.js";
import { OrdinaryKeyboard } from "../../src/game/ordinary-keyboard.js";
import { DRIVER_HZ, RETRACE_HZ } from "../../src/game/timing.js";
export const jungleCadenceState = (m) => ({
  x: (m.i(0x5f46) & 65535),
  y: (m.i(0x6858) & 65535),
  action: (m.i(0x6882) & 65535),
  actorFrame: (m.i(0x88ae) & 65535),
  lostLives: (m.i(0x5cfc) & 65535),
  column: (m.i(0x544c) & 65535),
  row: (m.i(0x5462) & 65535),
  scroll: (m.i(0x5ed2) & 65535),
  seed: m.i(0x2229) & 65535,
});
const state=jungleCadenceState;
export function runJungleCadence({ entryBytes, contract, resources, provider, scans = [0x4d], omitRepeat = false, omitRelease = false, retraceHz = RETRACE_HZ }) {
  assert.ok(Number.isFinite(retraceHz) && retraceHz > 0);
  const frameMs = 1000 / retraceHz;
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
        for (const scan of scans) keyboard.event(scan, true);
        events.push({ ms: now - anchor, kind: "make", scans: [...scans] });
        repeat = omitRepeat
          ? Infinity
          : now + provider.initialRepeatMilliseconds;
      } else if (now === releaseAt) {
        released = true;
        if (!omitRelease) {
          for (const scan of scans) keyboard.event(scan, false);
          events.push({ ms: now - anchor, kind: "break", scans: [...scans] });
        } else repeat = Infinity;
      } else {
        keyboard.event(scans.at(-1), true);
        events.push({ ms: now - anchor, kind: "repeat", scans: [scans.at(-1)] });
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
