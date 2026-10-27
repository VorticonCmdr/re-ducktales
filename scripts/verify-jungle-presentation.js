import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { FlightMemory } from "../src/game/flight-physics.js";
import { presentJungleFrame } from "../src/game/jungle-presentation.js";
import {
  JUNGLE_SPRITES,
  jungleSceneResources,
  junglePalette,
} from "../src/game/jungle-scene.js";
import { JungleRaster } from "../src/game/jungle-raster.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const SCHEDULE = [
  ["00", 307, 308, 0],
  ["01", 309, 310, 0],
  ["02", 314, 315, 3],
  ["03", 316, 317, 2],
  ["04", 318, 319, 1],
  ["05", 320, 321, 0],
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
function exact(a, b, label) {
  assert.equal(a.length, b.length, label);
  for (let i = 0; i < a.length; i++)
    if (a[i] !== b[i])
      assert.fail(
        `${label}: byte ${i.toString(16)}, actual ${a[i]}, expected ${b[i]}`,
      );
}
export async function verifyJunglePresentation(resources) {
  const manifest = JSON.parse(
    await readFile("reference/jungle-presentation.json", "utf8"),
  );
  assert.equal(manifest.expectedCaseCount, 6);
  assert.equal(manifest.expectedCheckpointCount, 6);
  assert.equal(manifest.expectedInputCount, 6);
  assert.equal(manifest.expectedPixelCheckpointCount, 1);
  assert.equal(manifest.expectedRasterPassCount, 4);
  assert.equal(manifest.capturePresentationOffset, 1);
  assert.equal(manifest.pixelTolerance, 0);
  assert.deepEqual(manifest.caseSchedule, SCHEDULE);
  assert.deepEqual(
    manifest.inputEvents,
    SCHEDULE.map(([id]) => ({ case: id, colorArtifact: `${id}-before` })),
  );
  assert.deepEqual(manifest.stackExclusion, [0x9df2, 0x9e72]);
  assert.deepEqual(manifest.deviceClockExclusion, [0x2225, 0x2229]);
  assert.deepEqual(manifest.injections, []);
  assert.deepEqual(manifest.fittedInputs, []);
  const local = {};
  for (const [key, artifact] of Object.entries(manifest.artifacts)) {
    const raw = await readFile(artifact.path).catch(() => {
      throw Error(`SETUP: missing ${artifact.path}; see docs/jungle.md`);
    });
    assert.equal(hash(raw), artifact.sha256, `corrupt ${artifact.path}`);
    const envelope = JSON.parse(raw);
    assert.equal(envelope.isError, false);
    if (key.startsWith("pixels-")) {
      const image = envelope.content.find((x) => x.type === "image");
      assert.equal(image.mimeType, "image/png");
      const decoded = PNG.sync.read(Buffer.from(image.data, "base64"));
      assert.deepEqual([decoded.width, decoded.height], [320, 200]);
      local[key] = decoded.data;
      continue;
    }
    const r = JSON.parse(envelope.content[0].text);
    assert.equal(r.aborted, false);
    assert.ok(r.results.every((x) => x.status === "ok"));
    local[key] = r.results;
  }
  assert.equal(Object.keys(local).length, 19);
  const code = Buffer.from(
    resources.executableRaw.subarray(0x1fa00 + 2048, 0x1fa00 + 26104),
  );
  const table = resources.executableRaw.readUInt16LE(0x1fa00 + 24);
  assert.equal(resources.executableRaw.readUInt16LE(0x1fa00 + 6), 436);
  for (let i = 0; i < 436; i++) {
    const at = 0x1fa00 + table + i * 4;
    const offset =
      resources.executableRaw.readUInt16LE(at) +
      (resources.executableRaw.readUInt16LE(at + 2) - 0xc17) * 16;
    assert.ok(offset >= 0 && offset + 2 <= code.length);
    code.writeUInt16LE((code.readUInt16LE(offset) + 0x1f5) & 65535, offset);
  }
  assert.equal(local.entry.length, 3);
  exact(
    Buffer.from(local.entry[2].data, "base64"),
    code,
    "fresh retry overlay identity",
  );
  assert.deepEqual(
    [local.entry[0].registers.cs, local.entry[0].registers.eip],
    [0xe0c, 0],
  );
  assert.deepEqual(
    [local.retry[0].registers.cs, local.retry[0].registers.eip],
    [0x1f5, 0x439],
  );
  const retry = Buffer.from(local.retry[1].data, "base64");
  assert.equal(retry[0x9f5e], 25);
  assert.equal(retry[0x5b3c], 25);
  const scene = jungleSceneResources(
    resources.entries,
    resources.mainEntries,
    resources.mountainEntries,
  );
  function compare({
    omitCase = false,
    alterState = false,
    alterColor = false,
    omitColor = false,
    extraEvent = false,
  } = {}) {
    const events = structuredClone(manifest.inputEvents);
    if (omitColor) events.shift();
    if (extraEvent) events.push(events[0]);
    let executed = 0,
      drawings = 0;
    for (const [id, , , flag] of omitCase ? SCHEDULE.slice(1) : SCHEDULE) {
      const a = local[`${id}-before`],
        b = local[`${id}-after`];
      for (const [r, ip] of [
        [a, 0x32b],
        [b, 0x47c],
      ]) {
        assert.equal(r.length, 3);
        const c = r[0].registers;
        assert.deepEqual(
          [c.cs, c.eip, c.ds, c.ss, c.esp, c.ebp],
          [0xe0c, ip, 0x1403, 0x1403, 0x9e72, 0x9f48],
        );
      }
      const event = events.shift();
      assert.equal(event?.case, id, "missing presentation color event");
      assert.equal(event.colorArtifact, `${id}-before`);
      const m = new FlightMemory(Buffer.from(a[1].data, "base64"));
      assert.equal(m.i(0x78e8), flag);
      const assets = new Map(
        [...JUNGLE_SPRITES].map(([at, asset]) => [
          m.view.getUint16(at, true),
          asset,
        ]),
      );
      const handles = new Set(
        [0x2038, 0x203a, 0x7118].map((at) => m.view.getUint16(at, true)),
      );
      const validate = (command) => {
        renderFlightPixels([command], scene.entries, scene.font, "JG.ARC");
        drawings++;
      };
      const effects = {
        color: Buffer.from(a[2].data, "base64")[0],
        draw: (resource) => {
          const asset = assets.get(resource);
          assert.notEqual(asset, undefined, "unloaded presentation resource");
          validate({
            op: "sprite",
            asset,
            frame: m.b(resource + 18),
            x: m.i(resource),
            y: m.i(resource + 2),
          });
        },
        copy: (copy) => {
          assert.ok(
            handles.has(copy.from) && handles.has(copy.to),
            "unknown copy surface",
          );
          assert.ok(Object.values(copy).every(Number.isInteger));
          assert.ok(copy.width > 0 && copy.height > 0);
        },
        line: (c) => validate({ op: "line", ...c }),
        text: (c) => validate({ op: "text", ...c }),
        wait: () => assert.fail("unexpected presentation wait"),
        sound: () => assert.fail("unexpected presentation sound"),
      };
      presentJungleFrame(m, effects);
      if (alterState && id === "00") m.i(0x2229, m.i(0x2229) ^ 1);
      if (alterColor && id === "00") effects.color ^= 1;
      const expected = Buffer.from(b[1].data, "base64");
      let start = 0;
      for (const [lo, hi] of [
        manifest.deviceClockExclusion,
        manifest.stackExclusion,
        [65536, 65536],
      ]) {
        exact(
          m.bytes.subarray(start, lo),
          expected.subarray(start, lo),
          `presentation ${id} DS divergence`,
        );
        start = hi;
      }
      assert.equal(
        effects.color,
        Buffer.from(b[2].data, "base64")[0],
        "presentation drawing color",
      );
      executed++;
    }
    assert.equal(executed, 6, "missing presentation checkpoint");
    assert.equal(events.length, 0, "unconsumed presentation event");
    assert.ok(drawings > 0);
  }
  compare();
  assert.throws(
    () => compare({ omitCase: true }),
    /missing presentation color event/,
  );
  assert.throws(() => compare({ alterState: true }), /DS divergence/);
  assert.throws(
    () => compare({ alterColor: true }),
    /presentation drawing color/,
  );
  assert.throws(
    () => compare({ omitColor: true }),
    /missing presentation color event/,
  );
  assert.throws(
    () => compare({ extraEvent: true }),
    /unconsumed presentation event/,
  );
  assert.throws(
    () => presentJungleFrame(new FlightMemory(new Uint8Array(65536)), {}),
    /Missing jungle draw/,
  );
  assert.equal(local.driver.length, 3);
  assert.deepEqual(
    [local.driver[0].registers.cs, local.driver[0].registers.eip],
    [0xe0c, 0x49a],
  );
  // Copy01ef patches four immediate operands at026a/0276/029a/02a8.
  // The last copy is the32-pixel actor restore,40-byte row stride; both
  // descriptors carry8000-byte plane strides,including the video descriptor.
  const driverCode = Buffer.from(
    resources.driverEntries[1].data.subarray(0xe5, 0x35d),
  );
  for (const [at, value] of [
    [0x32d, 36],
    [0x331, 36],
    [0x341, 8000],
    [0x34b, 8000],
  ])
    driverCode.writeUInt16LE(value, at - 0xe5);
  exact(
    Buffer.from(local.driver[2].data, "base64"),
    driverCode,
    "live EGA copy/page code",
  );
  for (const id of [322, 323]) {
    const r = local[`state-${id}`];
    assert.equal(r.length, 2);
    assert.deepEqual(
      [
        r[0].registers.cs,
        r[0].registers.eip,
        r[0].registers.ds,
        r[0].registers.ss,
      ],
      [0xe0c, 0x49a, 0x1403, 0x1403],
    );
  }
  function rasterCompare({
    omitRestore = false,
    wrongAlignment = false,
    alterPixel = false,
    omitFrame = false,
  } = {}) {
    const raster = new JungleRaster(scene);
    let palette,
      executed = 0;
    for (const id of omitFrame
      ? ["03", "04", "05"]
      : ["02", "03", "04", "05"]) {
      const a = local[`${id}-before`],
        m = new FlightMemory(Buffer.from(a[1].data, "base64"));
      palette = junglePalette(m);
      const first = m.i(0x9f42) !== 0;
      assert.equal(first, id === "02");
      const effects = raster.begin(m, Buffer.from(a[2].data, "base64")[0]);
      if (omitRestore && id === "05") effects.copy = () => {};
      presentJungleFrame(m, effects);
      raster.finish({ copyToOtherPage: first });
      executed++;
    }
    const actual = raster.pixels(palette);
    if (alterPixel) actual[0] ^= 1;
    exact(
      actual,
      local[wrongAlignment ? "pixels-322" : "pixels-323"],
      "incremental jungle pixels",
    );
    assert.equal(executed, 4, "missing jungle raster frame");
  }
  rasterCompare();
  assert.throws(
    () => rasterCompare({ omitRestore: true }),
    /incremental jungle pixels/,
  );
  assert.throws(
    () => rasterCompare({ wrongAlignment: true }),
    /incremental jungle pixels/,
  );
  assert.throws(
    () => rasterCompare({ alterPixel: true }),
    /incremental jungle pixels/,
  );
  assert.throws(
    () => rasterCompare({ omitFrame: true }),
    /incremental jungle pixels|missing jungle raster frame|Uninitialized jungle framebuffer/,
  );
  assert.throws(
    () => new JungleRaster(scene).pixels(undefined, 0),
    /Uninitialized jungle framebuffer pixel/,
  );
  console.log(
    "Jungle presentation:6 conditional original full-DS passes/external colors;fresh overlay and EGA copy/page identity;4 carried raster passes match one exact320x200 original PNG with fixed presentation alignment;11 negative controls. Conditional initial viewport only; scrolling,timing and browser gameplay remain unverified.",
  );
}
