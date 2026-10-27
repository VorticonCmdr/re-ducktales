import "./verify-mountain-terrain.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import build from "../reference/build.json" with { type: "json" };
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Mountain } from "../src/game/mountain.js";
import {
  renderMountainPixels,
  createMountainRasterCache,
} from "../src/game/mountain-scene.js";
import { verifyMountainPalette } from "./verify-mountain-palette.js";
import { verifyMountainOriginal } from "./verify-mountain-original.js";
import { verifyMountainMovement } from "./verify-mountain-movement.js";
import { verifyMountainAscent } from "./verify-mountain-ascent.js";

const manifest = JSON.parse(
  await readFile("reference/mountain-controls.json", "utf8"),
);
const resources = {};
for (const name of ["DUCKTALE.EXE", "MT.ARC", "MAIN.ARC", "IT.DRV"]) {
  const bytes = await readFile(`game/${name}`).catch(() => {
    throw Error(`SETUP: missing game/${name}`);
  });
  assert.equal(bytes.length, build.files[name].bytes, `${name}: byte length`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    build.files[name].sha256,
    `${name}: hash`,
  );
  resources[name] = bytes;
}
const image = unpackImage(resources["DUCKTALE.EXE"]),
  entries = parseArchive(resources["MT.ARC"]),
  mainEntries = parseArchive(resources["MAIN.ARC"]);
function compare({
  omitFire = false,
  alterAward = false,
  omitCheckpoint = false,
} = {}) {
  assert.equal(manifest.expectedInputCount, 148);
  assert.equal(manifest.expectedCheckpointCount, 10);
  assert.equal(manifest.checkpoints.length, 10);
  const stream = manifest.inputEvents.flatMap((e) =>
    Array(e.count).fill(omitFire && e.byte === 64 ? 0 : e.byte),
  );
  assert.equal(stream.length, manifest.expectedInputCount);
  const checks = structuredClone(manifest.checkpoints);
  if (alterAward) checks.at(-1).money++;
  if (omitCheckpoint) checks.splice(3, 1);
  assert.equal(
    checks.length,
    manifest.expectedCheckpointCount,
    "missing checkpoint",
  );
  const g = new Mountain({ image, entries, mainEntries, ...manifest.initial });
  const cache = createMountainRasterCache();
  let executed = 0,
    rendered = 0,
    presentation = -1,
    steps = 0;
  while (g.inputs.length < stream.length && !g.outcome && steps++ < 1000) {
    const index = g.inputs.length,
      byte = stream[index];
    g.setControls({
      fire: Boolean(byte & 0xc0),
      direction:
        { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 0x3f] ?? null,
    });
    g.advanceTick();
    g.advanceRetrace();
    assert.ok(
      g.inputs.length - index <= 1,
      "input provider missed a consumption boundary",
    );
    if (g.inputs.length > index) {
      assert.equal(g.inputs.at(-1).input, byte, "input consumption divergence");
      const expected = checks[executed];
      if (expected?.inputCount === g.inputs.length) {
        const actual = g.snapshot();
        for (const [k, value] of Object.entries(expected))
          if (k !== "inputCount")
            assert.equal(actual[k], value, `checkpoint${executed}: ${k}`);
        assert.equal(actual.lives, 3, "unexpected life loss");
        assert.equal(actual.facing, 0);
        assert.equal(actual.scroll, 0);
        assert.equal(actual.seed, 47948);
        executed++;
      }
    }
    if (g.current && g.presentations !== presentation) {
      renderMountainPixels(
        g.current,
        g.entries,
        mainEntries[42].data,
        g.memory,
        cache,
      );
      presentation = g.presentations;
      rendered++;
    }
  }
  assert.equal(
    g.inputs.length,
    manifest.expectedInputCount,
    "unfinished input stream",
  );
  assert.equal(
    executed,
    manifest.expectedCheckpointCount,
    "skipped checkpoint",
  );
  assert.equal(g.outcome, null, "unexpected expedition outcome");
  assert.equal(manifest.expectedPresentationCount, 149);
  assert.equal(
    rendered,
    manifest.expectedPresentationCount,
    "unexpected presentation count",
  );
  assert.equal(
    g.memory.b(g.memory.i(0x5d26) + 6 + 1),
    3,
    "pickup erasure latch",
  );
  return { executed, rendered };
}
const result = compare();
assert.throws(() => compare({ omitFire: true }), /checkpoint/);
assert.throws(() => compare({ alterAward: true }), /money/);
assert.throws(() => compare({ omitCheckpoint: true }), /missing checkpoint/);
console.log(
  `Mountain controls: ${result.executed} independent closed-loop checkpoints, 148 consumed inputs, ${result.rendered} rendered presentations; 3 negative controls. No original runtime comparison claimed.`,
);
await verifyMountainOriginal({
  image,
  entries,
  mainEntries,
  executableRaw: resources["DUCKTALE.EXE"],
});
await verifyMountainMovement({ image, entries, mainEntries });
await verifyMountainAscent({ image, entries, mainEntries });

await verifyMountainPalette({
  image,
  entries,
  mainEntries,
  driverEntries: parseArchive(resources["IT.DRV"]),
});
