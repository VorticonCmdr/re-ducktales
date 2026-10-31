// Freeze a completed exploration as candidate fixtures. This creates no
// acceptance receipt and never changes recorded inputs, expected states or PNGs.
import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { json, spec } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const root = process.argv[2];
assert.ok(
  root?.startsWith(".local/"),
  "Supply completed local browser capture",
);
const status = await json(root + "/exploration-status.json"),
  source = await validateProducerArchive(root),
  checks = await json(root + "/campaign-checkpoints.json"),
  events = await json(root + "/captured-events.json");
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.restart, true);
assert.equal(status.sourceCommit, source.commit);
assert.equal(checks.at(-1).name, "closed");
assert.equal(checks.at(-1).state.ending.won, true);
assert.equal(events.length, status.events);
assert.equal(checks.length, status.checkpoints);
const artifacts = {};
const aliases = {
  "environment.json": "environment",
  "captured-events.json": "captured-events",
  "campaign-checkpoints.json": "campaign-checkpoints",
  "timeline.json": "timeline",
  "exploration-status.json": "capture-status",
};
for (const f of await readdir(root, { withFileTypes: true }))
  if (f.isFile())
    artifacts[aliases[f.name] ?? f.name] = await spec(root + "/" + f.name);
const scenario = {
  kind: "standard-full-campaign-port-regression",
  producer: root,
  captureToolRevision: source.commit,
  scope:
    "Current muted Standard winning port-browser route with restored award presentation,all four expedition families,three later caves,banking,winning celebration,replay-No,26 credits,closed and Restart. Not native whole-campaign timing/audio parity or arbitrary-route acceptance.",
  build: await spec("reference/build.json"),
  difficulty: 1,
  physicalKeyboard: true,
  nativeComparison: false,
  environment: {
    biosSeed: 0,
    clockOrigin: 1,
    displayMilliseconds: 8,
    timezone: "UTC",
    audioEnabled: false,
    originalSecurity: false,
  },
  startingRecipe:
    "Fresh title;replay every independent DOM input through the pinned valid mountain-map prefix,checking every complete state/image;then actual adaptive pilot,cave controls and browser ending. No checkpoint restore. Atlantis pilot steers at speed1 for collision recovery;other flights retain speed4 policy.",
  prefix: await spec("reference/current-winning-mountain-prefix.json"),
  requiredEventCount: events.length,
  expectedCheckpointCount: checks.length,
  checkpointNames: checks.map((c) => c.name),
  expectedOutcome: status.expectedOutcome,
  comparison: {
    state: "exact complete public snapshot",
    pixels: "exact decoded RGBA",
    exclusions: [],
  },
  injections: [],
  fittedInputs: [],
  partialRestore: false,
  artifacts,
  verify:
    "node scripts/verify-standard-wages-route.js --manifest=reference/current-winning-route.json --output=.local/current-winning-replay-FRESH",
};
const targetRoot = ".local/standard-winning-browser-03";
await validateProducerArchive(targetRoot);
const targets = await json(targetRoot + "/campaign-checkpoints.json");
const cases = [
  [24, "cave", 3000],
  [28, "jungle", 4000],
  [19, "mountain", 2000],
  [9, "cave", 5000],
  [30, "cave", 4500],
  [21, "cave", 6000],
].map(([location, activity, value]) => {
  const c = targets.find(
    (c) =>
      c.state.scene === "expedition-result" &&
      c.state.expeditionResult.phase === "award" &&
      !c.state.systemOverlay &&
      c.state.campaign.selected === location,
  );
  assert.ok(c, "Missing retained reward target " + location);
  assert.equal(c.state.expeditionResult.value, value);
  return {
    location,
    activity,
    value,
    targetCheckpoint: c.name,
    targetArtifact: "target-" + location,
  };
});
const awards = {
  kind: "current-winning-award-presentations",
  producer: root,
  targetProducer: targetRoot,
  nativeComparison: false,
  scope:
    "Actual Standard cave/jungle/mountain reward row transitions,compared with independently retained earlier completed port pages;not original native transition screenshots or timing parity.",
  comparison: {
    rows: "exact decoded RGBA with source-defined stripe groups",
    exclusions: [],
  },
  cases,
  artifacts: {
    presentations: await spec(root + "/award-presentations.json"),
    targetCheckpoints: await spec(targetRoot + "/campaign-checkpoints.json"),
  },
  verify: "node scripts/verify-current-winning-awards.js",
};
for (const c of cases)
  awards.artifacts[c.targetArtifact] = await spec(
    targetRoot + "/" + c.targetCheckpoint + ".png",
  );
await writeFile(
  "reference/current-winning-route.json",
  JSON.stringify(scenario, null, 2) + "\n",
  { flag: "wx" },
);
await writeFile(
  "reference/current-winning-awards.json",
  JSON.stringify(awards, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    candidateOnly: true,
    checkpoints: checks.length,
    events: events.length,
    outcome: status.expectedOutcome,
  }),
);
