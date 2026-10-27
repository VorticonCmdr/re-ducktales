import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import { nextRandom, u16 } from "../src/game/integer.js";
import {
  selectPhotographyTarget,
  selectPhotographyAnimals,
  initializePhotographyActors,
  spawnPhotographyAnimal,
  positionPhotographyAnimal,
  photographyShutterLimit,
  reactToPhotographyShutter,
  settlePhotographyResults,
  finishPhotographyReturn,
  photographyOccluders,
} from "../src/game/photography-actors.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  await readFile("reference/photography.json", "utf8"),
);
assert.equal(manifest.expectedArtifactCount, 20);
assert.equal(manifest.expectedCaseCount, 8);
assert.equal(manifest.expectedCheckpointCount, 9);
assert.equal(manifest.routineCases.length, 6);
assert.deepEqual(manifest.fittedInputs, []);
assert.equal(manifest.command, "npm run verify:photography");
const artifacts = {};
for (const [key, entry] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(entry.path).catch(() => {
    throw Error(`SETUP: missing ${entry.path}; see docs/photography.md`);
  });
  assert.equal(
    hash(bytes),
    entry.sha256,
    `Corrupt photography artifact ${key}`,
  );
  artifacts[key] = key === "results-png" ? bytes : JSON.parse(bytes);
}
assert.equal(Object.keys(artifacts).length, 20);
function capture(id, cs, ip, count = 2) {
  const raw = artifacts[id];
  assert.equal(raw.isError, false, id);
  const result = JSON.parse(raw.content[0].text);
  assert.equal(result.aborted, false, id);
  assert.equal(result.results.length, count, id);
  assert.ok(
    result.results.every((r) => r.status === "ok"),
    id,
  );
  const cpu = result.results[0].registers;
  assert.deepEqual(
    [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
    [cs, ip, 0x1403, 0x1403],
    id,
  );
  assert.equal(result.results[1].addr, 0x14030, `${id}: fixed game DS`);
  const bytes = Buffer.from(result.results[1].data, "base64");
  assert.equal(bytes.length, 65536, id);
  return { cpu, bytes, results: result.results };
}
function exact(actual, expected, exclusion, id) {
  assert.equal(actual.length, expected.length, id);
  for (let i = 0; i < actual.length; i++) {
    if (exclusion && i >= exclusion[0] && i < exclusion[1]) continue;
    if (actual[i] !== expected[i])
      assert.fail(`${id}: DS${i.toString(16)}: ${actual[i]} != ${expected[i]}`);
  }
}
const entry = capture("entry", 0xe0c, 0, 3);
const executable = await readFile("game/DUCKTALE.EXE");
const build = JSON.parse(await readFile("reference/build.json", "utf8"));
assert.equal(hash(executable), build.files["DUCKTALE.EXE"].sha256);
const source = manifest.source;
assert.deepEqual(
  [
    source.offset,
    source.length,
    source.headerBytes,
    source.bodyBytes,
    source.relocationCount,
    source.originalSegment,
    source.loadBias,
    source.liveSegment,
  ],
  [0x1d800, 8436, 512, 7924, 93, 0xc17, 0x1f5, 0xe0c],
);
const overlay = executable.subarray(
  source.offset,
  source.offset + source.length,
);
assert.equal(hash(overlay), source.sha256);
assert.equal(overlay.readUInt16LE(8) * 16, source.headerBytes);
assert.equal(overlay.readUInt16LE(6), 93);
const originalBody = overlay.subarray(source.headerBytes);
assert.equal(hash(originalBody), source.bodySha256);
const relocated = Buffer.from(originalBody);
for (let i = 0; i < 93; i++) {
  const at = overlay.readUInt16LE(24) + i * 4,
    offset = overlay.readUInt16LE(at),
    segment = overlay.readUInt16LE(at + 2),
    bodyAt = (segment - 0xc17) * 16 + offset;
  assert.ok(bodyAt >= 0 && bodyAt + 2 <= relocated.length);
  relocated.writeUInt16LE(u16(relocated.readUInt16LE(bodyAt) + 0x1f5), bodyAt);
}
const live = Buffer.from(entry.results[2].data, "base64");
exact(live, relocated, null, "complete relocated overlay7");
const corruptCode = Buffer.from(live);
corruptCode[0x1cba] ^= 1;
assert.throws(() => exact(corruptCode, relocated, null, "code negative"));

// Verify the setup injection independently; only these three exact fields move.
const mapBefore = capture("map-before", 0x319, 2),
  mapAfter = capture("map-after", 0x319, 2),
  setup = Buffer.from(mapBefore.bytes);
assert.equal(manifest.injections.length, 3);
for (const patch of manifest.injections) {
  assert.equal(patch.atStop, 333);
  assert.equal(patch.segment, 0x1403);
  assert.deepEqual(
    [...setup.subarray(patch.offset, patch.offset + patch.before.length)],
    patch.before,
  );
  setup.set(patch.after, patch.offset);
}
exact(setup, mapAfter.bytes, null, "explicit map shortcut");
assert.deepEqual(
  mapBefore.cpu,
  mapAfter.cpu,
  "setup did not change CPU registers",
);
assert.deepEqual(
  manifest.inputSchedules.map((s) => s.events.length),
  [6, 4, 2],
);

// Each helper starts from an original internal precondition. These are routine
// comparisons, not replay inputs or a carried-state full expedition replay.
function compare({
  omitCase = false,
  omitRng = false,
  alterFrame = false,
  alterPayout = false,
  losePicture = false,
  omitAll = false,
} = {}) {
  let cases = 0,
    checkpoints = 0;
  if (!omitAll) {
    const target = capture("target", 0xe0c, 0xe3),
      targetMemory = new FlightMemory(entry.bytes),
      variant = targetMemory.view.getUint16(entry.cpu.esp + 4, true);
    assert.equal(variant, 1);
    selectPhotographyTarget(targetMemory, variant);
    assert.equal(targetMemory.i(0x2229), target.bytes.readInt16LE(0x2229));
    assert.equal(targetMemory.i(0x5f48), target.bytes.readInt16LE(0x5f48));
    assert.equal(targetMemory.i(0x5f48), 44);
    cases++;
    checkpoints++;
    for (const c of manifest.routineCases) {
      if (omitCase && c.id === "spawn3") continue;
      const before = capture(c.id + "-before", c.cs, c.beforeIP),
        after = capture(c.id + "-after", c.cs, c.afterIP),
        m = new FlightMemory(before.bytes),
        arg = m.view.getUint16(before.cpu.esp + 4, true);
      assert.equal(c.stackExclusion[1], before.cpu.esp);
      assert.ok(c.stackExclusion[0] >= before.cpu.esp - 30);
      const sounds = [];
      if (c.id === "animals") selectPhotographyAnimals(m, arg);
      else if (c.id.startsWith("spawn")) {
        const seed = u16(m.i(0x2229));
        if (omitRng && c.id === "spawn") m.i(0x2229, nextRandom(seed));
        const accepted = spawnPhotographyAnimal(m, arg, {
          sound: (id) => sounds.push(id),
        });
        assert.equal(accepted, c.accepted, c.id);
        let next = seed;
        for (let draw = 0; draw < c.rngDraws; draw++) next = nextRandom(next);
        assert.equal(u16(m.i(0x2229)), next, `${c.id} RNG count`);
        assert.deepEqual(
          sounds,
          c.accepted && m.b(0x3be) ? [[0x67, 0x69, 0x68][arg]] : [],
        );
      } else if (c.id === "position") {
        const descriptor = m.view.getUint16(before.cpu.esp + 6, true);
        positionPhotographyAnimal(m, arg, descriptor);
        if (alterFrame) m.b(descriptor + 18, m.b(descriptor + 18) ^ 1);
      } else if (c.id === "shutter") {
        assert.ok(
          m.b(arg + 4) < photographyShutterLimit(m, arg),
          "original shot accepted",
        );
        assert.equal(reactToPhotographyShutter(m, arg), after.cpu.eax & 65535);
      } else assert.fail(`Unsupported photography case ${c.id}`);
      exact(m.bytes, after.bytes, c.stackExclusion, c.id);
      cases++;
      checkpoints++;
    }
    const before = capture("results-before", 0xe0c, 0x1094),
      after = capture("results-after", 0xe0c, 0x11b5),
      returned = capture("return", 0xe0c, 0x1225),
      m = new FlightMemory(before.bytes),
      photos = Uint8Array.from(
        before.bytes.subarray(before.cpu.ebp - 100, before.cpu.ebp - 88),
      );
    assert.deepEqual([...photos], [44, 0, 0, 0, 0, 0, 0, 44, 0, 0, 0, 0]);
    if (losePicture) photos[7] = 0;
    const success = settlePhotographyResults(m, photos);
    if (alterPayout)
      m.view.setUint32(0x8cc0, m.view.getUint32(0x8cc0, true) + 50, true);
    for (const at of [0x8cc0, 0x97a8])
      assert.equal(m.view.getUint32(at, true), after.bytes.readUInt32LE(at));
    assert.equal(success, after.bytes.readInt16LE(after.cpu.ebp - 60));
    exact(
      photos,
      after.bytes.subarray(after.cpu.ebp - 100, after.cpu.ebp - 88),
      null,
      "result slots",
    );
    checkpoints++;
    assert.equal(finishPhotographyReturn(m, success), returned.cpu.eax & 65535);
    for (const at of [0x4e0e, 0x5b3c, 0x4e30 + 7 * 8])
      assert.equal(m.b(at), returned.bytes[at]);
    for (const at of [0x8cc0, 0x97a8])
      assert.equal(m.view.getUint32(at, true), returned.bytes.readUInt32LE(at));
    cases++;
    checkpoints++;
  }
  assert.equal(cases, 8, "incomplete photography case set");
  assert.equal(checkpoints, 9, "incomplete photography checkpoints");
}
compare();
for (const mutation of [
  "omitCase",
  "omitRng",
  "alterFrame",
  "alterPayout",
  "losePicture",
  "omitAll",
])
  assert.throws(
    () => compare({ [mutation]: true }),
    `negative control ${mutation}`,
  );

// Static branch boundaries: explicit branches and the default-branch probe0.
// The actual sixth destination,Borneo6,is checked separately below.
const targets = [
  [30, 30, 30, 30, 30, 32, 32, 32, 32, 32, 40, 40, 40, 41, 41, 41],
  [31, 31, 31, 31, 31, 44, 44, 44, 44, 44, 37, 37, 37, 37, 37, 37],
  [30, 30, 31, 31, 37, 37, 35, 35, 40, 40, 43, 43, 34, 34, 34, 34],
  [32, 35, 32, 35, 32, 35, 32, 35, 32, 35, 32, 35, 32, 35, 32, 35],
  [38, 38, 38, 39, 39, 39, 33, 33, 33, 34, 34, 34, 42, 42, 42, 43],
  [38, 38, 38, 39, 39, 39, 33, 33, 33, 34, 34, 34, 40, 40, 40, 41],
];
let boundaries = 0;
for (let variant = 0; variant < 6; variant++)
  for (let roll = 0; roll < 16; roll++) {
    const m = new FlightMemory(entry.bytes);
    m.i(0x2229, u16(roll * 8 - 0x9248));
    assert.equal(selectPhotographyTarget(m, variant), targets[variant][roll]);
    assert.equal(u16(m.i(0x2229)), roll);
    boundaries++;
  }
assert.equal(boundaries, 96);
const initialized = new FlightMemory(entry.bytes);
initializePhotographyActors(initialized);
const firstSpawn = capture("spawn-before", 0xf2e, 0xa9a);
exact(
  initialized.bytes.subarray(0x77fa, 0x77fa + 32 * 6),
  firstSpawn.bytes.subarray(0x77fa, 0x77fa + 32 * 6),
  null,
  "original32 animal metadata records",
);
assert.equal(initialized.b(0x5d2a), 12);
assert.deepEqual(photographyOccluders(4), [0x8da8, 0x8d68]);
assert.deepEqual(photographyOccluders(8), [0x9260, 0x8eb6]);
assert.deepEqual(photographyOccluders(14), []);
assert.throws(() => selectPhotographyTarget(initialized, 7));
assert.throws(() => selectPhotographyAnimals(initialized, 0));
let borneoBoundaries = 0;
for (let roll = 0; roll < 16; roll++) {
  initialized.i(0x2229, u16(roll * 8 - 0x9248));
  assert.equal(selectPhotographyTarget(initialized, 6), targets[0][roll]);
  borneoBoundaries++;
}
assert.equal(borneoBoundaries, 16);
selectPhotographyAnimals(initialized, 6);
assert.deepEqual(
  Array.from({ length: 5 }, (_, i) => initialized.i(0x6d32 + i * 2)),
  [14, 18, 24, 27, 16],
);
assert.throws(() => selectPhotographyAnimals(initialized, -1));
assert.throws(() => spawnPhotographyAnimal(initialized, 3));
assert.throws(() => settlePhotographyResults(initialized, new Uint8Array(11)));
assert.throws(() => finishPhotographyReturn(initialized, 2));
console.log(
  "Photography:8 conditional original cases,9 checkpoints,112 static target/default boundaries,32 exact metadata records;7 negative controls. Browser acceptance and carried runtime checks are separate.",
);
