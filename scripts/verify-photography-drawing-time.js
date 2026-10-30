import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parseArchive } from "../src/assets.js";
import { unpackImage } from "../src/game/executable.js";
import {
  historicalPhotography,
  replayPhotographyComponent,
  comparePhotographyComponents,
  sha,
  PHOTO_BASELINE,
} from "./photography-component-replay.js";
export async function verifyPhotographyDrawingRegression(resources, parent) {
  const m = JSON.parse(
    await readFile("reference/photography-drawing-time.json").catch(() => {
      throw Error(
        "SETUP: missing photography drawing-time expectations;see docs/photography-timing.md",
      );
    }),
  );
  assert.equal(m.acceptanceLevel, "port-cross-version-regression");
  assert.equal(m.wholeOriginalTimingAcceptance, false);
  assert.equal(m.historicalRevision, PHOTO_BASELINE);
  assert.equal(m.expectedCaseCount, 22);
  assert.equal(m.expectedReplayCount, 4);
  assert.equal(m.expectedResourceCount, 18);
  assert.equal(m.parent.path, "reference/photography-runtime.json");
  assert.equal(sha(await readFile(m.parent.path)), m.parent.sha256);
  assert.deepEqual(m.injections, []);
  assert.deepEqual(m.fittedInputs, []);
  assert.deepEqual(m.clockExclusions, [
    [0x2221, 0x2229],
    [0x27f8, 0x27fc],
  ]);
  const historical = await historicalPhotography();
  assert.deepEqual(historical.graph, m.dependencyGraph);
  const scenarios = [...parent.replays, ...parent.resourceCoverage];
  assert.equal(parent.replays.length, 4);
  assert.equal(parent.resourceCoverage.length, 18);
  assert.equal(m.cases.length, 22);
  assert.equal(scenarios.length, 22);
  let boundaries = 0,
    pictures = 0,
    first;
  function exact(current, expected) {
    assert.deepEqual(
      current.timing,
      expected.expected,
      "Changed photography drawing-time outputs",
    );
  }
  for (const [i, scenario] of scenarios.entries()) {
    const id = scenario.id ?? `resource${i - 4}`;
    assert.equal(m.cases[i].id, id);
    const previous = replayPhotographyComponent({
      resources,
      scenario,
      PhotographyClass: historical.Photography,
    });
    const current = replayPhotographyComponent({ resources, scenario });
    assert.equal(previous.timing.final.events, m.cases[i].historicalEvents);
    comparePhotographyComponents(current, previous, id);
    exact(current, m.cases[i]);
    boundaries += current.boundaries.length;
    pictures += current.presentations.length;
    if (i === 0) first = { scenario, previous, current };
  }
  assert.ok(boundaries > 0 && pictures > 0);
  let negatives = 0;
  for (const mutation of ["rng", "picture", "mode", "omitPicture"]) {
    const changed = replayPhotographyComponent({
      resources,
      scenario: first.scenario,
      mutation,
    });
    assert.throws(
      () =>
        comparePhotographyComponents(
          changed,
          first.previous,
          "negative " + mutation,
        ),
      assert.AssertionError,
    );
    negatives++;
  }
  for (const mutation of ["removeInput", "extraInput"]) {
    assert.throws(
      () =>
        replayPhotographyComponent({
          resources,
          scenario: first.scenario,
          mutation,
        }),
      /Invalid photography joystick provider|Unconsumed required photography input/,
    );
    negatives++;
  }
  const wrong = structuredClone(m.cases[0]);
  wrong.expected.final.state.tick++;
  assert.throws(
    () => exact(first.current, wrong),
    /Changed photography drawing-time outputs/,
  );
  negatives++;
  const badClock = structuredClone(m.cases[0]);
  badClock.expected.clockTrace = "changed";
  assert.throws(
    () => exact(first.current, badClock),
    /Changed photography drawing-time outputs/,
  );
  negatives++;
  assert.equal(negatives, 8);
  console.log(
    `Photography drawing-time regression:22 cases,${boundaries} full source-boundary DS comparisons except12 separately checked clock bytes,${pictures} ordered image/mode/wipe comparisons;8 negative controls. Historical contracts preserved;not native whole-level timing parity.`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const build = JSON.parse(await readFile("reference/build.json"));
  async function original(name) {
    let b;
    try {
      b = await readFile(`game/${name}`);
    } catch {
      throw Error(`SETUP: missing game/${name}`);
    }
    assert.equal(sha(b), build.files[name].sha256);
    return b;
  }
  const resources = {
    image: unpackImage(await original("DUCKTALE.EXE")),
    entries: parseArchive(await original("PS.ARC")),
    mainEntries: parseArchive(await original("MAIN.ARC")),
  };
  await verifyPhotographyDrawingRegression(
    resources,
    JSON.parse(await readFile("reference/photography-runtime.json")),
  );
}
