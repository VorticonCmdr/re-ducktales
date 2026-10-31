// Port-browser regression only. Exact state/image replay is separate from
// original executable correspondence and from uninterrupted native timing parity.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";

const record = await json(
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
    "reference/current-winning-acceptance.json",
);
assert.equal(record.kind, "current-winning-campaign-acceptance");
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
  const actual = (
    await readdir("src", { recursive: true, withFileTypes: true })
  )
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    actual,
    Object.keys(source.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
    "Unexpected runtime source",
  );
  return source;
}
const m = await json(record.artifacts.scenario.path);
assert.equal(m.kind, "standard-full-campaign-port-regression");
assert.equal(m.difficulty, 1);
assert.equal(m.physicalKeyboard, true);
assert.equal(m.nativeComparison, false);
assert.equal(m.partialRestore, false);
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
assert.deepEqual(m.comparison.exclusions, []);
assert.ok(
  m.expectedCheckpointCount >= 150 && m.requiredEventCount >= 5000,
  "Zero/incomplete campaign cases",
);
await checkArtifacts(m.artifacts);
await current(m.producer);
const checks = await json(m.artifacts["campaign-checkpoints"].path),
  events = await json(m.artifacts["captured-events"].path),
  captured = await json(m.artifacts["capture-status"].path);
assert.equal(checks.length, m.expectedCheckpointCount);
assert.equal(events.length, m.requiredEventCount);
assert.deepEqual(
  checks.map((c) => c.name),
  m.checkpointNames,
);
assert.equal(new Set(m.checkpointNames).size, checks.length);
assert.equal(
  checks.at(-1).eventCount,
  events.length,
  "Unfinished required inputs",
);
assert.equal(checks.at(-1).name, "closed");
assert.equal(checks.at(-1).state.ending.phase, "closed");
assert.equal(checks.at(-1).state.ending.won, true);
for (const c of checks) assert.equal(c.state.diagnostic, null);
assert.equal(captured.completed, true);
assert.equal(captured.accepted, false);
assert.equal(captured.restart, true);
assert.equal(captured.checkpoints, checks.length);
assert.equal(captured.events, events.length);
assert.deepEqual(captured.expectedOutcome, m.expectedOutcome);
const final = checks.at(-1).state;
assert.deepEqual(
  {
    day: final.campaign.day,
    banked: final.campaign.banked,
    rivalBanked: final.campaign.rival.banked,
    playerCollected: final.campaign.playerCollected,
    won: final.ending.won,
    ready: final.ending.ready,
  },
  m.expectedOutcome,
);
assert.ok(final.campaign.banked > final.campaign.rival.banked);
for (const activity of ["cave", "jungle", "mountain"])
  assert.equal(final[activity].outcome.code, 1);
assert.equal(final.jungle.lives, 3);
assert.equal(final.mountain.lives, 3);
assert.ok(final.photography.photos.includes(final.photography.target));
for (const id of [24, 28, 19, 9, 30, 21])
  assert.ok(final.campaign.playerCollected.includes(id));
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
  const c = checks.find((c) => c.name === "credit-" + i);
  assert.ok(c, "Skipped credit " + i);
  assert.equal(c.state.ending.phase, "credits");
  assert.equal(c.state.ending.credit, i);
  assert.equal(c.state.ending.ready, true);
}
const consumer = await current(record.consumer),
  result = await json(record.artifacts.result.path);
assert.equal(result.sourceCommit, consumer.commit);
assert.equal(result.producer, m.producer);
assert.equal(result.completed, true);
assert.equal(result.accepted, true);
assert.equal(result.nativeComparison, false);
assert.equal(result.checked, checks.length);
assert.equal(result.consumed, events.length);
assert.equal(result.restart, true);
assert.equal(result.semanticNegatives, 1);
await checkArtifacts(result.artifacts);
const negative = await json(record.artifacts.setupNegatives.path);
assert.equal(negative.completed, true);
assert.deepEqual(
  negative.checks,
  ["zero-checkpoints", "missing-fixture", "corrupt-fixture"].map((kind) => ({
    kind,
    rejected: true,
    exitCode: 1,
  })),
);
const awards = await json(record.artifacts.awards.path);
assert.equal(awards.producer, m.producer);
const awardCount = record.expectedAwardCount ?? 6;
assert.ok([6, 7].includes(awardCount));
assert.equal(awards.cases.length, awardCount);
if (awardCount === 7) {
  assert.equal(awards.includeNovay, true);
  assert.ok(final.campaign.playerCollected.includes(10));
  assert.equal(
    record.artifacts.bankPixels.path,
    "reference/bank-copy-pixels.json",
  );
}
for (const [script, args] of [
  [
    "verify-current-winning-awards",
    ["--manifest=" + record.artifacts.awards.path],
  ],
  ["verify-award-presentation-source", []],
  ["verify-ending", []],
  ["verify-credits", []],
  ...(record.artifacts.bankPixels ? [["verify-bank-copy-pixels", []]] : []),
]) {
  const r = spawnSync(
    process.execPath,
    ["scripts/" + script + ".js", ...args],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  process.stdout.write(r.stdout);
}
if (record.expectedUnitCases !== undefined) {
  assert.equal(record.expectedUnitCases, 218);
  const unit = spawnSync("npm", ["test"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(unit.status, 0, unit.stdout + unit.stderr);
  for (const pattern of [
    /tests 218\b/,
    /pass 218\b/,
    /fail 0\b/,
    /skipped 0\b/,
    /cancelled 0\b/,
  ])
    assert.match(unit.stdout, pattern);
  const build = spawnSync("npm", ["run", "build"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);
}
console.log(
  `Current Standard winning browser acceptance:${checks.length} exact state/image checkpoints,${events.length} independent DOM events,${awardCount} earned awards/${awardCount * 15} row groups,all26 credits/closed/Restart;one input negative and3 setup negatives${record.expectedUnitCases ? ",218 units and build" : ""}. Not native whole-campaign timing/audio parity or arbitrary-route completion.`,
);
