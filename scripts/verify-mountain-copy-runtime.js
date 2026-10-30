// Current closed-loop component route,not native full-ascent/timing acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { parseArchive } from "../src/assets.js";
import { Mountain } from "../src/game/mountain.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { egaSignedCopyWork } from "./lib/ega-signed-copy-work.js";
import {
  renderMountainPixels,
  createMountainRasterCache,
} from "../src/game/mountain-scene.js";
import { verifyMountainMovement } from "./verify-mountain-movement.js";
// Exact production copies of the independently source-pinned/proven models.
for (const [production, proof] of [
  ["src/game/ega-copy-work.js", "scripts/lib/ega-signed-copy-work.js"],
  ["src/game/mountain-erase.js", "scripts/lib/mountain-erase.js"],
])
  assert.deepEqual(
    await readFile(production),
    await readFile(proof),
    "Runtime differs from native-checked model",
  );
execFileSync(process.execPath, ["scripts/verify-mountain-copy-work.js"], {
  stdio: "pipe",
});
// Exercise the actual production erase/charge adapter at every native input.
const native = JSON.parse(await readFile("reference/mountain-erase-work.json"));
const nativeInputs = JSON.parse(await readFile(native.artifacts.inputs.path));
const cap = JSON.parse(await readFile(native.artifacts.capture.path));
for (let i = 0; i < 34; i++) {
  const event = nativeInputs.cases[i];
  const before = JSON.parse(await readFile(event.initial.path));
  const bytes = Buffer.from(before.state.results[1].data, "base64");
  for (const [at, width, value] of event.patches)
    if (width === 1) bytes[at] = value & 255;
    else bytes.writeUInt16LE(value & 65535, at);
  bytes.writeUInt16LE(0xf100, 0x1fec);
  bytes.writeUInt16LE(cap.codeSegment, 0x1fee);
  bytes.writeUInt16LE(0, 0x295c);
  const g = Object.create(Mountain.prototype);
  g.memory = new FlightMemory(bytes);
  g.locals = {
    b: (at) => {
      assert.equal(at, -0x34);
      return event.firstRow;
    },
  };
  g.pendingCopyWork = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    calls: 0,
  };
  g.eraseEffects();
  const r = JSON.parse(
    await readFile(native.artifacts["case-" + String(i).padStart(2, "0")].path),
  );
  const expected = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
    calls: r.copies.length,
  };
  for (const args of r.copies) {
    const s = args.map((v) => (v << 16) >> 16);
    const cost = egaSignedCopyWork({
      height: s[0],
      width: s[1],
      destinationY: s[2],
      destinationX: s[3],
      sourceY: s[5],
      sourceX: s[6],
      sourceStrideBytes: 40,
      destinationStrideBytes: 40,
      sourceVideo: false,
      destinationVideo: true,
    });
    for (const k of Object.keys(cost)) expected[k] += cost[k];
  }
  assert.deepEqual(
    g.pendingCopyWork,
    expected,
    "Production copy charging case" + i,
  );
  const actualDS = Buffer.from(g.memory.bytes.subarray(0, 65535));
  const expectedDS = Buffer.from(r.after.results[0].data, "base64");
  actualDS.fill(0, 0xfeb0, 0xfef0);
  expectedDS.fill(0, 0xfeb0, 0xfef0);
  assert.deepEqual(actualDS, expectedDS, "Production erase effects case" + i);
}
const { image } = await originalGame(),
  entries = parseArchive(await readFile("game/MT.ARC")),
  mainEntries = parseArchive(await readFile("game/MAIN.ARC"));
const resources = { image, entries, mainEntries };
await verifyMountainMovement(resources);
const manifest = JSON.parse(await readFile("reference/mountain-ascent.json"));
function replay({
  omitCopy = false,
  omitFire = false,
  omitCheckpoint = false,
} = {}) {
  const checks = structuredClone(manifest.checkpoints);
  if (omitCheckpoint) checks.splice(1, 1);
  assert.equal(checks.length, 26, "Missing ascent checkpoint");
  const stream = manifest.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  );
  assert.equal(stream.length, 764);
  const g = new Mountain({ ...resources, ...manifest.initial });
  if (omitCopy) g.chargeCopy = () => {};
  const cache = createMountainRasterCache();
  let checked = 0,
    shown = -1,
    rendered = 0,
    copyFrames = 0,
    totalCopies = 0;
  for (let step = 0; step < 20000 && !g.outcome; step++) {
    const index = g.inputs.length,
      byte = stream[index] ?? 0;
    g.setControls({
      fire: !omitFire && Boolean(byte & 0xc0),
      direction:
        { 1: "up", 3: "right", 5: "down", 7: "left" }[byte & 63] ?? null,
    });
    g.advanceTick();
    g.advanceRetrace();
    assert.ok(g.inputs.length - index <= 1, "Skipped input consumption");
    if (g.inputs.length > index) {
      assert.ok(index < stream.length, "Unplanned input consumption");
      assert.equal(g.inputs.at(-1).input, omitFire ? byte & 63 : byte);
      const expected = checks[checked];
      if (expected?.inputCount === g.inputs.length) {
        const actual = g.snapshot();
        for (const [k, v] of Object.entries(expected))
          if (k !== "inputCount")
            assert.deepEqual(
              actual[k],
              v,
              "Ascent checkpoint " + checked + " " + k,
            );
        checked++;
      }
    }
    if (g.current && g.presentations !== shown) {
      assert.ok(
        shown === -1 || g.presentations === shown + 1,
        "Skipped presentation",
      );
      renderMountainPixels(
        g.current,
        g.entries,
        mainEntries[42].data,
        g.memory,
        cache,
      );
      shown = g.presentations;
      rendered++;
      const w = g.lastDrawingWork;
      assert.ok(w.instructions >= g.lastSpriteWork.instructions);
      assert.equal(
        w.instructions,
        g.lastSpriteWork.instructions + w.copyInstructions,
      );
      if (w.copyCalls) {
        copyFrames++;
        totalCopies += w.copyCalls;
        assert.ok(w.copyInstructions > 0 && w.repeatOpcodes > 0);
      }
    }
  }
  assert.equal(g.inputs.length, 764, "Unfinished ascent inputs");
  assert.equal(checked, 26, "Skipped ascent checkpoints");
  assert.equal(rendered, 870, "Ascent presentation count");
  assert.ok(copyFrames > 0 && totalCopies > 0, "Missing restoration work");
  const { tick, spriteWork, drawingWork, ...actual } = g.snapshot();
  const { tick: historicalTick, ...expected } = manifest.expectedFinal;
  assert.equal(historicalTick, 870);
  assert.deepEqual(actual, expected, "Ascent final gameplay");
  assert.equal(g.outcome.code, 1);
  assert.equal(actual.lives, 3);
  return {
    checked,
    rendered,
    copyFrames,
    totalCopies,
    tick,
    spriteWork,
    drawingWork,
  };
}
const result = replay();
assert.throws(() => replay({ omitCopy: true }), /Missing restoration work/);
assert.throws(() => replay({ omitFire: true }), /Ascent checkpoint/);
assert.throws(
  () => replay({ omitCheckpoint: true }),
  /Missing ascent checkpoint/,
);
console.log(
  JSON.stringify(
    {
      scope:
        "Closed-loop static ascent regression plus15 conditional native movement checkpoints;not whole-ascent native timing or browser acceptance",
      inputs: 764,
      nativeEraseCases: 34,
      negativeControls: 3,
      ...result,
    },
    null,
    2,
  ),
);
