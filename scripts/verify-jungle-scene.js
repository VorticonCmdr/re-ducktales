import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { FlightMemory } from "../src/game/flight-physics.js";
import { initializeJungleLife } from "../src/game/jungle-initialization.js";
import {
  composeJungleFullScene,
  jungleSceneResources,
  junglePalette,
  renderJunglePixels,
} from "../src/game/jungle-scene.js";

const CASES = [
  ["idle0", "first-frame", "idle1", 248, 249],
  ["idle1", "idle1", "idle2", 249, 250],
  ["idle2", "idle2", "idle3", 250, 251],
  ["idle3", "idle3", "idle4", 251, 252],
  ["drop0", "drop0", "drop1", 254, 255],
  ["drop1", "drop1", "drop2", 255, 256],
  ["drop2", "drop2", "drop3", 256, 257],
  ["life2", "life2-0", "life2-1", 260, 261],
];
// Node's structural Buffer diff can exhaust memory while formatting a large
// intentional mismatch. Compare every byte and report only the first failure.
function exactBytes(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: byte length`);
  for (let i = 0; i < actual.length; i++)
    if (actual[i] !== expected[i])
      assert.fail(
        `${label}: byte ${i}, actual ${actual[i]}, expected ${expected[i]}`,
      );
}
function decode(raw, ip, count = 2) {
  assert.equal(raw.isError, false);
  const r = JSON.parse(raw.content[0].text);
  assert.equal(r.aborted, false);
  assert.equal(r.results.length, count);
  assert.ok(r.results.every((x) => x.status === "ok"));
  const cpu = r.results[0].registers;
  assert.deepEqual(
    [cpu.cs, cpu.eip, cpu.ds, cpu.ss],
    [0xe0c, ip, 0x1403, 0x1403],
  );
  const bytes = Buffer.from(r.results[1].data, "base64");
  assert.equal(bytes.length, 65536);
  return { cpu, bytes, results: r.results };
}
export async function verifyJungleScene(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-scene.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 8);
  assert.equal(manifest.expectedCheckpointCount, 9);
  assert.equal(manifest.expectedPixelCheckpointCount, 8);
  assert.equal(manifest.expectedRoutineCaseCount, 1);
  assert.equal(manifest.expectedInputCount, 1);
  assert.deepEqual(manifest.inputEvents, [
    { case: "life-reset", first: false },
  ]);
  assert.deepEqual(manifest.sceneSchedule, CASES);
  assert.equal(manifest.capturePresentationOffset, 1);
  assert.equal(manifest.pixelTolerance, 0);
  assert.equal(manifest.codeIdentityManifest, "reference/jungle-hazards.json");
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const bytes = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      artifact.sha256,
      `corrupt ${artifact.path}`,
    );
    local[key] = artifact.path.endsWith(".png")
      ? PNG.sync.read(bytes)
      : JSON.parse(bytes);
  }
  assert.equal(Object.keys(local).length, 20, "missing jungle scene artifact");
  const sceneResources = jungleSceneResources(
    resources.entries,
    resources.mainEntries,
    resources.mountainEntries,
  );
  const driver = JSON.parse(local["palette-driver"].content[0].text);
  assert.equal(local["palette-driver"].isError, false);
  assert.equal(driver.aborted, false);
  assert.equal(driver.results.length, 3);
  assert.ok(driver.results.every((r) => r.status === "ok"));
  assert.deepEqual(
    [driver.results[0].registers.cs, driver.results[0].registers.eip],
    [0xe0c, 0x49a],
  );
  const code = Buffer.from(driver.results[1].data, "base64"),
    table = Buffer.from(driver.results[2].data, "base64");
  assert.deepEqual(
    code,
    Buffer.from(resources.driverEntries[1].data).subarray(0x8e, 0xe5),
    "original graphics palette code identity",
  );
  assert.equal(table.length, 25);
  assert.equal(table.readUInt16LE(0), 0x2056);
  const life2 = decode(local["life2-0-state"], 0x49a).bytes;
  assert.deepEqual(
    table.subarray(8, 24),
    Buffer.from(life2.subarray(0x2056, 0x2066).map((v) => v & 63)),
    "driver palette cache",
  );
  assert.equal(
    decode(local["down-input"], 0x680).cpu.eax & 255,
    5,
    "independent setup input provenance",
  );
  function pixels({
    omitCase = false,
    wrongPalette = false,
    omitForest = false,
    wrongAlignment = false,
    corruptPixel = false,
    mutateState = false,
  } = {}) {
    let executed = 0;
    for (const [id, stateKey, pngKey] of CASES) {
      if (omitCase && id === "drop1") continue;
      const source = decode(local[stateKey + "-state"], 0x49a).bytes,
        m = new FlightMemory(source);
      let commands = composeJungleFullScene(m);
      if (omitForest && id === "idle0")
        commands = commands.filter((c) => c.op !== "restore");
      const palette = junglePalette(m);
      if (wrongPalette && id === "life2") palette[5] = [170, 0, 0];
      const rendered = renderJunglePixels(commands, sceneResources, palette);
      const expected =
        local[(wrongAlignment && id === "idle1" ? "idle1" : pngKey) + "-png"];
      assert.deepEqual([expected.width, expected.height], [320, 200]);
      const expectedPixels = Buffer.from(expected.data);
      if (corruptPixel && id === "idle2") expectedPixels[0] ^= 1;
      exactBytes(rendered, expectedPixels, `${id}: jungle pixel divergence`);
      if (mutateState && id === "drop0") m.bytes[0x88ae] ^= 1;
      exactBytes(m.bytes, source, "rendering mutated simulation");
      executed++;
    }
    assert.equal(executed, 8, "unfinished scene cases");
  }
  function reset(wrongFirst = false) {
    const before = decode(local["life-reset-before"], 0x12dd),
      after = decode(local["life-reset-after"], 0x13d0);
    assert.equal(before.cpu.esp, 0x9e6c);
    assert.equal(after.cpu.ebp, before.cpu.esp - 2);
    assert.equal(before.bytes.readUInt16LE(before.cpu.esp + 4), 0);
    const m = new FlightMemory(before.bytes);
    let palettes = 0;
    initializeJungleLife(m, wrongFirst ? true : manifest.inputEvents[0].first, {
      palette: () => palettes++,
    });
    for (const [lo, hi] of [
      [0, 0x9e56],
      [0x9e6c, 65536],
    ])
      exactBytes(
        m.bytes.subarray(lo, hi),
        after.bytes.subarray(lo, hi),
        "life reset DS divergence",
      );
    assert.equal(palettes, 1, "missing reset palette output");
    assert.equal(m.i(0x5cfc), 2);
  }
  pixels();
  reset();
  assert.throws(() => pixels({ omitCase: true }), /unfinished scene cases/);
  assert.throws(() => pixels({ wrongPalette: true }), /pixel divergence/);
  assert.throws(() => pixels({ omitForest: true }), /pixel divergence/);
  assert.throws(() => pixels({ wrongAlignment: true }), /pixel divergence/);
  assert.throws(() => pixels({ corruptPixel: true }), /pixel divergence/);
  assert.throws(() => pixels({ mutateState: true }), /mutated simulation/);
  assert.throws(() => reset(true), /life reset DS divergence/);
  const bad = new FlightMemory(decode(local["first-frame-state"], 0x49a).bytes);
  bad.b(bad.view.getUint16(0x797a, true) + 18, 255);
  assert.throws(
    () =>
      renderJunglePixels(
        composeJungleFullScene(bad),
        sceneResources,
        junglePalette(bad),
      ),
    /animation frame/,
  );
  console.log(
    "Jungle scene: 8 exact320x200 original PNG comparisons, fixed one-presentation VGA alignment,1 conditional life-reset routine/argument,7 negative controls; source assets and graphics palette code pinned, rendering preserves all DS bytes. Conditional initial viewport/drop/two-life palette only; no incremental/scrolling/enemy/gameplay replay or browser acceptance claim.",
  );
}
