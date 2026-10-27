import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Mountain } from "../src/game/mountain.js";
import {
  renderMountainPixels,
  createMountainRasterCache,
} from "../src/game/mountain-scene.js";

export async function verifyMountainAscent(resources) {
  const manifest = JSON.parse(
    await readFile("reference/mountain-ascent.json", "utf8"),
  );
  assert.equal(manifest.expectedInputCount, 764);
  assert.equal(manifest.expectedCheckpointCount, 26);
  assert.equal(manifest.expectedPresentationCount, 870);
  const stream = manifest.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  );
  assert.equal(stream.length, 764);
  function compare({
    omitFire = false,
    alterMoney = false,
    omitCheckpoint = false,
  } = {}) {
    const checks = structuredClone(manifest.checkpoints);
    if (omitCheckpoint) checks.splice(10, 1);
    assert.equal(checks.length, 26, "missing checkpoint");
    if (alterMoney) checks.at(-1).money++;
    const g = new Mountain({ ...resources, ...manifest.initial }),
      cache = createMountainRasterCache();
    let executed = 0,
      rendered = 0,
      presentation = -1;
    for (let step = 0; step < 2000 && !g.outcome; step++) {
      const index = g.inputs.length;
      const byte = stream[index] ?? 0;
      g.setControls({
        fire: !omitFire && Boolean(byte & 0xc0),
        direction:
          { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
      });
      g.advanceTick();
      g.advanceRetrace();
      assert.ok(g.inputs.length - index <= 1, "missed consumption boundary");
      if (g.inputs.length > index) {
        assert.ok(index < stream.length, "unplanned input consumption");
        assert.equal(g.inputs.at(-1).input, omitFire ? byte & 63 : byte);
        const expected = checks[executed];
        if (expected?.inputCount === g.inputs.length) {
          const actual = g.snapshot();
          for (const [k, v] of Object.entries(expected))
            if (k !== "inputCount")
              assert.deepEqual(actual[k], v, `checkpoint${executed} ${k}`);
          executed++;
        }
      }
      if (g.current && g.presentations !== presentation) {
        renderMountainPixels(
          g.current,
          g.entries,
          resources.mainEntries[42].data,
          g.memory,
          cache,
        );
        presentation = g.presentations;
        rendered++;
      }
    }
    assert.equal(g.inputs.length, 764, "unfinished input stream");
    assert.equal(executed, 26, "skipped checkpoint");
    assert.equal(rendered, 870, "presentation count");
    assert.deepEqual(
      g.snapshot(),
      manifest.expectedFinal,
      "summit final state",
    );
    assert.equal(g.outcome.code, 1);
    return { executed, rendered };
  }
  const result = compare();
  assert.throws(() => compare({ omitFire: true }), /checkpoint/);
  assert.throws(() => compare({ alterMoney: true }), /money/);
  assert.throws(() => compare({ omitCheckpoint: true }), /missing checkpoint/);
  console.log(
    `Mountain ascent: ${result.executed} independent closed-loop checkpoints,764 consumed inputs,${result.rendered} rendered presentations; summit with3 lives; 3 negative controls. Expected values are port regression data, not original ascent captures.`,
  );
}
