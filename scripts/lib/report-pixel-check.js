import assert from "node:assert/strict";
import { awardPixels } from "./award-presentation-check.js";
export { awardPixels as reportPixels };
export function compareReportRows(observations, incoming, target) {
  assert.equal(incoming.length, 320 * 200 * 4);
  assert.equal(target.length, incoming.length);
  const groups = observations.filter(
    (v) => v.state.reportPresentation.transition,
  );
  assert.equal(groups.length, 15, "Missing report row groups");
  for (const [phase, offset] of [
    ["initial-wipe", 0],
    ["reveal", 25],
    ["exit-wipe", 50],
  ]) {
    const rows = groups.filter(
      (v) => v.state.reportPresentation.phase === phase,
    );
    assert.deepEqual(
      rows.map((v) => v.state.reportPresentation.transition.band),
      [0, 1, 2, 3, 4],
    );
    for (const row of rows) {
      const p = row.state.reportPresentation,
        band = p.transition.band,
        actual = awardPixels(row);
      // A row group is held for five retraces;the browser observer can first
      // see any point in that held band. Strict replay compares exact clocks.
      assert.equal(
        Math.floor((p.consumedRetraces - offset) / 5),
        band,
        "Wrong report band/retrace",
      );
      for (let y = 0; y < 200; y++)
        for (let x = 0; x < 320; x++) {
          const at = (y * 320 + x) * 4,
            stripe = y % 5 <= band,
            black = phase === "reveal" ? !stripe : stripe;
          const expected = black
            ? [0, 0, 0, 255]
            : [
                ...(phase === "initial-wipe" ? incoming : target).subarray(
                  at,
                  at + 4,
                ),
              ];
          assert.deepEqual(
            [...actual.subarray(at, at + 4)],
            expected,
            `Report row pixels ${phase}/${band}/${y}/${x}`,
          );
        }
    }
  }
  const ready = observations.filter(
      (v) => v.state.reportPresentation.phase === "publishing",
    ),
    end = observations.filter(
      (v) => v.state.reportPresentation.phase === "publishing-exit",
    );
  assert.equal(ready.length, 1);
  assert.equal(end.length, 1);
  assert.equal(ready[0].state.reportPresentation.consumedRetraces, 50);
  assert.equal(end[0].state.reportPresentation.consumedRetraces, 75);
  assert.deepEqual(awardPixels(ready[0]), target);
  const blank = Buffer.alloc(320 * 200 * 4);
  for (let at = 3; at < blank.length; at += 4) blank[at] = 255;
  assert.deepEqual(awardPixels(end[0]), blank);
}
