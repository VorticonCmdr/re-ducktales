import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { runLiveCase } from "./tandy-live-runner.js";
import input from "../reference/tandy-live-inputs.json" with { type: "json" };
import manifest from "../reference/tandy-live.json" with { type: "json" };
import build from "../reference/build.json" with { type: "json" };
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  sha(await readFile("reference/tandy-live-inputs.json")),
  manifest.inputsSHA256,
);
assert.deepEqual(input.environment, {
  sampleRate: 44100,
  port61: 0,
  firstInterruptFrame: 0,
  sequencerDivider: 1,
  virtualClock: 0,
  biosFlags: 0,
  chipInitialPeriods: [1, 1, 1],
  chipInitialCounters: [1, 1, 1],
  chipInitialOutputs: [1, 1, 1],
  chipInitialNoise: { control: 0, counter: 1, output: 0, lfsr: 32768 },
});
const archive = await readFile("game/IT.DRV").catch(() => {
  throw Error("SETUP: missing game/IT.DRV");
});
assert.equal(sha(archive), build.files["IT.DRV"].sha256);
assert.equal(
  sha(await readFile("game/DUCKTALE.EXE")),
  build.files["DUCKTALE.EXE"].sha256,
);
const bytes = parseArchive(archive, "IT.DRV")[4].data;
function compare(expected, stream = input.cases) {
  assert.deepEqual(
    stream.map((c) => c.sound),
    [1, 6, 9, 13, 30, 31, 38, 57, 95, 111],
    "missing live inputs",
  );
  assert.equal(expected.length, 10, "missing live cases");
  let events = 0,
    checkpoints = 0,
    natural = 0;
  for (let i = 0; i < stream.length; i++) {
    const actual = runLiveCase(bytes, stream[i], input.environment.sampleRate);
    assert.deepEqual(
      actual,
      expected[i],
      `live provider result ${stream[i].sound}`,
    );
    events += actual.events;
    checkpoints += actual.checkpoints.length;
    natural += actual.ending === "natural" ? 1 : 0;
  }
  assert.deepEqual(
    { events, checkpoints, natural },
    { events: 21, checkpoints: 31, natural: 2 },
  );
}
compare(manifest.cases);
assert.deepEqual(manifest.counts, {
  cases: 10,
  events: 21,
  checkpoints: 31,
  natural: 2,
  requestedStop: 8,
});
assert.throws(() => compare(manifest.cases.slice(1)), /missing live cases/);
const wrong = structuredClone(manifest.cases);
wrong[0].checkpoints[1].pcmSHA256 = "0".repeat(64);
assert.throws(() => compare(wrong), /live provider result/);
const missing = structuredClone(input.cases);
missing[2].events.splice(1, 1);
assert.throws(() => compare(manifest.cases, missing), /live provider result/);
const changed = structuredClone(input.cases);
changed[2].events[1].argument ^= 0x0100;
assert.throws(() => compare(manifest.cases, changed), /live provider result/);
const unfinished = structuredClone(input.cases);
unfinished[0].events.push({ frame: 120 * 44100 - 1, argument: 0 });
assert.throws(
  () => compare(manifest.cases, unfinished),
  /unconsumed required input events/,
);
console.log(
  "Tandy live:10 independent provider routes,21 consumed inputs,31 exact port-regression checkpoints;two natural music endings,eight requested stops;5 negative controls. Not an original whole-engine/waveform comparison.",
);
