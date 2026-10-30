// New line-inclusive port timing contracts; old scenarios stay authoritative.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  sha,
  jungleComponentResources,
  replayJungleComponent,
  compareJungleMemory,
  CLOCK_RANGES,
  BASELINE_REVISION,
  gameplaySnapshot,
} from "./jungle-component-replay.js";
import {
  baselineJungleReplay,
  checkpointGameplay,
  checkpointTiming,
  compareCurrentJungle,
} from "./verify-jungle-component-timing.js";
import { verifyPreLine } from "./jungle-line-replay.js";
const profiles = {
  runtime: {
    fixture: "reference/jungle-runtime-line-time.json",
    parent: "reference/jungle-runtime.json",
    preLine: "reference/jungle-component-drawing-time.json",
    inputs: 824,
    images: 875,
    historicalEvents: 6405,
    currentEvents: 9297,
  },
  treasure: {
    fixture: "reference/jungle-treasure-line-time.json",
    parent: "reference/jungle-treasure.json",
    preLine: "reference/jungle-treasure-drawing-time.json",
    inputs: 792,
    images: 839,
    historicalEvents: 6026,
    currentEvents: 8881,
  },
};
const runtimePaths = [
  "src/game/jungle.js",
  "src/game/jungle-work.js",
  "src/game/ega-line-work.js",
  "src/game/ega-work.js",
  "src/game/timing.js",
];
const toolPaths = [
  "scripts/jungle-line-timing.js",
  "scripts/jungle-line-replay.js",
  "scripts/jungle-component-replay.js",
  "scripts/verify-jungle-component-timing.js",
  "scripts/verify-jungle-line-work.js",
  "reference/ega-line-runtime-work.json",
];
const declare = process.argv.includes("--declare");
const selected = process.argv
  .find((a) => a.startsWith("--scenario="))
  ?.slice(11);
if (declare)
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    "",
    "SETUP: commit clean producer before declaring new timing expectations",
  );
