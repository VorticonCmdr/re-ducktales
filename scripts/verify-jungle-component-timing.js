import { verifyJungleInputBridge } from "./verify-jungle-input-bridge.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  sha,
  historicalJungle,
  replayJungleComponent,
  compareJungleMemory,
  gameplaySnapshot,
  CLOCK_RANGES,
  BASELINE_REVISION,
  jungleComponentResources,
} from "./jungle-component-replay.js";
export const SCENARIOS = {
  runtime: {
    fixture: "reference/jungle-component-drawing-time.json",
    parent: "reference/jungle-runtime.json",
    inputs: 824,
    images: 875,
    historicalEvents: 6405,
    currentEvents: 9187,
  },
  treasure: {
    fixture: "reference/jungle-treasure-drawing-time.json",
    parent: "reference/jungle-treasure.json",
    inputs: 792,
    images: 839,
    historicalEvents: 6026,
    currentEvents: 8795,
  },
};
const json = async (path) => {
  try {
    return JSON.parse(await readFile(path));
  } catch (error) {
    if (error.code === "ENOENT")
      throw Error(`SETUP: missing ${path}; see docs/jungle-timing.md`);
    throw error;
  }
};
export function flattenCheckpoint(point) {
  if (!point.state) return point;
  assert.deepEqual(
    Object.keys(point).sort(),
    ["inputCount", "memorySha256", "pixelSha256", "state"],
    "Unknown historical checkpoint layout",
  );
  return {
    inputCount: point.inputCount,
    ...point.state,
    memorySha256: point.memorySha256,
    pixelSha256: point.pixelSha256,
  };
}
export function checkpointGameplay(point) {
  point = flattenCheckpoint(point);
  const { inputCount, memorySha256, pixelSha256, ...snapshot } = point;
  return { inputCount, ...gameplaySnapshot(snapshot) };
}
export function checkpointTiming(point) {
  point = flattenCheckpoint(point);
  const { inputCount, tick, retrace, presentations, drawingWork } = point;
  return { inputCount, tick, retrace, presentations, drawingWork };
}
export async function baselineJungleReplay(
  resources,
  parent,
  profile = SCENARIOS.runtime,
) {
  const historical = await historicalJungle();
  const polls = [],
    images = [];
  const baseline = replayJungleComponent({
    resources,
    manifest: parent,
    JungleClass: historical.Jungle,
    onPoll: (p) => polls.push(p.bytes),
    onPresentation: (p) => images.push(p),
    onCheckpoint: (p) =>
      assert.deepEqual(
        p,
        flattenCheckpoint(
          parent.checkpoints.find((c) => c.inputCount === p.inputCount),
        ),
        "Historical jungle checkpoint changed",
      ),
  });
  assert.equal(baseline.expectedInputCount, profile.inputs);
  assert.equal(baseline.events, profile.historicalEvents);
  assert.equal(baseline.presentations, profile.images);
  assert.deepEqual(
    baseline.checkpoints,
    parent.checkpoints.map(flattenCheckpoint),
  );
  assert.deepEqual(baseline.final, parent.final);
  if (parent.finalMemorySha256)
    assert.equal(
      sha(baseline.finalMemory),
      parent.finalMemorySha256,
      "Historical final DS",
    );
  assert.equal(polls.length, profile.inputs);
  assert.equal(images.length, profile.images);
  return { ...historical, baseline, polls, images };
}
export function compareCurrentJungle(
  resources,
  parent,
  fixture,
  old,
  fault = null,
  profile = SCENARIOS.runtime,
) {
  assert.equal(
    fixture.expectedCheckpointCount,
    20,
    "Missing jungle timing checkpoints",
  );
  assert.equal(
    fixture.checkpoints.length,
    20,
    "Missing jungle timing checkpoints",
  );
  let pollCount = 0,
    imageCount = 0,
    checkpointCount = 0;
  const stream = parent.inputEvents.flatMap((e) => Array(e.count).fill(e.byte));
  if (fault === "missing-input") stream.pop();
  if (fault === "extra-input") stream.push(0);
  if (fault === "missing-climb")
    for (let i = 0; i < stream.length; i++) if (stream[i] === 1) stream[i] = 0;
  const current = replayJungleComponent({
    resources,
    manifest: parent,
    inputStream: stream,
    omitFire: fault === "missing-fire",
    mutateObservation(observation) {
      if (observation.kind === "poll" && observation.inputCount === 4) {
        if (fault === "rng") observation.bytes[0x2229] ^= 1;
        if (fault === "page") observation.bytes[0xa407] ^= 2;
        if (fault === "clock") observation.bytes[0x2221] ^= 1;
      }
      if (
        fault === "image" &&
        observation.kind === "presentation" &&
        observation.point.index === 1
      )
        observation.point.sha256 = "0".repeat(64);
    },
    onPoll({ inputCount, bytes }) {
      assert.equal(inputCount, ++pollCount, "Skipped jungle poll");
      assert.ok(old.polls[inputCount - 1], "Unexpected jungle poll");
      compareJungleMemory(
        bytes,
        old.polls[inputCount - 1],
        `Jungle input ${inputCount}`,
      );
    },
    onPresentation(point) {
      assert.equal(point.index, ++imageCount, "Skipped image checkpoint");
      assert.deepEqual(
        point,
        old.images[point.index - 1],
        `Jungle image ${point.index}`,
      );
    },
    onCheckpoint(point) {
      const expected = parent.checkpoints[checkpointCount];
      assert.ok(expected, "Unexpected jungle checkpoint");
      assert.deepEqual(
        checkpointGameplay(point),
        checkpointGameplay(expected),
        `Jungle gameplay checkpoint ${checkpointCount}`,
      );
      assert.deepEqual(
        checkpointTiming(point),
        fixture.checkpoints[checkpointCount],
        `Jungle timing checkpoint ${checkpointCount}`,
      );
      checkpointCount++;
    },
  });
  assert.equal(pollCount, profile.inputs, "Unfinished jungle polls");
  assert.equal(imageCount, profile.images, "Unfinished jungle images");
  assert.equal(checkpointCount, 20, "Unfinished jungle checkpoints");
  assert.equal(
    current.events,
    fixture.expectedClockEventCount,
    "Jungle clock event count",
  );
  assert.equal(current.presentations, fixture.expectedPresentationCount);
  assert.equal(
    current.clockTraceSha256,
    fixture.clockTraceSha256,
    "Jungle timer trace",
  );
  assert.equal(
    current.presentationTimingSha256,
    fixture.presentationTimingSha256,
    "Jungle presentation timing trace",
  );
  assert.deepEqual(
    gameplaySnapshot(current.final),
    gameplaySnapshot(parent.final),
    "Jungle final gameplay",
  );
  assert.deepEqual(
    {
      ...checkpointTiming({ inputCount: profile.inputs, ...current.final }),
      clockWords: current.finalClockWords,
    },
    fixture.finalTiming,
    "Jungle final timing",
  );
  compareJungleMemory(
    current.finalMemory,
    old.baseline.finalMemory,
    "Jungle final memory",
  );
  return current;
}
export async function verifyJungleComponentTiming(
  resources,
  scenario = "runtime",
) {
  const profile = SCENARIOS[scenario];
  assert.ok(profile, "Unknown jungle timing scenario");
  const fixture = await json(profile.fixture);
  assert.equal(fixture.acceptanceLevel, "closed-loop-port-regression");
  assert.equal(fixture.historicalRevision, BASELINE_REVISION);
  assert.equal(fixture.expectedInputCount, profile.inputs);
  assert.equal(fixture.expectedPresentationCount, profile.images);
  assert.equal(fixture.expectedClockEventCount, profile.currentEvents);
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
  assert.deepEqual(Object.keys(fixture.runtimeSources).sort(), [
    "src/game/ega-work.js",
    "src/game/jungle-work.js",
    "src/game/jungle.js",
    "src/game/timing.js",
  ]);
  assert.match(fixture.producerRevision, /^[a-f0-9]{40}$/);
  try {
    execFileSync(
      "git",
      ["cat-file", "-e", `${fixture.producerRevision}^{commit}`],
      { stdio: "pipe" },
    );
  } catch {
    throw Error(
      `SETUP: missing fixture producer revision ${fixture.producerRevision}`,
    );
  }

  assert.equal(fixture.parent.path, profile.parent);
  const parentBytes = await readFile(fixture.parent.path);
  assert.equal(
    sha(parentBytes),
    fixture.parent.sha256,
    "Changed historical jungle fixture",
  );
  const parent = JSON.parse(parentBytes);
  assert.equal(
    sha(await readFile(parent.buildManifest)),
    fixture.buildManifestSha256,
  );
  // Preserve exact old source identities through a complete no-exclusion
  // cross-version comparison before checking the unchanged timing contracts.
  await verifyJungleInputBridge(resources);
  const old = await baselineJungleReplay(resources, parent, profile);
  assert.deepEqual(
    old.graph,
    fixture.historicalSourceGraph,
    "Changed historical source graph",
  );
  const current = compareCurrentJungle(
    resources,
    parent,
    fixture,
    old,
    null,
    profile,
  );
  const negativeCases = [
    ["missing-fire", /Jungle gameplay checkpoint 1/],
    ["rng", /Jungle input 4: DS 2229/],
    ["page", /Jungle input 4: DS a407/],
    ["clock", /Jungle timer trace/],
    ["image", /Jungle image 1/],
    ["missing-input", /Unfinished jungle input stream/],
    ["extra-input", /Unconsumed jungle input events/],
  ];
  if (scenario === "treasure")
    negativeCases.push([
      "missing-climb",
      /Jungle (input \d+: DS|image \d+|gameplay checkpoint \d+)/,
    ]);
  for (const [fault, reason] of negativeCases)
    assert.throws(
      () =>
        compareCurrentJungle(resources, parent, fixture, old, fault, profile),
      reason,
    );
  const missing = structuredClone(fixture);
  missing.checkpoints.pop();
  assert.throws(
    () => compareCurrentJungle(resources, parent, missing, old, null, profile),
    /Missing jungle timing checkpoints/,
  );
  console.log(
    `Jungle ${scenario} drawing-time regression:${profile.inputs} exact source-boundary DS comparisons except three separately checked timer words,${profile.images} identical ordered image payloads,20 unchanged gameplay checkpoints;${current.events} current clock events;historical${profile.historicalEvents}-event/20-checkpoint contract preserved;${negativeCases.length + 1} negative controls. Port regression,not native whole-level timing parity.`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  for (const scenario of Object.keys(SCENARIOS))
    await verifyJungleComponentTiming(
      await jungleComponentResources(),
      scenario,
    );
