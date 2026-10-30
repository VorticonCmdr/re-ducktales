// New text-inclusive contracts. Original, sprite/copy and line contracts remain
// unchanged; expected states never choose the input or device event providers.
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
  flattenCheckpoint,
  checkpointGameplay,
  checkpointTiming,
  compareCurrentJungle,
} from "./verify-jungle-component-timing.js";
import { frozenJungle } from "./jungle-text-replay.js";
const profiles = {
  runtime: {
    parent: "reference/jungle-runtime.json",
    preLine: "reference/jungle-component-drawing-time.json",
    line: "reference/jungle-runtime-line-time.json",
    fixture: "reference/jungle-runtime-text-time.json",
    inputs: 824,
    images: 875,
    historicalEvents: 6405,
  },
  treasure: {
    parent: "reference/jungle-treasure.json",
    preLine: "reference/jungle-treasure-drawing-time.json",
    line: "reference/jungle-treasure-line-time.json",
    fixture: "reference/jungle-treasure-text-time.json",
    inputs: 792,
    images: 839,
    historicalEvents: 6026,
  },
};
const declare = process.argv.includes("--declare"),
  selected = process.argv.find((a) => a.startsWith("--scenario="))?.slice(11);
if (declare)
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    "",
    "SETUP: commit clean source before declaring text timing",
  );
execFileSync(process.execPath, ["scripts/verify-jungle-text-work.js"], {
  stdio: "inherit",
});
const resources = await jungleComponentResources(),
  historical = await frozenJungle(BASELINE_REVISION),
  preLine = await frozenJungle("a20ca90"),
  line = await frozenJungle("f7baa4d");
