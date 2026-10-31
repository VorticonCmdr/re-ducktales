// Saved port-browser evidence;does not claim a native whole-campaign replay.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const record = await json("reference/standard-winning-acceptance.json");
assert.equal(record.kind, "standard-winning-acceptance");
assert.equal(record.nativeComparison, false);
await originalGame();
await checkArtifacts(record.artifacts);
async function current(root) {
  const source = await validateProducerArchive(root);
  for (const [path, hash] of Object.entries(source.files))
    if (acceptedRuntimeSource(path))
      assert.equal(
        sha(await readFile(path)),
        hash,
        "Changed accepted runtime " + path,
      );
  return source;
}
const m = await json(record.artifacts.scenario.path);
assert.equal(m.kind, "standard-full-campaign-port-regression");
assert.equal(m.difficulty, 1);
assert.equal(m.physicalKeyboard, true);
assert.equal(m.nativeComparison, false);
assert.equal(m.expectedCheckpointCount, 170);
assert.equal(m.requiredEventCount, 6575);
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
assert.deepEqual(m.comparison.exclusions, []);
await checkArtifacts(m.artifacts);
await current(m.producer);
const checks = await json(m.artifacts["campaign-checkpoints"].path),
  events = await json(m.artifacts["captured-events"].path);
assert.equal(checks.length, 170);
assert.equal(events.length, 6575);
assert.equal(checks.at(-1).eventCount, events.length);
assert.equal(new Set(checks.map((c) => c.name)).size, checks.length);
assert.equal(checks.at(-1).name, "closed");
assert.equal(checks.at(-1).state.ending.phase, "closed");
assert.equal(checks.at(-1).state.ending.won, true);
assert.deepEqual(
  {
    day: checks.at(-1).state.campaign.day,
    banked: checks.at(-1).state.campaign.banked,
    rivalBanked: checks.at(-1).state.campaign.rival.banked,
  },
  { day: 33, banked: 24275, rivalBanked: 21000 },
);
for (const [name, phase] of [
  ["winner-celebration", "celebration"],
  ["replay-yes", "replay"],
  ["replay-no", "replay"],
  ["credits-title", "credits"],
  ["farewell", "farewell"],
])
  assert.equal(checks.find((c) => c.name === name)?.state.ending.phase, phase);
assert.equal(checks.find((c) => c.name === "replay-no").state.ending.choice, 1);
for (let i = 0; i < 26; i++) {
  const credit = checks.find((c) => c.name === "credit-" + i);
  assert.ok(credit, "Skipped credit " + i);
  assert.equal(credit.state.ending.phase, "credits");
  assert.equal(credit.state.ending.credit, i);
  assert.equal(credit.state.ending.ready, true);
}
const captured = await json(m.artifacts["capture-status"].path);
assert.equal(captured.completed, true);
assert.equal(captured.accepted, false);
assert.equal(captured.closed, true);
assert.equal(captured.credits, 26);
assert.equal(captured.restart, true);
const source = await current(record.consumer),
  result = await json(record.artifacts.result.path);
assert.equal(result.completed, true);
assert.equal(result.accepted, true);
assert.equal(result.nativeComparison, false);
assert.equal(result.sourceCommit, source.commit);
assert.equal(result.producer, m.producer);
assert.equal(result.checked, 170);
assert.equal(result.consumed, 6575);
assert.equal(result.restart, true);
assert.equal(result.semanticNegatives, 1);
await checkArtifacts(result.artifacts);
await current(record.checksSource);
const negatives = await json(record.artifacts.setupNegatives.path);
assert.equal(negatives.completed, true);
assert.deepEqual(
  negatives.checks,
  ["zero-checkpoints", "missing-fixture", "corrupt-fixture"].map((kind) => ({
    kind,
    rejected: true,
    exitCode: 1,
  })),
);
for (const script of [
  "verify-repair-input-acceptance",
  "verify-ending",
  "verify-credits",
]) {
  const check = spawnSync(process.execPath, ["scripts/" + script + ".js"], {
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr);
}
console.log(
  "Winning Standard acceptance:170 exact state/image checkpoints,6575 independent DOM events,all four expedition families,three additional cave treasures,24275 vs21000,winning celebration/replay-No/all26 credits/closed/Restart;one input negative,three setup negatives. Existing original ending/credit and unchanged-runtime repair regressions pass. Not native campaign timing/audio parity or arbitrary-route completion.",
);