execFileSync(process.execPath, ["scripts/verify-jungle-line-work.js"], {
  stdio: "inherit",
});
const resources = await jungleComponentResources();
for (const name of selected ? [selected] : Object.keys(profiles)) {
  const profile = profiles[name];
  assert.ok(profile, "Unknown line-timing scenario");
  const parentBytes = await readFile(profile.parent),
    parent = JSON.parse(parentBytes),
    preLineBytes = await readFile(profile.preLine);
  const old = await baselineJungleReplay(resources, parent, profile);
  const preLine = await verifyPreLine(
    resources,
    parent,
    profile.preLine,
    profile,
  );
  let fixture;
  if (declare) {
    let polls = 0,
      images = 0,
      points = 0;
    const now = replayJungleComponent({
      resources,
      manifest: parent,
      onPoll(p) {
        compareJungleMemory(
          p.bytes,
          old.polls[p.inputCount - 1],
          `Declare input${p.inputCount}`,
        );
        polls++;
      },
      onPresentation(p) {
        assert.deepEqual(p, old.images[p.index - 1]);
        images++;
      },
      onCheckpoint(p) {
        assert.deepEqual(
          checkpointGameplay(p),
          checkpointGameplay(parent.checkpoints[points++]),
        );
      },
    });
    assert.deepEqual(
      [polls, images, points, now.events],
      [profile.inputs, profile.images, 20, profile.currentEvents],
    );
    compareJungleMemory(
      now.finalMemory,
      old.baseline.finalMemory,
      "Declare final",
    );
    assert.deepEqual(
      gameplaySnapshot(now.final),
      gameplaySnapshot(parent.final),
    );
    fixture = {
      id: `jungle-${name}-line-inclusive-time`,
      acceptanceLevel: "closed-loop-port-regression",
      producerRevision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      parent: { path: profile.parent, sha256: sha(parentBytes) },
      preLineFixture: { path: profile.preLine, sha256: sha(preLineBytes) },
      historicalRevision: BASELINE_REVISION,
      historicalSourceGraph: old.graph,
      preLineRevision: preLine.revision,
      preLineSourceGraph: preLine.graph,
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
        await Promise.all(
          runtimePaths.map(async (p) => [p, sha(await readFile(p))]),
        ),
      ),
      verificationSources: Object.fromEntries(
        await Promise.all(
          toolPaths.map(async (p) => [p, sha(await readFile(p))]),
        ),
      ),
      inputContract:
        "Unchanged historical authored byte stream consumed at successive source input reads;independent zero-phase driver/retrace schedule,driver-first ties. Expected state,timers and pixels never choose inputs.",
      comparisonRules:
        "All source-boundary DS bytes and final memory exact except three independently checked timer words;all ordered images and20 gameplay checkpoints exact. Current clocks/presentation timing separately exact. Pre-line historical clocks/images/state reproduced by frozen archived source. No new exclusions.",
      clockTraceSha256: now.clockTraceSha256,
      presentationTimingSha256: now.presentationTimingSha256,
      checkpoints: now.checkpoints.map(checkpointTiming),
      finalTiming: {
        ...checkpointTiming({ inputCount: profile.inputs, ...now.final }),
        clockWords: now.finalClockWords,
      },
      limitations: [
        "Port regression,not original whole-level cadence or scanout parity.",
        "Line primitive work is included;resident dispatch/color,text,IRQ and remaining CPU/device costs are omitted.",
        "Browser acceptance and full campaign are separate gates.",
      ],
      verify: "node scripts/jungle-line-timing.js",
    };
    await writeFile(profile.fixture, JSON.stringify(fixture, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(
      `Declared NEW ${name} line timing from clean${fixture.producerRevision};independent acceptance pending.`,
    );
  } else {
    fixture = JSON.parse(await readFile(profile.fixture));
    assert.equal(fixture.id, `jungle-${name}-line-inclusive-time`);
    assert.equal(fixture.acceptanceLevel, "closed-loop-port-regression");
    assert.deepEqual(fixture.parent, {
      path: profile.parent,
      sha256: sha(parentBytes),
    });
    assert.deepEqual(fixture.preLineFixture, {
      path: profile.preLine,
      sha256: sha(preLineBytes),
    });
    assert.deepEqual(fixture.historicalSourceGraph, old.graph);
    assert.deepEqual(fixture.preLineSourceGraph, preLine.graph);
    assert.equal(fixture.preLineRevision, preLine.revision);
    assert.equal(fixture.historicalRevision, BASELINE_REVISION);
    assert.equal(fixture.expectedInputCount, profile.inputs);
    assert.equal(fixture.expectedPresentationCount, profile.images);
    assert.equal(fixture.expectedClockEventCount, profile.currentEvents);
    assert.equal(fixture.expectedCheckpointCount, 20);
    assert.deepEqual(fixture.memoryClockRanges, CLOCK_RANGES);
    assert.deepEqual(fixture.injections, []);
    assert.deepEqual(fixture.fittedInputs, []);
    assert.equal(fixture.partialRestore, false);
    assert.deepEqual(fixture.clockProvider, {
      driverNumerator: 1193182,
      driverDivisors: [1365, 12],
      retraceHz: 70.086,
      tieOrder: "driver-first",
    });
    assert.deepEqual(
      Object.keys(fixture.runtimeSources).sort(),
      [...runtimePaths].sort(),
    );
    for (const [p, h] of Object.entries(fixture.runtimeSources)) {
      assert.equal(
        sha(await readFile(p)),
        h,
        `Changed line timing source ${p}`,
      );
      assert.equal(
        sha(execFileSync("git", ["show", `${fixture.producerRevision}:${p}`])),
        h,
        `Producer source differs ${p}`,
      );
    }
    for (const [p, h] of Object.entries(fixture.verificationSources))
      assert.equal(
        sha(await readFile(p)),
        h,
        `Changed line timing verifier ${p}`,
      );
    compareCurrentJungle(resources, parent, fixture, old, null, profile);
    const faults = [
      ["missing-fire", /Jungle gameplay checkpoint 1/],
      ["rng", /Jungle input 4: DS 2229/],
      ["page", /Jungle input 4: DS a407/],
      ["clock", /Jungle timer trace/],
      ["image", /Jungle image 1/],
      ["missing-input", /Unfinished jungle input stream/],
      ["extra-input", /Unconsumed jungle input events/],
      ...(name === "treasure"
        ? [
            [
              "missing-climb",
              /Jungle (input \d+: DS|image \d+|gameplay checkpoint \d+)/,
            ],
          ]
        : []),
    ];
    for (const [fault, pattern] of faults)
      assert.throws(
        () =>
          compareCurrentJungle(resources, parent, fixture, old, fault, profile),
        pattern,
      );
    const missing = structuredClone(fixture);
    missing.checkpoints.pop();
    assert.throws(
      () =>
        compareCurrentJungle(resources, parent, missing, old, null, profile),
      /Missing jungle timing checkpoints/,
    );
    console.log(
      `${name} line timing: ${profile.inputs} carried inputs,${profile.images} ordered images,20 gameplay/timer checkpoints,${profile.currentEvents} independent clock events;pre-line expectations preserved;${faults.length + 1} negative controls.`,
    );
  }
  assert.equal(sha(await readFile(profile.parent)), sha(parentBytes));
  assert.equal(sha(await readFile(profile.preLine)), sha(preLineBytes));
}
