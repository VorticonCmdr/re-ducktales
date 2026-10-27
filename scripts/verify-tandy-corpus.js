import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { renderTandyPreview } from "../src/tandy-preview.js";
import manifest from "../reference/tandy-corpus.json" with { type: "json" };
import build from "../reference/build.json" with { type: "json" };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const archive = await readFile("game/IT.DRV").catch(() => {
  throw Error("SETUP: missing game/IT.DRV");
});
assert.equal(hash(archive), build.files["IT.DRV"].sha256);
const driver = parseArchive(archive, "IT.DRV")[4].data;
assert.deepEqual(manifest.environment, {
  sampleRate: 44100,
  resetPort61: 0,
  firstTickTime: 0,
  initialPeriods: [1, 1, 1],
  initialCounters: [1, 1, 1],
  initialOutputs: [1, 1, 1],
  chipVariant: "NCR8496",
  initialNoise: { control: 0, counter: 1, output: 0, lfsr: 32768 },
  centeredOutputNegated: true,
  firstInterruptFrame: 0,
  initialSequencerDivider: 1,
  virtualClock: 0,
  biosFlags: 0,
});
function run(id) {
  let r;
  try {
    r = renderTandyPreview(driver, id, {
      sampleRate: manifest.environment.sampleRate,
    });
  } catch (error) {
    return {
      id,
      status: error.code === "TANDY_PREVIEW_LIMIT" ? "live" : "unsupported",
      diagnostic: error.message,
    };
  }
  assert.equal(r.truncated, false, "unfinished audition");
  assert.ok(r.ticks > 0);
  assert.equal(r.biosFlags.length, r.ticks);
  assert.ok(r.pcm.every(Number.isFinite));
  assert.equal(r.duration, r.pcm.length / r.sampleRate);
  assert.equal(r.approximate, true);
  return {
    id,
    status: "complete",
    ticks: r.ticks,
    samples: r.pcm.length,
    busWrites: r.bus.length,
    pcmSHA256: hash(
      new Uint8Array(r.pcm.buffer, r.pcm.byteOffset, r.pcm.byteLength),
    ),
    silent: !r.pcm.some((v) => v !== 0),
  };
}
const actual = Array.from({ length: 121 }, (_, i) => run(i));
function compare(expected) {
  assert.equal(expected.length, 121, "missing corpus requests");
  for (let i = 0; i < 121; i++) {
    assert.equal(expected[i].id, i, "unconsumed corpus input");
    assert.deepEqual(actual[i], expected[i], `Tandy corpus result ${i}`);
  }
}
compare(manifest.cases);
const counts = {
  requests: 121,
  complete: actual.filter((c) => c.status === "complete").length,
  audible: actual.filter((c) => c.status === "complete" && !c.silent).length,
  unsupported: actual.filter((c) => c.status === "unsupported").length,
  silent: actual.filter((c) => c.status === "complete" && c.silent).length,
  live: actual.filter((c) => c.status === "live").length,
};
assert.deepEqual(counts, {
  requests: 121,
  complete: 111,
  audible: 88,
  unsupported: 0,
  live: 10,
  silent: 23,
});
assert.deepEqual(manifest.counts, counts);
assert.throws(
  () => compare(manifest.cases.slice(1)),
  /missing corpus requests/,
);
const changed = structuredClone(manifest.cases);
changed[25].pcmSHA256 = "0".repeat(64);
assert.throws(() => compare(changed), /Tandy corpus result 25/);
const unsupported = structuredClone(manifest.cases);
unsupported[9].diagnostic = "ignored";
assert.throws(() => compare(unsupported), /Tandy corpus result 9/);
console.log(
  "Tandy corpus: 121 independently initialized requests; 111 file previews (88 audible,23 silent),10 require live playback,0 unsupported; 3 negative controls. Port regression only, not full original runtime/waveform parity.",
);
