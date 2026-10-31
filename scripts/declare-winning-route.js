// Declare expected outputs of a completed exploratory browser capture.
// Inputs remain the separately recorded DOM stream;no file is overwritten.
import assert from "node:assert/strict";
import { readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { json, spec } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
const arg = (key) =>
  process.argv
    .find((a) => a.startsWith("--" + key + "="))
    ?.slice(key.length + 3);
const root = arg("producer"),
  destination = arg("manifest");
assert.ok(
  root && resolve(root).startsWith(resolve(".local") + "/"),
  "Supply ignored local --producer",
);
assert.ok(
  destination && resolve(destination).startsWith(resolve("reference") + "/"),
  "Supply new --manifest in reference/",
);
const source = await validateProducerArchive(root);
const status = await json(root + "/exploration-status.json"),
  points = await json(root + "/campaign-checkpoints.json"),
  events = await json(root + "/captured-events.json"),
  timeline = await json(root + "/timeline.json"),
  environment = await json(root + "/environment.json");
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.restart, true);
assert.equal(status.sourceCommit, source.commit);
assert.ok(
  points.length >= 150 && events.length >= 5000,
  "Incomplete campaign capture",
);
assert.equal(points.length, status.checkpoints);
assert.equal(events.length, status.events);
assert.equal(points.at(-1).name, "closed");
assert.equal(points.at(-1).eventCount, events.length);
assert.equal(new Set(points.map((p) => p.name)).size, points.length);
for (const p of points) assert.equal(p.state.diagnostic, null);
for (let i = 0; i < 26; i++)
  assert.equal(points.filter((p) => p.name === `credit-${i}`).length, 1);
assert.deepEqual(
  timeline.observations,
  points.map(({ name, at, eventCount }) => ({ name, at, eventCount })),
);
assert.equal(timeline.endAt, points.at(-1).at);
assert.equal(environment.clockOrigin, 1);
assert.equal(environment.displayMilliseconds, 8);
assert.equal(environment.difficulty, 1);
assert.equal(environment.physical, true);
assert.equal(environment.hard, false);
assert.equal(status.expectedOutcome.won, true);
assert.ok(status.expectedOutcome.banked > status.expectedOutcome.rivalBanked);
assert.equal(points.at(-1).state.ending.phase, "closed");
assert.equal(points.at(-1).state.ending.won, true);
const aliases = {
    "campaign-checkpoints.json": "campaign-checkpoints",
    "captured-events.json": "captured-events",
    "environment.json": "environment",
    "timeline.json": "timeline",
    "exploration-status.json": "capture-status",
  },
  artifacts = {};
for (const item of (await readdir(root, { withFileTypes: true })).sort((a, b) =>
  a.name.localeCompare(b.name),
)) {
  assert.ok(item.isFile(), "Unexpected nested capture artifact " + item.name);
  assert.match(item.name, /\.(json|png|zip)$/, "Unexpected capture artifact");
  artifacts[aliases[item.name] ?? item.name] = await spec(
    root + "/" + item.name,
  );
}
const manifest = {
  kind: "standard-full-campaign-port-regression",
  producer: root,
  captureToolRevision: source.commit,
  scope:
    "Fresh current Standard browser capture:all four expedition families,seven earned treasures,victory,all26 credits,closed and Restart. Independent replay required;not native elapsed-time/audio or arbitrary-route acceptance.",
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
    "Fresh startup with original resources and BIOS seed0. Run standard-wages-explore.js --winning --bonus-novay;its archived browser controller supplies ordinary DOM controls,including the input-only Novay wait and24 neutral final-bank reads. No checkpoint restore,game-state patch or fitted hardware timer. Restart follows closed separately. Replay consumes only the recorded independent input stream.",
  requiredEventCount: events.length,
  expectedCheckpointCount: points.length,
  checkpointNames: points.map((p) => p.name),
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
  verify: `node scripts/verify-standard-wages-route.js --manifest=${destination} --output=.local/winning-replay-FRESH`,
};
await writeFile(destination, JSON.stringify(manifest, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    declared: true,
    accepted: false,
    manifest: destination,
    checkpoints: points.length,
    inputs: events.length,
  }),
);