const paths = [
  "src/game/jungle.js",
  "src/game/jungle-work.js",
  "src/game/jungle-presentation.js",
  "src/game/ega-text-work.js",
  "src/game/hud-number-work.js",
  "src/game/ega-line-work.js",
  "src/game/ega-work.js",
  "src/game/timing.js",
];
const tools = [
  "scripts/jungle-text-timing.js",
  "scripts/jungle-text-replay.js",
  "scripts/verify-jungle-text-work.js",
  "scripts/jungle-component-replay.js",
  "scripts/verify-jungle-component-timing.js",
  "reference/hud-number-work.json",
];
for (const name of selected ? [selected] : Object.keys(profiles)) {
  const p = profiles[name];
  assert.ok(p, "Unknown text timing scenario");
  const parentBytes = await readFile(p.parent),
    parent = JSON.parse(parentBytes),
    priorBytes = await readFile(p.preLine),
    prior = JSON.parse(priorBytes),
    lineBytes = await readFile(p.line),
    lineFixture = JSON.parse(lineBytes);
  const polls = [],
    images = [];
  const baseline = replayJungleComponent({
    resources,
    manifest: parent,
    JungleClass: historical.Jungle,
    onPoll: (o) => polls.push(o.bytes),
    onPresentation: (o) => images.push(o),
    onCheckpoint: (o) =>
      assert.deepEqual(
        o,
        flattenCheckpoint(
          parent.checkpoints.find((c) => c.inputCount === o.inputCount),
        ),
      ),
  });
  assert.equal(baseline.events, p.historicalEvents);
  assert.equal(polls.length, p.inputs);
  assert.equal(images.length, p.images);
  assert.deepEqual(baseline.final, parent.final);
  if (parent.finalMemorySha256)
    assert.equal(sha(baseline.finalMemory), parent.finalMemorySha256);
  const old = { ...historical, baseline, polls, images };
  for (const [source, fixture] of [
    [preLine, prior],
    [line, lineFixture],
  ]) {
    const r = replayJungleComponent({
      resources,
      manifest: parent,
      JungleClass: source.Jungle,
    });
    assert.equal(
      r.events,
      fixture.expectedClockEventCount,
      "Historical device count changed",
    );
    assert.equal(
      r.clockTraceSha256,
      fixture.clockTraceSha256,
      "Historical clock trace changed",
    );
    assert.equal(
      r.presentationTimingSha256,
      fixture.presentationTimingSha256,
      "Historical publication trace changed",
    );
    assert.deepEqual(
      r.checkpoints.map(checkpointTiming),
      fixture.checkpoints,
      "Historical text-free checkpoints changed",
    );
    assert.deepEqual(
      {
        ...checkpointTiming({ inputCount: p.inputs, ...r.final }),
        clockWords: r.finalClockWords,
      },
      fixture.finalTiming,
    );
  }
  if (declare) {
    let consumed = 0,
      presented = 0,
      checked = 0;
    const current = replayJungleComponent({
      resources,
      manifest: parent,
      onPoll(o) {
        assert.equal(o.inputCount, ++consumed);
        compareJungleMemory(
          o.bytes,
          polls[consumed - 1],
          "Declare text input" + consumed,
        );
      },
      onPresentation(o) {
        assert.deepEqual(o, images[presented++]);
      },
      onCheckpoint(o) {
        assert.deepEqual(
          checkpointGameplay(o),
          checkpointGameplay(parent.checkpoints[checked++]),
        );
      },
    });
    assert.deepEqual([consumed, presented, checked], [p.inputs, p.images, 20]);
    compareJungleMemory(
      current.finalMemory,
      baseline.finalMemory,
      "Declare text final",
    );
    const sourceHashes = async (list) =>
      Object.fromEntries(
        await Promise.all(list.map(async (p) => [p, sha(await readFile(p))])),
      );
    const fixture = {
      id: "jungle-" + name + "-text-inclusive-time",
      acceptanceLevel: "closed-loop-port-regression",
      producerRevision: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      parent: { path: p.parent, sha256: sha(parentBytes) },
      preLine: { path: p.preLine, sha256: sha(priorBytes) },
      line: { path: p.line, sha256: sha(lineBytes) },
      historicalSourceGraph: historical.graph,
      preLineSourceGraph: preLine.graph,
      lineSourceGraph: line.graph,
      expectedInputCount: p.inputs,
      expectedPresentationCount: p.images,
      expectedCheckpointCount: 20,
      expectedClockEventCount: current.events,
      clockProvider: parent.clockProvider,
      memoryClockRanges: CLOCK_RANGES,
      injections: [],
      fittedInputs: [],
      partialRestore: false,
      runtimeSources: await sourceHashes(paths),
      verificationSources: await sourceHashes(tools),
      inputContract:
        "Historical independent authored bytes at successive source reads;zero-phase driver/retrace schedule with driver-first ties. No expected state supplies inputs.",
      comparisonRules:
        "Exact DS except the same three independently checked timer words;all ordered images and20 gameplay checkpoints exact. New clocks/deadlines exact. All historical original/pre-line/line streams re-executed unchanged;no new exclusions.",
      clockTraceSha256: current.clockTraceSha256,
      presentationTimingSha256: current.presentationTimingSha256,
      checkpoints: current.checkpoints.map(checkpointTiming),
      finalTiming: {
        ...checkpointTiming({ inputCount: p.inputs, ...current.final }),
        clockWords: current.finalClockWords,
      },
      limitations: [
        "Closed-loop component port regression,not native whole-jungle cadence or physical keyboard acceptance.",
        "Formatter and transparent text work included;resident/color,opaque text and remaining CPU/device work incomplete.",
        "Full campaign and actual-browser acceptance separate.",
      ],
      verify: "node scripts/jungle-text-timing.js",
    };
    await writeFile(p.fixture, JSON.stringify(fixture, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(
      "Declared NEW " + name + " text timing;independent acceptance pending.",
    );
  } else {
    const f = JSON.parse(await readFile(p.fixture));
    assert.equal(f.id, "jungle-" + name + "-text-inclusive-time");
    assert.equal(f.acceptanceLevel, "closed-loop-port-regression");
    for (const [key, bytes, path] of [
      ["parent", parentBytes, p.parent],
      ["preLine", priorBytes, p.preLine],
      ["line", lineBytes, p.line],
    ])
      assert.deepEqual(f[key], { path, sha256: sha(bytes) });
    for (const [key, graph] of [
      ["historicalSourceGraph", historical.graph],
      ["preLineSourceGraph", preLine.graph],
      ["lineSourceGraph", line.graph],
    ])
      assert.deepEqual(f[key], graph);
    assert.deepEqual(f.memoryClockRanges, CLOCK_RANGES);
    assert.deepEqual(f.clockProvider, parent.clockProvider);
    assert.deepEqual(f.injections, []);
    assert.deepEqual(f.fittedInputs, []);
    assert.equal(f.partialRestore, false);
    assert.equal(f.expectedInputCount, p.inputs);
    assert.equal(f.expectedPresentationCount, p.images);
    assert.deepEqual(Object.keys(f.runtimeSources).sort(), [...paths].sort());
    assert.deepEqual(
      Object.keys(f.verificationSources).sort(),
      [...tools].sort(),
    );
    for (const [path, h] of Object.entries(f.runtimeSources)) {
      assert.equal(sha(await readFile(path)), h, "Changed runtime " + path);
      assert.equal(
        sha(execFileSync("git", ["show", f.producerRevision + ":" + path])),
        h,
        "Producer source changed",
      );
    }
    for (const [path, h] of Object.entries(f.verificationSources))
      assert.equal(sha(await readFile(path)), h, "Changed verifier " + path);
    compareCurrentJungle(resources, parent, f, old, null, p);
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
        () => compareCurrentJungle(resources, parent, f, old, fault, p),
        pattern,
      );
    const missing = structuredClone(f);
    missing.checkpoints.pop();
    assert.throws(
      () => compareCurrentJungle(resources, parent, missing, old, null, p),
      /Missing jungle timing checkpoints/,
    );
    console.log(
      `${name} text timing:${p.inputs} carried inputs,${p.images} ordered images,20 exact gameplay/timer checkpoints,${f.expectedClockEventCount} device events;all previous timing streams retained;${faults.length + 1} negative controls.`,
    );
  }
  for (const [path, b] of [
    [p.parent, parentBytes],
    [p.preLine, priorBytes],
    [p.line, lineBytes],
  ])
    assert.equal(
      sha(await readFile(path)),
      sha(b),
      "Historical fixture modified",
    );
}
