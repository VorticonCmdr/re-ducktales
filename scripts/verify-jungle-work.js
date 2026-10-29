// Conditional original drawing segments. This is not a closed-loop timing test.
import assert from "node:assert/strict";
import { readFileSync as read } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseArchive } from "../src/assets.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { presentJungleFrame } from "../src/game/jungle-presentation.js";
import { jungleSceneResources } from "../src/game/jungle-scene.js";
import { jungleWorkEffects } from "../src/game/jungle-work.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
import { DRIVER_HZ } from "../src/game/timing.js";
import { verifyJunglePresentation } from "./verify-jungle-presentation.js";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(read("reference/jungle-draw-work.json"));
const checkedRead = (path, hash) => {
  let bytes;
  try {
    bytes = read(path);
  } catch {
    throw Error(`SETUP: missing ${path}; see docs/jungle-timing.md`);
  }
  assert.equal(sha(bytes), hash, `Corrupt or changed ${path}`);
  return bytes;
};
for (const [path, hash] of Object.entries(manifest.sources))
  checkedRead(path, hash);
const parent = JSON.parse(
  checkedRead(manifest.parent.path, manifest.parent.sha256),
);
assert.equal(manifest.expectedCaseCount, 6);
assert.deepEqual(manifest.expectedCaseIds, [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
]);
assert.deepEqual(manifest.injections, []);
assert.deepEqual(manifest.fittedInputs, []);
assert.equal(manifest.acceptanceLevel, "conditional-native-drawing-work");
assert.equal(manifest.runtimeIntegrated, false);
assert.equal(manifest.cyclesPerMillisecond, 3000);
assert.equal(manifest.timerQuantizationCounts, 1);
execFileSync(process.execPath, ["scripts/verify-ega-work.js"], {
  stdio: "inherit",
});
const build = JSON.parse(read("reference/build.json"));
const files = {};
for (const name of ["DUCKTALE.EXE", "JG.ARC", "MAIN.ARC", "MT.ARC", "IT.DRV"])
  files[name] = checkedRead(`game/${name}`, build.files[name].sha256);
const resources = {
  executableRaw: files["DUCKTALE.EXE"],
  entries: parseArchive(files["JG.ARC"]),
  mainEntries: parseArchive(files["MAIN.ARC"]),
  mountainEntries: parseArchive(files["MT.ARC"]),
  driverEntries: parseArchive(files["IT.DRV"]),
};
// The existing comparison verifies relocated original code, six exact DS/effect
// boundaries, all artifact hashes, original driver bytes and the carried pixels.
await verifyJunglePresentation(resources);
const scene = jungleSceneResources(
  resources.entries,
  resources.mainEntries,
  resources.mountainEntries,
);
function state(role) {
  const artifact = parent.artifacts[role];
  assert.ok(artifact, `Missing declared ${role}`);
  const envelope = JSON.parse(checkedRead(artifact.path, artifact.sha256));
  assert.equal(envelope.isError, false);
  const result = JSON.parse(envelope.content[0].text);
  assert.equal(result.aborted, false);
  assert.equal(result.results.length, 3);
  assert.ok(result.results.every((r) => r.status === "ok"));
  const bytes = Buffer.from(result.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  const color = Buffer.from(result.results[2].data, "base64");
  assert.equal(color.length, 1);
  return { bytes, color: color[0] };
}
function compare(cases, fault = null) {
  assert.equal(
    cases.length,
    manifest.expectedCaseCount,
    "Missing drawing case",
  );
  assert.deepEqual(
    cases.map((c) => c.id),
    manifest.expectedCaseIds,
  );
  let completed = 0;
  for (const expected of cases) {
    const before = state(`${expected.id}-before`),
      after = state(`${expected.id}-after`);
    const memory = new FlightMemory(before.bytes);
    let sprites = 0,
      copies = 0,
      lines = 0,
      texts = 0;
    const sink = {
      color: before.color,
      draw() {
        sprites++;
      },
      copy() {
        copies++;
      },
      line() {
        lines++;
      },
      text() {
        texts++;
      },
      wait() {
        assert.fail("Unexpected drawing wait");
      },
      sound() {
        assert.fail("Unexpected drawing sound");
      },
    };
    const { effects, work } = jungleWorkEffects(memory, scene, sink);
    presentJungleFrame(memory, effects);
    if (fault === "missing-sprite" && expected.id === "00") work.instructions--;
    if (fault === "missing-copy" && expected.id === "00")
      work.repeatIterations--;
    assert.deepEqual(work, expected.work, `Drawing work ${expected.id}`);
    assert.deepEqual(
      [sprites, copies, lines, texts],
      [work.sprites, work.copies, work.omittedLines, work.omittedTexts],
      "Unconsumed effects",
    );
    const ticks =
      after.bytes.readUInt32LE(0x2225) - before.bytes.readUInt32LE(0x2225);
    assert.equal(
      ticks,
      expected.observedDriverCounts,
      "Changed original timer evidence",
    );
    const milliseconds =
      fault === "zero-time"
        ? 0
        : normalCoreGraphicsMilliseconds(work, manifest.cyclesPerMillisecond);
    // BEFORE/AFTER counter quantization brackets elapsed time by one tick.
    // Debugger budget discard and omitted work remain explicit limitations;
    // this agreement cannot establish uninterrupted frame/input cadence.
    const tickMs = 1000 / DRIVER_HZ;
    assert.ok(
      milliseconds >= (ticks - 1) * tickMs &&
        milliseconds <= (ticks + 1) * tickMs,
      `Outside conditional timer bracket: ${expected.id}, ${milliseconds} ms, ${ticks} counts`,
    );
    completed++;
    if (!fault)
      console.log(
        `Jungle ${expected.id}: ${milliseconds.toFixed(3)} ms sprite/copy work; original ${ticks} driver counts`,
      );
  }
  assert.equal(completed, 6);
}
compare(manifest.cases);
assert.throws(() => compare(manifest.cases.slice(1)), /Missing drawing case/);
assert.throws(
  () => compare(manifest.cases, "missing-sprite"),
  /Drawing work 00/,
);
assert.throws(() => compare(manifest.cases, "missing-copy"), /Drawing work 00/);
assert.throws(
  () => compare(manifest.cases, "zero-time"),
  /Outside conditional timer bracket/,
);
console.log(
  "Verified six conditional original jungle drawing segments and four negative controls; runtime timing remains unintegrated.",
);
