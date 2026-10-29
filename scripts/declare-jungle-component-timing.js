// Author a NEW port regression contract. Never replace the historical baseline.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  sha,
  jungleComponentResources,
  replayJungleComponent,
  compareJungleMemory,
  gameplaySnapshot,
  CLOCK_RANGES,
  BASELINE_REVISION,
} from "./jungle-component-replay.js";
import {
  baselineJungleReplay,
  checkpointGameplay,
  checkpointTiming,
  SCENARIOS,
} from "./verify-jungle-component-timing.js";
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "SETUP: commit producer before declaring fixture",
);
execFileSync(process.execPath, ["scripts/verify-jungle-work.js"], {
  stdio: "inherit",
});
const scenarios = process.argv[2] ? [process.argv[2]] : Object.keys(SCENARIOS);
for (const scenario of scenarios) {
  const profile = SCENARIOS[scenario];
  assert.ok(profile, "SETUP: choose runtime or treasure");
  const parentPath = profile.parent,
    parentBytes = await readFile(parentPath);
  const parent = JSON.parse(parentBytes),
    resources = await jungleComponentResources();
  const old = await baselineJungleReplay(resources, parent, profile);
  let polls = 0,
    images = 0,
    checkpoints = 0;
  const current = replayJungleComponent({
    resources,
    manifest: parent,
    onPoll(p) {
      compareJungleMemory(
        p.bytes,
        old.polls[p.inputCount - 1],
        `Authoring input ${p.inputCount}`,
      );
      polls++;
    },
    onPresentation(p) {
      assert.deepEqual(
        p,
        old.images[p.index - 1],
        `Authoring image ${p.index}`,
      );
      images++;
    },
    onCheckpoint(p) {
      assert.deepEqual(
        checkpointGameplay(p),
        checkpointGameplay(parent.checkpoints[checkpoints++]),
      );
    },
  });
  assert.deepEqual(
    [polls, images, checkpoints, current.events],
    [profile.inputs, profile.images, 20, profile.currentEvents],
  );
  compareJungleMemory(
    current.finalMemory,
    old.baseline.finalMemory,
    "Authoring final",
  );
  assert.deepEqual(
    gameplaySnapshot(current.final),
    gameplaySnapshot(parent.final),
  );
  const paths = [
    "src/game/jungle.js",
    "src/game/jungle-work.js",
    "src/game/ega-work.js",
    "src/game/timing.js",
  ];
  const fixture = {
    id: `jungle-${scenario}-original-drawing-time`,
    acceptanceLevel: "closed-loop-port-regression",
    producerRevision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    parent: { path: parentPath, sha256: sha(parentBytes) },
    historicalRevision: BASELINE_REVISION,
    historicalSourceGraph: old.graph,
    buildManifestSha256: sha(await readFile(parent.buildManifest)),
    expectedInputCount: profile.inputs,
    expectedPresentationCount: profile.images,
    expectedCheckpointCount: 20,
    expectedClockEventCount: profile.currentEvents,
    clockProvider: parent.clockProvider,
    memoryClockRanges: CLOCK_RANGES,
    injections: [],
    fittedInputs: [],
    partialRestore: false,
    runtimeSources: Object.fromEntries(
      await Promise.all(paths.map(async (p) => [p, sha(await readFile(p))])),
    ),
    inputContract: `Unchanged parent authored${profile.inputs}-byte stream,consumed at successive source input reads. Independent zero-phase driver/retrace schedule;driver wins ties. No expected timer,state or image supplies a scheduling input.`,
    startingRecipe:
      "Load authoritative static executable data and archives with parent campaign options. Load only the historical Jungle class from the declared Git revision;verify every shared dependency byte against that revision. Reproduce all20 original historical full snapshots/memory/image hashes and final state before comparing current logic.",
    comparisonRules: `At all${profile.inputs} source readInput boundaries and final outcome,all65536 DS bytes compare exactly to the validated historical replay except2221..2228(two32-bit timer words) and27f8..27fb(next deadline). These timers are independently checked by the exact current clock-trace digest and20 timing checkpoints. All${profile.images} presentation payload hashes compare exactly by publication order;their separate timing trace is exact. All20 gameplay snapshots/final values remain exact. No page-selector or RNG exclusion;no skipped input/image/checkpoint allowed.`,
    expectedOutputsScope:
      "New timing outputs recorded once from the declared producer. Port regression expectations,not original elapsed-time captures and never consumed as inputs. Native drawing evidence remains a separate six-case comparison.",
    clockTraceSha256: current.clockTraceSha256,
    presentationTimingSha256: current.presentationTimingSha256,
    checkpoints: current.checkpoints.map(checkpointTiming),
    finalTiming: {
      ...checkpointTiming({ inputCount: profile.inputs, ...current.final }),
      clockWords: current.finalClockWords,
    },
    limitations: [
      "Cross-version port regression does not prove native whole-level timing or full scanout parity.",
      "Presentation payloads include alpha wipe masks;their sequence comparison does not replace independent browser canvas checks. Constructor publication is observed at time zero;all subsequent source publications are observed individually,including multiple within one clock event.",
      "Historical Git revision and unchanged transitive dependencies are required;missing history is a setup failure.",
      "Line,text,caller/interrupt and remaining-slice I/O costs are still omitted.",
    ],
    verify: "node scripts/verify-jungle-component-timing.js",
  };
  await writeFile(profile.fixture, JSON.stringify(fixture, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    "Declared new component timing contract; historical fixture unchanged; independent verification pending.",
  );
}
