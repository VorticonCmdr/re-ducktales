// Conditional real browser I/O evidence,not native acoustic/timing comparison.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json,
  sha,
  checkArtifacts,
  checkSource,
} from "./lib/local-scenario-source.js";
import { acceptedRuntimeSource } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/result-audio-boundary.json");
assert.equal(m.cases, 2);
assert.deepEqual(m.devices, ["speaker", "tandy"]);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
const root = m.artifacts["speaker.json"].path.replace(/\/speaker.json$/, "");
assert.equal(
  (await checkSource(root, acceptedRuntimeSource)).commit,
  m.sourceCommit,
);
for (const device of m.devices) {
  const p = await json(m.artifacts[device + ".json"].path);
  assert.equal(p.device, device);
  assert.equal(p.restart, true);
  assert.equal(p.stats.device, device);
  assert.equal(p.stats.contextState, "running");
  assert.ok(Number(p.stats.signalSamples) > 0);
  const acks = p.events.filter((e) => e.type === "ack");
  assert.deepEqual(
    acks.slice(0, 4).map((e) => e.argument),
    [0, 0x24, 0x54, 0x24],
  );
  assert.equal(acks.filter((e) => e.argument === 0x24).length, 2);
  for (let i = 1; i < acks.length; i++)
    assert.equal(acks[i].sequence, acks[i - 1].sequence + 1);
  assert.ok(Number(p.stats.lastAcknowledged) >= acks[3].sequence);
  const unlock = p.notes.find((n) => n.name === "unlock").state;
  assert.equal(unlock.expeditionResult.phase, "atomic");
  assert.equal(unlock.campaign.atomicAvailable, true);
}
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.audioStatusInjections, []);
assert.deepEqual(m.fittedInputs, []);
console.log(
  "Result audio boundary:PC speaker and Tandy acknowledge0,0x24,0x54,0x24 with nonzero processor output and Restart;conditional device-I/O evidence,not native waveform/timing parity.",
);
