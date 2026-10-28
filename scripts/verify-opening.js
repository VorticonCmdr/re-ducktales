// Exact original pixels and deterministic state; no native CPU/IRQ timing claim.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { Opening } from "../src/game/opening.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import { unpackImage } from "../src/game/executable.js";
import { parseArchive } from "../src/assets.js";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const manifest = await json("reference/opening.json");
const build = await json("reference/build.json");
async function required(path) {
  return readFile(path).catch(() => {
    throw Error(`SETUP: missing ${path}; see docs/opening-investigation.md`);
  });
}
for (const a of manifest.artifacts) {
  const b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${a.path}`);
  assert.equal(hash(b), a.sha256, `Corrupt ${a.path}`);
}
assert.equal(manifest.artifacts.length, manifest.expectedArtifactCount);
assert.ok(manifest.expectedArtifactCount > 60);
for (const [p, h] of Object.entries(manifest.toolRevisions))
  assert.equal(hash(await required(p)), h, `Changed capture/check tool ${p}`);
const originals = {};
for (const name of ["DUCKTALE.EXE", "MAIN.ARC", "IT.DRV"]) {
  const b = await required(`game/${name}`);
  assert.equal(b.length, build.files[name].bytes);
  assert.equal(hash(b), build.files[name].sha256);
  originals[name] = b;
}
const image = unpackImage(originals["DUCKTALE.EXE"]),
  entries = parseArchive(originals["MAIN.ARC"]);
// Fresh launch correspondence, independent of the historical source-only stop.
const exe = originals["DUCKTALE.EXE"],
  loaded = Buffer.from(image);
let relocation = exe.readUInt16LE(8) * 16 + exe.readUInt16LE(22) * 16 + 0x125;
for (let region = 0; region < 16; region++) {
  const count = exe.readUInt16LE(relocation);
  relocation += 2;
  for (let i = 0; i < count; i++) {
    const at = exe.readUInt16LE(relocation) + region * 0x10000;
    relocation += 2;
    loaded.writeUInt16LE(
      (loaded.readUInt16LE(at) + manifest.emulator.loadBias) & 65535,
      at,
    );
  }
}
assert.equal(
  relocation,
  (exe.readUInt16LE(4) - 1) * 512 + (exe.readUInt16LE(2) || 512),
);
const captureJson = await json(`${manifest.artifactRoot}/natural-code.json`);
assert.equal(captureJson.isError, false);
assert.equal(captureJson.content.length, 1);
const naturalCode = JSON.parse(captureJson.content[0].text);
const fireEntry = await json(`${manifest.artifactRoot}/fire-entry.json`);
const storyEntry = await json(`${manifest.artifactRoot}/story-skip-entry.json`);
for (const code of [naturalCode, fireEntry.code, storyEntry.launch.code]) {
  assert.equal(code.addr, manifest.emulator.loadBias * 16 + 15577);
  assert.equal(code.bytes.length, 101);
  assert.deepEqual(
    Buffer.from(code.bytes),
    loaded.subarray(15577, 15678),
    "Fresh launch code mapping",
  );
}
const inputs = await json("reference/opening-inputs.json");
assert.equal(inputs.version, 1);
assert.equal(inputs.cases.length, 3);
assert.equal(manifest.cases.length, 3);
const root = manifest.artifactRoot;
const native = async (name) => json(`${root}/${name}.json`);
const word = (record, at = 8) =>
  record.timer.bytes[at] | (record.timer.bytes[at + 1] << 8);
const exact = (actual, expected, label) =>
  assert.deepEqual(Buffer.from(actual), Buffer.from(expected), label);
let pixels = 0,
  states = 0,
  events = 0;
for (const spec of inputs.cases) {
  const expected = manifest.cases.find((c) => c.id === spec.id);
  assert.ok(expected);
  assert.ok(Number.isInteger(spec.inputCount) && spec.inputCount > 0);
  let reads = 0,
    consumed = 0;
  const schedule = new Map();
  for (const e of spec.events) {
    assert.ok(
      Number.isInteger(e.read) && e.read > 0 && e.read <= spec.inputCount,
    );
    assert.ok(Number.isInteger(e.byte) && e.byte >= 0 && e.byte <= 255);
    assert.ok(!schedule.has(e.read));
    schedule.set(e.read, e.byte);
  }
  const opening = new Opening({
    image,
    entries,
    seed: spec.initialSeed,
    audioEnabled: true,
    readInput: () => {
      assert.ok(++reads <= spec.inputCount, "Unexpected input read");
      if (schedule.has(reads)) {
        consumed++;
        return schedule.get(reads);
      }
      return 0;
    },
  });
  for (let t = 0; t < 5000 && !opening.outcome; t++) {
    opening.advanceTick();
    opening.advanceRetrace();
  }
  assert.ok(opening.outcome, "Unfinished opening");
  assert.equal(reads, spec.inputCount, "Unfinished input sequence");
  assert.equal(consumed, spec.events.length, "Unconsumed required events");
  assert.deepEqual(opening.outcome, expected.outcome);
  assert.equal(opening.presentations, expected.presentations);
  assert.equal(opening.boundaries.length, expected.boundaries);
  const effects = opening.drainEvents().map((e) => {
    assert.equal(e.type, "sound");
    return e.id;
  });
  assert.deepEqual(effects, expected.sounds);
  const final = await native(expected.exit);
  assert.equal(word(final), opening.seed);
  assert.equal(
    (spec.id === "natural" ? final.flags : final.skip).bytes[0],
    Number(opening.skipRequested),
  );
  assert.equal(final.enabled.bytes[0], 0);
  assert.equal(final.stop.registers.cs, 0x4ea);
  assert.equal(final.stop.registers.eip, 0xaeb);
  assert.equal(final.stop.protected_mode, false);
  assert.equal(opening.skipEnabled, false);
  states++;
  for (const checkpoint of expected.checkpoints) {
    let commands, boundary;
    if (checkpoint.kind === "exit") commands = opening.current;
    else {
      const matches = opening.boundaries.filter(
        (b) =>
          b.kind === checkpoint.kind &&
          Object.entries(checkpoint.match).every(([k, v]) => b[k] === v),
      );
      assert.equal(
        matches.length,
        1,
        `Missing/duplicate ${checkpoint.artifact}`,
      );
      boundary = matches[0];
      commands = boundary.commands;
    }
    const record = await native(checkpoint.artifact);
    if (boundary) {
      assert.equal(boundary.seed, word(record), `RNG ${checkpoint.artifact}`);
      if (record.skip)
        assert.equal(Number(boundary.skip), record.skip.bytes[0]);
      else {
        assert.equal(checkpoint.artifact, "story-skip-before");
        assert.equal(record.keys.bytes.length, 128);
        assert.ok(record.keys.bytes.every((b) => b === 0));
        assert.equal(boundary.skip, false);
      }
    }
    const png = PNG.sync.read(
      await required(`${root}/${checkpoint.artifact}.png`),
    );
    assert.equal(png.width, 320);
    assert.equal(png.height, 200);
    exact(
      renderFlightPixels(commands, entries, entries[42].data, "MAIN.ARC"),
      png.data,
      `Pixels ${checkpoint.artifact}`,
    );
    pixels++;
    if (checkpoint.kind === "reveal") {
      assert.equal(record.inset.words[0], boundary.inset);
      if (record.inputStop)
        assert.equal(
          record.inputStop.registers.eax & 255,
          opening.inputs[3 + (80 - boundary.inset) / 8].byte,
        );
    }
  }
  if (spec.id === "dialogue-fire") {
    assert.equal(final.inputStops.length, 1);
    assert.equal(final.inputStops[0].registers.eax & 255, 192);
    assert.equal(final.audio.length, 6);
    assert.deepEqual(
      final.audio.map((a) => a.stack.words[2]),
      effects.slice(1),
    );
    assert.equal(final.replay.remaining, 0);
    assert.equal(final.replay.dispatched, 2);
    events += 6;
  }
  if (spec.id === "reveal-fire") {
    assert.equal(final.postInput.registers.eax & 255, 0);
    assert.equal(final.replay.remaining, 0);
    assert.equal(final.replay.dispatched, 2);
  }
}
assert.equal(pixels, manifest.expectedPixelCheckpoints);
assert.equal(states, 3);
assert.equal(events, 6);
// Negative controls exercise the same comparison and skip-latch mechanism.
const pixel = PNG.sync.read(await required(`${root}/natural-01.png`)).data;
const altered = Buffer.from(pixel);
altered[0] ^= 1;
assert.throws(
  () => exact(altered, pixel, "pixel negative control"),
  /pixel negative control/,
);
const missing = new Opening({ image, entries, seed: 8274, readInput: () => 0 });
for (let t = 0; t < 5000 && !missing.outcome; t++) {
  missing.advanceTick();
  missing.advanceRetrace();
}
assert.throws(
  () =>
    assert.equal(
      missing.boundaries.filter((b) => b.kind === "reveal")[1].skip,
      true,
    ),
  assert.AssertionError,
);
assert.throws(() => assert.equal(missing.seed, 8274), assert.AssertionError);
assert.throws(
  () => assert.equal(pixels - 1, manifest.expectedPixelCheckpoints),
  assert.AssertionError,
);
console.log(
  `Opening: ${states} closed-loop cases, ${pixels} exact original PNGs, ${events} native sound cleanup calls; missing-fire, RNG, pixel and omitted-checkpoint controls rejected. Native CPU/IRQ/waveform timing unverified.`,
);
