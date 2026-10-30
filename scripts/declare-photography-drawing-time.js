// Fixture producer: expected outputs only. Never rewrites the historical
// manifest or turns observed clock endpoints into scheduling inputs.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import {
  historicalPhotography,
  replayPhotographyComponent,
  comparePhotographyComponents,
  sha,
  PHOTO_BASELINE,
} from "./photography-component-replay.js";
const target = process.argv[2] ?? "reference/photography-drawing-time.json";
assert.ok(process.argv.length <= 3, "Unexpected fixture producer arguments");
try {
  await readFile(target);
  throw Error("Refuse to overwrite drawing-time expectations");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const oldBytes = await readFile("reference/photography-runtime.json"),
  old = JSON.parse(oldBytes),
  build = JSON.parse(await readFile("reference/build.json"));
async function original(name) {
  const b = await readFile(`game/${name}`);
  assert.equal(sha(b), build.files[name].sha256);
  return b;
}
const resources = {
  image: unpackImage(await original("DUCKTALE.EXE")),
  entries: parseArchive(await original("PS.ARC")),
  mainEntries: parseArchive(await original("MAIN.ARC")),
};
const historical = await historicalPhotography();
const fixture = {
  id: "photography-source-drawing-time-regression",
  acceptanceLevel: "port-cross-version-regression",
  wholeOriginalTimingAcceptance: false,
  parent: { path: "reference/photography-runtime.json", sha256: sha(oldBytes) },
  historicalRevision: PHOTO_BASELINE,
  dependencyGraph: historical.graph,
  expectedCaseCount: 22,
  expectedReplayCount: 4,
  expectedResourceCount: 18,
  injections: [],
  fittedInputs: [],
  clockExclusions: [
    [0x2221, 0x2229],
    [0x27f8, 0x27fc],
  ],
  cases: [],
};
for (const [index, scenario] of [
  ...old.replays,
  ...old.resourceCoverage,
].entries()) {
  const prior = replayPhotographyComponent({
      resources,
      scenario,
      PhotographyClass: historical.Photography,
    }),
    current = replayPhotographyComponent({ resources, scenario });
  comparePhotographyComponents(
    current,
    prior,
    scenario.id ?? `resource${index - 4}`,
  );
  fixture.cases.push({
    id: scenario.id ?? `resource${index - 4}`,
    historicalEvents: prior.timing.final.events,
    expected: current.timing,
  });
  console.log(
    fixture.cases.at(-1).id,
    current.timing.boundaries,
    current.timing.presentations,
  );
}
assert.equal(fixture.cases.length, 22);
await writeFile(target, JSON.stringify(fixture, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  "Declared22 new drawing-time outputs; all full source-boundary memories except12 clock bytes,locals,gameplay and ordered images/modes/wipes match historical class.",
);
