// Read-only workload analysis from six captured original drawing boundaries.
// Does not schedule time, fit a delay, or alter acceptance fixtures.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FlightMemory } from "../src/game/flight-physics.js";
import { presentJungleFrame } from "../src/game/jungle-presentation.js";
import { egaLinePrimitiveWork } from "./lib/ega-line-work.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const parent = JSON.parse(await readFile("reference/jungle-presentation.json"));
const work = JSON.parse(await readFile("reference/jungle-draw-work.json"));
assert.equal(work.expectedCaseCount, 6);
for (const [p, h] of Object.entries(work.sources))
  assert.equal(sha(await readFile(p)), h, `Changed jungle source ${p}`);
const rows = [];
for (const c of work.cases) {
  const spec = parent.artifacts[`${c.id}-before`];
  assert.ok(spec);
  const bytes = await readFile(spec.path);
  assert.equal(sha(bytes), spec.sha256);
  const r = JSON.parse(JSON.parse(bytes).content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((r) => r.status === "ok"));
  const m = new FlightMemory(Buffer.from(r.results[1].data, "base64"));
  assert.equal(m.bytes?.length ?? m.view.byteLength, 65536);
  assert.equal(m.b(0x2046), 0, "Unsupported non-EGA scale");
  const lines = [];
  const effects = {
    color: Buffer.from(r.results[2].data, "base64")[0],
    draw() {},
    copy() {},
    text() {},
    line(c) {
      lines.push({ command: c, work: egaLinePrimitiveWork(c, m.b(0x2046)) });
    },
    wait() {
      assert.fail("Unexpected wait");
    },
    sound() {
      assert.fail("Unexpected sound");
    },
  };
  presentJungleFrame(m, effects);
  assert.equal(lines.length, c.work.omittedLines, "Unconsumed source lines");
  const totals = lines.reduce(
    (a, l) => ({
      instructions: a.instructions + l.work.instructions,
      portWrites: a.portWrites + l.work.portWrites,
    }),
    { instructions: 0, portWrites: 0 },
  );
  const milliseconds = totals.instructions
    ? normalCoreGraphicsMilliseconds(totals, 3000)
    : 0;
  rows.push({
    case: c.id,
    lineCalls: lines.length,
    ...totals,
    milliseconds,
    oldSpriteCopyMilliseconds: normalCoreGraphicsMilliseconds(c.work, 3000),
    lines,
  });
}
assert.equal(rows.length, 6);
console.log(
  JSON.stringify(
    {
      scope:
        "Exploratory primitive workload from original BEFORE-state drawings;excludes resident dispatch/color,text and remaining CPU/device costs. No cadence or runtime integration claim.",
      rows,
    },
    null,
    2,
  ),
);
