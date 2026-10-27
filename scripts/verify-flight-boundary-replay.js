import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import { Flight } from "../src/game/flight.js";
import { DRIVER_HZ, RETRACE_HZ } from "../src/game/application.js";
import { renderFlightPixels } from "../src/game/flight-raster.js";
import build from "../reference/build.json" with { type: "json" };
import inputs from "../reference/flight-boundary-inputs.json" with { type: "json" };
const files = {};
for (const n of ["DUCKTALE.EXE", "PLANE.ARC", "MAIN.ARC"]) {
  files[n] = await readFile(`game/${n}`);
  assert.equal(
    createHash("sha256").update(files[n]).digest("hex"),
    build.files[n].sha256,
  );
}
const image = unpackImage(files["DUCKTALE.EXE"]),
  entries = parseArchive(files["PLANE.ARC"]),
  font = parseArchive(files["MAIN.ARC"])[42].data;
export function replay(c, originalGuard = false) {
  assert.ok(c.events.length > 0);
  assert.equal(
    c.options.racing,
    Number(c.options.seed % 100 < [25, 50, 75][c.options.difficulty]),
  );
  c.events.forEach((e, i) => {
    assert.ok(Number.isInteger(e.at) && e.at % 8 === 0 && e.at < c.endAt);
    assert.ok(i === 0 ? e.at === 0 : e.at > c.events[i - 1].at);
  });
  const f = new Flight({ image, entries, ...c.options });
  let driver = 1000 / DRIVER_HZ,
    retrace = 1000 / RETRACE_HZ,
    i = 0,
    min = 0,
    rendered = 0,
    last = null;
  for (let now = 0; now < c.endAt; now += 8) {
    while (i < c.events.length && c.events[i].at <= now)
      f.setControls(c.events[i++]);
    while (Math.min(driver, retrace) <= now) {
      if (driver <= retrace) {
        f.advanceTick();
        driver += 1000 / DRIVER_HZ;
      } else {
        f.advanceRetrace();
        retrace += 1000 / RETRACE_HZ;
      }
      if (f.memory.i(0x0fb2) === 0) min = Math.min(min, f.memory.i(0x5ed6));
      if (f.current && f.current !== last) {
        if (
          originalGuard &&
          f.current.some(
            (x) =>
              x.op === "copy" && x.x === 0 && x.width === 8 && x.sourceX === 72,
          )
        )
          throw Error("negative control: original visible strip guard");
        renderFlightPixels(f.current, entries, font);
        last = f.current;
        rendered++;
      }
    }
    if (f.outcome) {
      assert.equal(now, c.endAt - 8, "unexpected replay termination time");
      break;
    }
  }
  assert.equal(i, c.events.length, "unconsumed required flight input");
  assert.equal(min, c.requiredBoundary, "required flight boundary was skipped");
  assert.ok(rendered > 100, "zero/unfinished presentation coverage");
  assert.equal(
    !!f.outcome,
    c.completionRequired,
    "unfinished/early flight outcome",
  );
  return { state: f.snapshot(), rendered, min };
}
assert.equal(inputs.cases.length, 2);
assert.deepEqual(
  inputs.cases.map((c) => c.events.length),
  [14, 11],
  "missing required flight events",
);
const results = inputs.cases.map((c) => ({ id: c.id, ...replay(c) }));
assert.equal(results[0].state.outcome.status, "crashed");
assert.equal(results[0].state.frames, 288);
assert.equal(results[0].rendered, 709);
assert.equal(results[0].state.seed, 28211);
assert.throws(
  () => replay(inputs.cases[0], true),
  /original visible strip guard/,
);
assert.throws(
  () => replay({ ...inputs.cases[0], events: [] }),
  /assertion|false|true/i,
);
console.log(
  "Flight boundary independent replay: 2 carried cases; all25 inputs consumed; first flight completes, second reaches declared flying endpoint; every presented frame rasterized; old guard and missing-input controls rejected.",
);
