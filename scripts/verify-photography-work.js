import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import {
  preparePhotography,
  drawPhotographySprite,
} from "../src/game/photography-scene.js";
import { advancePhotographyAnimals } from "../src/game/photography-animation.js";
import { photographyWork } from "../src/game/photography-work.js";
import { DRIVER_HZ } from "../src/game/timing.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
function checked(path, hash) {
  let b;
  try {
    b = read(path);
  } catch {
    throw Error(`SETUP: missing ${path};see docs/photography-timing.md`);
  }
  assert.equal(sha(b), hash, `Corrupt ${path}`);
  return b;
}
const manifest = JSON.parse(read("reference/photography-draw-work.json"));
assert.equal(manifest.expectedCaseCount, 11);
assert.equal(manifest.expectedActiveCaseCount, 3);
assert.equal(manifest.expectedSpriteCalls, 12);
assert.equal(manifest.acceptanceLevel, "conditional-native-primitive-work");
assert.deepEqual(manifest.fittedInputs, []);
assert.equal(manifest.partialRestore, false);
assert.deepEqual(manifest.configuration, {
  core: "normal",
  cyclesPerMillisecond: 3000,
  retraceHz: 70.086,
});
assert.deepEqual(Object.keys(manifest.sources), [
  "src/game/photography-work.js",
  "src/game/photography-scene.js",
  "src/game/photography-animation.js",
  "src/game/ega-work.js",
  "src/game/timing.js",
]);
for (const [p, h] of Object.entries(manifest.sources)) checked(p, h);
const parent = JSON.parse(
    checked(manifest.parent.path, manifest.parent.sha256),
  ),
  old = JSON.parse(
    checked(manifest.originalIdentity.path, manifest.originalIdentity.sha256),
  );
assert.equal(parent.emulator.cycles, 3000);
assert.equal(parent.emulator.core, "normal");
const build = JSON.parse(
  checked(manifest.buildManifest, manifest.buildManifestSha256),
);
const original = (n) => checked(`game/${n}`, build.files[n].sha256),
  exe = original("DUCKTALE.EXE"),
  entries = parseArchive(original("PS.ARC"));
function capture(role) {
  const s = parent.artifacts[role],
    r = JSON.parse(JSON.parse(checked(s.path, s.sha256)).content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((x) => x.status === "ok"));
  assert.equal(r.results[0].registers.ds, 0x1403);
  return r.results;
}
const entry = capture("entry"),
  live = Buffer.from(entry[2].data, "base64");
assert.equal(live.length, 7924);
const ov = exe.subarray(0x1d800, 0x1d800 + 8436),
  body = Buffer.from(ov.subarray(512));
assert.equal(sha(ov), old.source.sha256);
assert.equal(sha(body), old.source.bodySha256);
assert.equal(ov.readUInt16LE(6), 93);
const positions = [];
for (let i = 0; i < 93; i++) {
  const p = ov.readUInt16LE(24) + i * 4,
    o = ov.readUInt16LE(p) + (ov.readUInt16LE(p + 2) - 0xc17) * 16;
  positions.push(o);
  body.writeUInt16LE((body.readUInt16LE(o) + 0x1f5) & 65535, o);
}
assert.deepEqual(body, live, "Complete original/native photography code");
for (const o of positions)
  body.writeUInt16LE((body.readUInt16LE(o) + 0x1000 - 0x1f5) & 65535, o);
const prologue = manifest.staticToNative.analysisPrologue;
assert.deepEqual(manifest.staticToNative, {
  program: "PHOTOGRAPHY_CODE.EXE",
  ghidraBodyBase: "1c17:0000",
  nativeBodyBase: "0e0c:0000",
  ghidraHelperBase: "1d39:0000",
  nativeHelperBase: "0f2e:0000",
  ghidraLoadBase: "1000",
  nativeLoadBase: "01f5",
  relocationCount: 93,
  analysisPrologue: {
    offset: 4823,
    relocatedNative: "9a9e1e0e14",
    analysis: "81ec000090",
  },
});
assert.equal(
  body.subarray(prologue.offset, prologue.offset + 5).toString("hex"),
  prologue.relocatedNative,
);
body.set(Buffer.from(prologue.analysis, "hex"), prologue.offset);
function artifact(name) {
  const a = manifest.artifacts[name],
    r = JSON.parse(checked(a.path, a.sha256));
  assert.equal(r.isError, false);
  return JSON.parse(r.content[0].text);
}
function code(list) {
  assert.equal(list.program, "PHOTOGRAPHY_CODE.EXE");
  assert.equal(list.success, true);
  assert.equal(list.truncated, false);
  let end = null,
    total = 0;
  for (const i of list.instructions) {
    const [s, o] = i.address.split(":").map((x) => parseInt(x, 16)),
      at = s * 16 + o - 0x1c170;
    if (end !== null)
      assert.equal(at, end, "Missing static source instruction");
    assert.equal(
      body.subarray(at, at + i.length).toString("hex"),
      i.bytes,
      "Static/native photography byte mismatch",
    );
    end = at + i.length;
    total += i.length;
  }
  assert.ok(total > 0);
  return total;
}
let bytes = 0;
for (const name of [
  "main-input-and-shutter",
  "main-normal-tail",
  "hud-instructions",
  "startup-draw",
])
  bytes += code(artifact(name));
