import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bankSparkleCopyBytes } from "../src/game/bank-sparkle-copy.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rows = (from, to, x = 31) =>
  Array.from({ length: to - from }, (_, r) =>
    Array.from({ length: 4 }, (_, c) => (from + r) * 40 + x + c),
  ).flat();
test("observed final-bank y=-13 restores the five visible top rows", () =>
  assert.deepEqual(bankSparkleCopyBytes(248, -13), rows(0, 5)));
test("native unsigned top-edge wrap differs from ordinary rectangle clipping", () => {
  assert.deepEqual(bankSparkleCopyBytes(248, -18), []);
  assert.deepEqual(bankSparkleCopyBytes(248, -19), rows(0, 200));
});
test("native bottom clipping retains exactly the last five rows", () =>
  assert.deepEqual(bankSparkleCopyBytes(248, 195), rows(195, 200)));
test("original byte addressing carries an X span into the next scanline", () =>
  assert.deepEqual(bankSparkleCopyBytes(312, 0), rows(0, 18, 39)));
test("bank copy rejects unsupported coordinates instead of recovering", () => {
  for (const [x, y] of [
    [-8, 0],
    [1, 0],
    [65536, 0],
    [0, 32768],
    [0, -32769],
    [0, 0.5],
  ])
    assert.throws(
      () => bankSparkleCopyBytes(x, y),
      /Unsupported original bank sparkle/,
    );
});
const blank = [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 }],
  background = [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 13 }];
const restore = (y, extra = {}) => ({
  op: "restore",
  source: background,
  sourceX: 248,
  sourceY: y,
  x: 248,
  y,
  width: 32,
  height: 18,
  ...extra,
});
const expected = (height) => {
  const rgba = new Uint8ClampedArray(320 * 200 * 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  for (let y = 0; y < height; y++)
    for (let x = 248; x < 280; x++)
      rgba.set([255, 85, 255, 255], (y * 320 + x) * 4);
  return rgba;
};
test("bank raster reproduces the observed signed top-edge restore exactly", () =>
  assert.equal(
    sha(renderFlightPixels([...blank, restore(-13)], [], null, "MAC.ARC")),
    sha(expected(5)),
  ));
test("bank raster retains the unsigned wrap visible-row quirk", () => {
  const actual = sha(
    renderFlightPixels([...blank, restore(-19)], [], null, "MAC.ARC"),
  );
  assert.equal(actual, sha(expected(200)));
  assert.notEqual(actual, sha(expected(0)));
});
test("negative copies outside the exact bank contract still fail", () => {
  assert.throws(
    () => renderFlightPixels([...blank, restore(-13)], [], null, "EXP.ARC"),
    /Invalid framebuffer copy/,
  );
  assert.throws(
    () =>
      renderFlightPixels(
        [...blank, restore(-13, { sourceY: -12 })],
        [],
        null,
        "MAC.ARC",
      ),
    /Invalid framebuffer copy/,
  );
});
