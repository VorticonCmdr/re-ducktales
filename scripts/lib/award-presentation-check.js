import assert from "node:assert/strict";
import { PNG } from "pngjs";
export function awardPixels(v) {
  const png = PNG.sync.read(Buffer.from(v.png.split(",")[1], "base64"));
  assert.equal(png.width, 320, "Unexpected award page width");
  assert.equal(png.height, 200, "Unexpected award page height");
  return png.data;
}
export function compareAwardGroups(
  data,
  target,
  { incomingAlreadyCleared = false } = {},
) {
  assert.equal(data.length, 15, "Missing award row groups");
  assert.equal(typeof incomingAlreadyCleared, "boolean");
  const base = awardPixels(data[0]);
  let retainedPixels = 0;
  for (let y = 0; y < 200; y++)
    if (y % 5 !== 0)
      for (let x = 0; x < 320; x++) {
        const at = (y * 320 + x) * 4;
        if (base[at] || base[at + 1] || base[at + 2]) retainedPixels++;
      }
  if (incomingAlreadyCleared) {
    for (let at = 0; at < base.length; at += 4)
      assert.deepEqual(
        [...base.subarray(at, at + 4)],
        [0, 0, 0, 255],
        "Uncleared incoming award page",
      );
  } else assert.ok(retainedPixels > 0, "Missing incoming award page");
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
