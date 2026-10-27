import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { TandyTones } from "../src/tandy-preview.js";
import inputs from "../reference/tandy-psg-inputs.json" with { type: "json" };
import manifest from "../reference/tandy-psg.json" with { type: "json" };

const hash = (b) => createHash("sha256").update(b).digest("hex");
for (const [path, checksum] of [
  [manifest.inputs, manifest.inputsSHA256],
  [manifest.probe, manifest.probeSHA256],
  ["scripts/capture-tandy-psg.py", manifest.captureToolSHA256],
])
  assert.equal(hash(await readFile(path)), checksum, `SETUP: changed ${path}`);
const bytes = await readFile(manifest.artifact.path).catch(() => {
  throw Error(
    `SETUP: missing ${manifest.artifact.path}; see docs/tandy-audio.md`,
  );
});
assert.equal(
  hash(bytes),
  manifest.artifact.sha256,
  "SETUP: corrupt chip evidence",
);
const captured = JSON.parse(bytes);
assert.equal(manifest.cases, 15);
assert.equal(manifest.checkpoints, 625);
assert.deepEqual(inputs.environment, {
  periods: [1, 1, 1],
  counters: [1, 1, 1],
  outputs: [1, 1, 1],
  noise: { control: 0, counter: 1, output: 0, lfsr: 32768 },
});
function verify(expected, stream = inputs.cases) {
  assert.equal(expected.length, 15, "missing chip cases");
  assert.equal(stream.length, 15, "unconsumed chip inputs");
  let checkpoints = 0,
    events = 0;
  for (let i = 0; i < stream.length; i++) {
    const c = stream[i],
      e = expected[i];
    assert.equal(e.name, c.name);
    assert.equal(
      e.states.length,
      c.events.length + 1,
      "unfinished event stream",
    );
    const chip = new TandyTones(structuredClone(inputs.environment));
    assert.deepEqual(
      chip.digitalState(),
      e.states[0],
      `${c.name}: initial state`,
    );
    checkpoints++;
    for (let j = 0; j < c.events.length; j++) {
      const [op, value] = c.events[j];
      if (op === "write") chip.write(value);
      else {
        assert.equal(op, "clock", "unsupported event");
        chip.advanceClocks(value);
      }
      assert.deepEqual(
        chip.digitalState(),
        e.states[j + 1],
        `${c.name}: native digital state ${j + 1}`,
      );
      checkpoints++;
      events++;
    }
  }
  assert.equal(events, 610, "unconsumed required events");
  assert.equal(checkpoints, 625, "skipped checkpoints");
}
verify(captured);
assert.throws(() => verify(captured.slice(1)), /missing chip cases/);
const changed = structuredClone(captured);
changed[4].states[2].lfsr ^= 1;
assert.throws(() => verify(changed), /native digital state/);
const removed = structuredClone(inputs.cases);
removed[2].events.pop();
assert.throws(() => verify(captured, removed), /unfinished event stream/);
const altered = structuredClone(inputs.cases);
altered[4].events[2][1] ^= 4;
assert.throws(() => verify(captured, altered), /native digital state/);
console.log(
  "Tandy PSG: 15 external NCR8496 cases /625 exact digital checkpoints;610 consumed events;4 negative controls. Digital chip model only, not original-game or waveform parity.",
);
