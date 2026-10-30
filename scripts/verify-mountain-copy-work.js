// Compose the two independently checked boundaries: source call arguments and
// primitive work rules. This does not execute a continuous original frame.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { egaSignedCopyWork } from "./lib/ega-signed-copy-work.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
for (const script of [
  "verify-mountain-erase.js",
  "verify-ega-signed-copies.js",
])
  execFileSync(process.execPath, ["scripts/" + script], { stdio: "pipe" });
const m = JSON.parse(readFileSync("reference/mountain-erase-work.json"));
const s16 = (v) => (v << 16) >> 16;
const cases = [];
let copies = 0;
for (let i = 0; i < 34; i++) {
  const r = JSON.parse(
    readFileSync(m.artifacts["case-" + String(i).padStart(2, "0")].path),
  );
  const sum = {
    instructions: 0,
    portWrites: 0,
    repeatOpcodes: 0,
    repeatIterations: 0,
  };
  for (const words of r.copies) {
    const [height, width, y, x, , sourceY, sourceX] = words.map(s16);
    const cost = egaSignedCopyWork({
      height,
      width,
      sourceY,
      sourceX,
      destinationY: y,
      destinationX: x,
      sourceStrideBytes: 40,
      destinationStrideBytes: 40,
      sourceVideo: false,
      destinationVideo: true,
    });
    for (const k of Object.keys(sum)) sum[k] += cost[k];
    copies++;
  }
  if (i < 14) {
    assert.equal(r.copies.length, 6);
    assert.deepEqual(sum, {
      instructions: 7412,
      portWrites: 48,
      repeatOpcodes: 1392,
      repeatIterations: 2332,
    });
  }
  cases.push({
    case: i,
    copies: r.copies.length,
    ...sum,
    milliseconds: normalCoreGraphicsMilliseconds(sum, 3000),
  });
}
assert.equal(copies, 191);
assert.equal(cases.length, 34);
console.log(
  JSON.stringify(
    {
      scope:
        "Derived source-copy work across34 independent call plans;not native elapsed time,full frame or browser acceptance",
      cases: 34,
      copies,
      firstWalk: cases[0],
      all: cases,
    },
    null,
    2,
  ),
);
