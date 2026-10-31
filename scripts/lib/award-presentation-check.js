import assert from "node:assert/strict";
import { PNG } from "pngjs";
export function awardPixels(v) {
  return PNG.sync.read(Buffer.from(v.png.split(",")[1], "base64")).data;
}
export function compareAwardGroups(data, target) {
  assert.equal(data.length, 15, "Missing award row groups");
  const base = awardPixels(data[0]);
  for (const phase of ["initial-wipe", "wipe", "reveal"]) {
    const rows = data.filter(
      (v) => v.state.expeditionResult.presentation.phase === phase,
    );
    assert.deepEqual(
      rows.map((v) => v.state.expeditionResult.presentation.transition.band),
      [0, 1, 2, 3, 4],
    );
    for (let band = 0; band < 5; band++) {
      const actual = awardPixels(rows[band]);
      for (let y = 0; y < 200; y++)
        for (let x = 0; x < 320; x++) {
          const at = (y * 320 + x) * 4,
            black =
              phase === "wipe" ||
              (phase === "initial-wipe" && y % 5 <= band) ||
              (phase === "reveal" && y % 5 > band);
          const expected = black
            ? [0, 0, 0, 255]
            : [...(phase === "reveal" ? target : base).subarray(at, at + 4)];
          assert.deepEqual(
            [...actual.subarray(at, at + 4)],
            expected,
            `Award row pixels ${phase}/${band}/${y}/${x}`,
          );
        }
    }
  }
}
