// Native drawing-boundary work migration. Historical expectations stay intact.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { parseArchive } from "../src/assets.js";
import { FlightMemory } from "../src/game/flight-physics.js";
import { jungleWorkEffects } from "../src/game/jungle-work.js";
import { presentJungleFrame } from "../src/game/jungle-presentation.js";
import { jungleSceneResources } from "../src/game/jungle-scene.js";
import { normalCoreGraphicsMilliseconds } from "../src/game/ega-work.js";
import { verifyJunglePresentation } from "./verify-jungle-presentation.js";
const sha = (b) => createHash("sha256").update(b).digest("hex");
execFileSync(process.execPath, ["scripts/verify-ega-lines.js"], {
  stdio: "inherit",
});
const prior = JSON.parse(await readFile("reference/jungle-draw-work.json"));
assert.equal(prior.expectedCaseCount, 6);
for (const [p, h] of Object.entries(prior.sources))
  if (p !== "src/game/jungle-work.js")
    assert.equal(
      sha(await readFile(p)),
      h,
      `Changed historical dependency ${p}`,
    );
const historical = execFileSync("git", [
  "show",
  "a20ca90:src/game/jungle-work.js",
]);
assert.equal(sha(historical), prior.sources["src/game/jungle-work.js"]);
const source = historical
  .toString()
  .replace(
    /from "(\.[^"]+)"/g,
    (_, p) => `from "${pathToFileURL(resolve("src/game", p)).href}"`,
  );
const oldEffects = (
  await import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  )
).jungleWorkEffects;
const parentBytes = await readFile(prior.parent.path);
assert.equal(sha(parentBytes), prior.parent.sha256);
const parent = JSON.parse(parentBytes),
  build = JSON.parse(await readFile("reference/build.json"));
const files = {};
for (const name of ["DUCKTALE.EXE", "JG.ARC", "MAIN.ARC", "MT.ARC", "IT.DRV"]) {
  const b = await readFile(`game/${name}`);
  assert.equal(sha(b), build.files[name].sha256);
  files[name] = b;
}
const resources = {
  executableRaw: files["DUCKTALE.EXE"],
  entries: parseArchive(files["JG.ARC"]),
  mainEntries: parseArchive(files["MAIN.ARC"]),
  mountainEntries: parseArchive(files["MT.ARC"]),
  driverEntries: parseArchive(files["IT.DRV"]),
};
await verifyJunglePresentation(resources);
const scene = jungleSceneResources(
  resources.entries,
  resources.mainEntries,
  resources.mountainEntries,
);
const lineContract = JSON.parse(
  await readFile("reference/ega-line-runtime-work.json"),
);
const reportBytes = await readFile(lineContract.jungleAnalysis.path);
assert.equal(sha(reportBytes), lineContract.jungleAnalysis.sha256);
const rows = JSON.parse(reportBytes).rows;
assert.equal(rows.length, 6);
async function initial(id) {
  const spec = parent.artifacts[`${id}-before`],
    b = await readFile(spec.path);
  assert.equal(sha(b), spec.sha256);
  const r = JSON.parse(JSON.parse(b).content[0].text);
  assert.equal(r.aborted, false);
  assert.ok(r.results.every((r) => r.status === "ok"));
  return {
    bytes: Buffer.from(r.results[1].data, "base64"),
    color: Buffer.from(r.results[2].data, "base64")[0],
  };
}
const initials = await Promise.all(prior.cases.map((c) => initial(c.id)));
function compare(fault = null) {
  let checked = 0,
    lineCalls = 0;
  for (let i = 0; i < 6; i++) {
    const expected = prior.cases[i],
      row = rows[i];
    assert.equal(expected.id, row.case);
    const recorded = [];
    function run(adapter) {
      const memory = new FlightMemory(initials[i].bytes);
      let lines = 0;
      const sink = {
        color: initials[i].color,
        draw() {},
        copy() {},
        line(c) {
          lines++;
          recorded.push(c);
        },
        text() {},
        wait() {
          assert.fail("Unexpected drawing wait");
        },
        sound() {
          assert.fail("Unexpected sound");
        },
      };
      const { effects, work } = adapter(memory, scene, sink);
      presentJungleFrame(memory, effects);
      return {
        work,
        bytes: memory.bytes ?? new Uint8Array(memory.view.buffer),
        lines,
        color: effects.color,
      };
    }
    const before = run(oldEffects),
      after = run(jungleWorkEffects);
    assert.deepEqual(before.work, expected.work, "Historical work changed");
    const wanted = {
      ...expected.work,
      instructions: expected.work.instructions + row.instructions,
      portWrites: expected.work.portWrites + row.portWrites,
      lines: row.lineCalls,
      lineInstructions: row.instructions,
      linePortWrites: row.portWrites,
      omittedLines: 0,
    };
    if (fault === "omit-line" && i === 0)
      after.work.instructions -= row.instructions;
    if (fault === "omit-out" && i === 0) after.work.portWrites--;
    if (fault === "double-line" && i === 0) after.work.lines++;
    assert.deepEqual(after.work, wanted, `Jungle line work ${expected.id}`);
    assert.deepEqual(before.bytes, after.bytes, "Drawing changed game state");
    assert.equal(after.color, before.color);
    assert.equal(after.lines, row.lineCalls, "Unconsumed lines");
    assert.deepEqual(
      recorded.slice(0, before.lines),
      recorded.slice(before.lines),
      "Line commands changed",
    );
    const added =
      normalCoreGraphicsMilliseconds(after.work, 3000) -
      normalCoreGraphicsMilliseconds(before.work, 3000);
    assert.ok(
      Math.abs(added - row.milliseconds) < 1e-12,
      "Incorrect line budget",
    );
    checked++;
    lineCalls += after.lines;
  }
  assert.equal(checked, 6);
  assert.equal(lineCalls, 60);
}
compare();
for (const fault of ["omit-line", "omit-out", "double-line"])
  assert.throws(() => compare(fault), /Jungle line work/);
console.log(
  "Jungle line integration:6 original drawing boundaries,60 line calls;historical sprite/copy work retained,all line costs added,commands/state/color unchanged;3 migration negatives. No whole-level timing parity claim.",
);