assert.equal(bytes, 1293);
const fn = artifact("hud-function");
assert.equal(fn.language_id, "x86:LE:16:Real Mode");
assert.equal(fn.entry_point, "1d39:00b2");
assert.equal(fn.size, 146);
assert.ok(fn.revision.token);
const wrong = artifact("hud-instructions");
wrong.instructions[1].bytes = "00";
assert.throws(() => code(wrong), /Static\/native photography byte mismatch/);
const prepared = preparePhotography({
  image: unpackImage(exe),
  entries,
  variant: 4,
  difficulty: 0,
  seed: 45009,
  money: 2094,
  day: 27,
  location: 12,
});
let active = 0,
  sprites = 0;
function checkCount(work, observed) {
  assert.ok(
    work.milliseconds >= ((observed - 1) * 1000) / DRIVER_HZ &&
      work.milliseconds <= ((observed + 1) * 1000) / DRIVER_HZ,
    "Photography conditional drawing budget",
  );
}
for (let i = 0; i < 11; i++) {
  const before = capture(`pass${i}-before`),
    after = capture(`pass${i}-after`),
    a = Buffer.from(before[1].data, "base64"),
    b = Buffer.from(after[1].data, "base64"),
    m = new FlightMemory(a),
    commands = [];
  assert.deepEqual(
    [
      before[0].registers.cs,
      before[0].registers.eip,
      after[0].registers.cs,
      after[0].registers.eip,
    ],
    [0xf2e, 0x144, 0xf2e, 0x8e3],
  );
  assert.equal(a.length, 65536);
  assert.equal(b.length, 65536);
  assert.equal(a[0x2042], 0);
  const w = (p) => a.readUInt16LE(p);
  assert.deepEqual(
    [w(0x1fec), w(0x1fee), w(0x1ff0), w(0x1ff2)],
    [0x1ef, 0x2ed7, 0x35d, 0x2ed7],
  );
  for (const p of [w(0x2038), w(0x203a)])
    assert.deepEqual([w(p), w(p + 2), w(p + 8)], [40, 200, 8000]);
  assert.ok([0xa000, 0xa200].includes(w(w(0x2038) + 6)));
  assert.equal(w(w(0x203a) + 6), 0x2706);
  advancePhotographyAnimals(m, {
    draw: (at) => drawPhotographySprite(commands, m, prepared.assets, at),
    sound: () => {},
  });
  const work = photographyWork(entries, commands),
    counts = (b.readUInt32LE(0x2225) - a.readUInt32LE(0x2225)) >>> 0;
  if (i < 8) {
    assert.equal(commands.length, 0);
    assert.equal(work.milliseconds, 0);
    assert.equal(counts, 0);
  } else {
    active++;
    sprites += commands.length;
    assert.deepEqual(
      commands.map((c) => c.asset),
      [23, 39, 8, 7],
    );
    assert.equal(counts, 2);
    assert.deepEqual(work, manifest.expectedActiveWork);
    checkCount(work, counts);
    assert.throws(() =>
      assert.deepEqual(
        photographyWork(entries, commands.slice(1)),
        manifest.expectedActiveWork,
      ),
    );
  }
}
assert.equal(active, 3);
assert.equal(sprites, 12);
assert.throws(
  () => checkCount(manifest.expectedActiveWork, 5),
  /Photography conditional drawing budget/,
);
assert.throws(
  () => photographyWork(entries, [{ op: "fill" }]),
  /Unsupported photography source operation/,
);
execFileSync(process.execPath, ["scripts/verify-ega-work.js"], {
  stdio: "inherit",
});
console.log(
  "Photography work:11 conditional native cases,3 active four-sprite segments at28.157ms versus2 driver counts;1293 static bytes linked to the complete relocated7924-byte body;omitted sprite/code/budget/unsupported-operation negatives pass. Partial source work,not whole-loop timing parity.",
);
