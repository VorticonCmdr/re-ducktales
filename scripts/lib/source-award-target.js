// Source-composed presentation expectation,independent of Game/DOM/renderer.
// Original resource35,font42 and Main's literal text/number coordinates. This
// complements retained earlier browser pages;it is not a native screenshot.
import assert from "node:assert/strict";
import { renderFlightPixels } from "../../src/game/flight-raster.js";
import { executableText } from "../../src/game/executable.js";
export function sourceAwardTarget(value, { image, archives }) {
  assert.ok(Number.isInteger(value) && value > 0 && value <= 32767);
  const entries = archives.get("MAIN.ARC");
  const text = (text, x, y) => ({ op: "text", text, x, y, color: 15 });
  return renderFlightPixels(
    [
      {
        op: "copy",
        asset: 35,
        frame: 0,
        x: 0,
        y: 0,
        sourceX: 0,
        sourceY: 0,
        width: 320,
        height: 200,
      },
      ...[0x2c5, 0x2d6, 0x2e8, 0x2f9].map((at, i) =>
        text(executableText(image, at), 168, 60 + i * 16),
      ),
      text(executableText(image, 0x306), 208, 128),
      text(String(value), 216, 128),
    ],
    entries,
    entries[42].data,
    "MAIN.ARC",
  );
}
