// Conditional component comparison. Native AFTER values never provide inputs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { FlightMemory } from "../src/game/flight-physics.js";
import { jungleComponentResources } from "./jungle-component-replay.js";
import { RETRACE_HZ } from "../src/game/timing.js";
import { jungleCadenceState as state, runJungleCadence } from "./lib/jungle-cadence-run.js";

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
const run = (options = {}) => runJungleCadence({ entryBytes, contract, resources, provider, ...options });
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
