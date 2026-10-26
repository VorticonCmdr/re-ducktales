// Static asset/translation check, not an original runtime or browser replay.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import build from "../reference/build.json" with { type: "json" };
import { parseArchive, imagePixels } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import {
  prepareMountain,
  mountainLayouts,
  composeMountainTerrain,
} from "../src/game/mountain-scene.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";

const hash = (b) => createHash("sha256").update(b).digest("hex");
async function original(name) {
  const bytes = await readFile(`game/${name}`).catch(() => {
    throw Error(
      `SETUP: missing game/${name}. Supply the supported original build.`,
    );
  });
  assert.equal(bytes.length, build.files[name].bytes, `${name}: byte length`);
  assert.equal(hash(bytes), build.files[name].sha256, `${name}: SHA-256`);
  return bytes;
}
const image = unpackImage(await original("DUCKTALE.EXE"));
const entries = parseArchive(await original("MT.ARC"), "MT.ARC");
assert.deepEqual(mountainLayouts(image).map(hash), [
  "fe59742c058f8062a3dfb1b9a966d8f8c201ffadc90f48445960427780524b94",
  "0570b5d6e095c8cf24dcdafd48bd0e907a3386e1106f572d754b30b356881cb9",
  "b7a6806efc28b339f3f14b7a54a29eb7445dcbba1a1568df534df99c2cbf340e",
]);
const background = imagePixels(entries[0]);
const tiles = Array.from({ length: 9 }, (_, frame) =>
  imagePixels(entries[1], frame, entries[1].data[0] >> 4),
);

// Independent destination-pixel construction from the executable table and
// decoded assets. No command stream or resulting render feeds this oracle.
function expectedTerrain(variant, firstRow) {
  const expected = new Uint8ClampedArray(320 * 200 * 4);
  const table = 0x120e0 + [0xfec, 0x11fa, 0x1408][variant];
  for (let y = 0; y < 168; y++) {
    const strip = 4 - Math.floor(y / 40);
    const row = firstRow + strip;
    const localY = y % 40;
    for (let x = 0; x < 320; x++) {
      const by = (row % 5) * 40 + localY;
      let pixel = background.subarray(
        (by * 320 + x) * 4,
        (by * 320 + x) * 4 + 4,
      );
      if (row < 25) {
        const cell = image[table + row * 21 + Math.floor(x / 16)];
        if (cell !== 0x46) {
          const at = (localY * 16 + (x % 16)) * 4;
          if (tiles[cell - 0x30][at + 3])
            pixel = tiles[cell - 0x30].subarray(at, at + 4);
        }
      }
      expected.set(pixel, (y * 320 + x) * 4);
    }
  }
  return expected;
}
let cases = 0;
for (let variant = 0; variant < 3; variant++) {
  const { memory: m } = prepareMountain({
    image,
    entries,
    variant,
    difficulty: variant,
    seed: 0x1234,
    money: 1000,
  });
  assert.equal(m.i(0x5ae0), 16);
  assert.equal(m.i(0x5c72), 131);
  assert.equal(m.i(0x6d3c), 20);
  assert.equal(m.b(0x4d34), 3);
  assert.equal(m.i(0x2229), 0x1234, "entry must not invent RNG draws");
  assert.equal(m.view.getUint32(0x8cc0, true), 1000);
  for (let row = 0; row < 25; row++) {
    const commands = composeMountainTerrain(m, row);
    const actual = renderFlightPixels(commands, entries, null, "MT.ARC");
    const expected = expectedTerrain(variant, row);
    assert.deepEqual(actual, expected, `variant ${variant}, scroll ${row}`);
    if (row === 0) {
      const altered = structuredClone(commands);
      // The first strip normally starts at sourceY=0. Move it one strip.
      altered[0].source[0].sourceY = 40;
      assert.throws(
        () =>
          assert.deepEqual(
            renderFlightPixels(altered, entries, null, "MT.ARC"),
            expected,
          ),
        assert.AssertionError,
        "negative control: background crop mutation",
      );
      const broken = structuredClone(commands);
      broken[0].source.push({ op: "sprite", asset: 1, frame: 9, x: 0, y: 0 });
      assert.throws(
        () => renderFlightPixels(broken, entries, null, "MT.ARC"),
        /Unsupported flight animation frame/,
        "negative control: unsupported frame",
      );
    }
    cases++;
  }
}
assert.equal(cases, 75, "unexpected case count");
assert.throws(
  () => mountainLayouts(image.subarray(0, 100)),
  /Missing supported/,
);
assert.throws(
  () => prepareMountain({ image, entries, variant: 3 }),
  /Invalid mountain/,
);
console.log(
  `Mountain terrain: ${cases} static asset cases and negative controls passed. Runtime parity is unproven.`,
);
