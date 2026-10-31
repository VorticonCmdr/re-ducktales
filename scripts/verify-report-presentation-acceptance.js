// Saved closed-loop browser evidence plus fresh focused checks. Native timing
// and actual audio I/O remain explicitly separate evidence levels.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/report-presentation-acceptance.json");
assert.equal(m.kind, "report-presentation-acceptance");
assert.equal(m.nativeComparison, false);
assert.deepEqual(m.exclusions, []);
assert.equal(m.cases.length, 3);
assert.equal(m.audio.length, 2);
await originalGame();
await checkArtifacts(m.artifacts);
async function current(root) {
  const s = await validateProducerArchive(root);
  for (const [p, h] of Object.entries(s.files))
    if (acceptedRuntimeSource(p))
      assert.equal(
        sha(await readFile(p)),
        h,
        "Changed accepted report runtime " + p,
      );
  const paths = (await readdir("src", { recursive: true, withFileTypes: true }))
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    paths,
    Object.keys(s.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
  );
  return s;
}
function run(args) {
  const p = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(p.status, 0, p.stdout + p.stderr);
  process.stdout.write(p.stdout);
  return p.stdout;
}
let checkpoints = 0,
  events = 0,
  groups = 0;
assert.deepEqual(
  m.cases.map((c) => c.reason),
  ["player", "rival", "forced"],
);
for (const c of m.cases) {
  const candidate = await json(m.artifacts[c.reason + "Scenario"].path);
  assert.equal(candidate.reason, c.reason);
  assert.equal(candidate.kind, "report-presentation-browser-candidate");
  assert.equal(candidate.nativeComparison, false);
  assert.equal(candidate.partialRestore, false);
  assert.deepEqual(candidate.injections, []);
  assert.deepEqual(candidate.fittedInputs, []);
  assert.deepEqual(candidate.comparison.exclusions, []);
  await checkArtifacts(candidate.artifacts);
  await current(candidate.producer);
  const points = await json(
      candidate.artifacts["campaign-checkpoints.json"].path,
    ),
    inputs = await json(candidate.artifacts["captured-events.json"].path);
  assert.equal(points.length, c.checkpoints);
  assert.equal(inputs.length, c.events);
  assert.equal(candidate.expectedCheckpointCount, c.checkpoints);
  assert.equal(candidate.requiredEventCount, c.events);
  assert.deepEqual(
    points.map((p) => p.name),
    candidate.checkpointNames,
  );
  assert.equal(new Set(points.map((p) => p.name)).size, points.length);
  assert.equal(points.at(-1).name, "map");
  assert.equal(points.at(-1).eventCount, inputs.length);
  const source = await current(c.consumer),
    r = await json(m.artifacts[c.reason + "Result"].path);
  assert.equal(r.sourceCommit, source.commit);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, true);
  assert.equal(r.producer, candidate.producer);
  assert.equal(r.nativeComparison, false);
  assert.equal(r.checked, c.checkpoints);
  assert.equal(r.consumed, c.events);
  assert.equal(r.semanticNegatives, 1);
  assert.equal(r.restart, true);
  await checkArtifacts(r.artifacts);
  if (c.reason === "forced") {
    assert.equal(candidate.compareReportFrames, true);
    assert.equal(r.frameComparisons, 58);
    const claim = points.find((p) => p.name === "forced-ready").state;
    assert.equal(claim.scene, "rival-claim");
    assert.equal(claim.claim.target, 32);
    assert.equal(claim.flight.outcome.status, "race-lost");
    assert.equal(claim.difficulty, 1);
  }
  run([
    "scripts/verify-report-presentation-rows.js",
    "--manifest=" + m.artifacts[c.reason + "Rows"].path,
  ]);
  const rows = await json(m.artifacts[c.reason + "Rows"].path);
  assert.equal(rows.expectedRowGroups, 45);
  checkpoints += r.checked;
  events += r.consumed;
  groups += rows.expectedRowGroups;
}
assert.deepEqual([checkpoints, events, groups], [85, 2881, 135]);
assert.deepEqual(
  m.audio.map((c) => c.device),
  ["speaker", "tandy"],
);
for (const c of m.audio) {
  const source = await current(c.producer),
    r = await json(m.artifacts[c.device + "Audio"].path);
  assert.equal(r.sourceCommit, source.commit);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, false);
  assert.equal(r.device, c.device);
  assert.equal(r.restart, true);
  assert.equal(r.stats.contextState, "running");
  assert.ok(Number(r.stats.signalSamples) > 0, "Missing actual audio output");
  const calls = r.events.filter((e) => e.type === "ack" && !e.query);
  assert.deepEqual(
    calls.map((e) => e.argument),
    [0, 0x24, 0x6e, 0x21],
  );
  // TandyGameStream reports driver state directly;only SpeakerGameStream
  // exposes the driver's boolean request-acceptance field.
  for (const e of calls)
    assert.equal(e.accepted, c.device === "speaker" ? true : undefined);
  const speech = calls[2],
    reset = calls[3],
    queries = r.events.filter((e) => e.type === "ack" && e.query);
  assert.ok(queries.length > 0, "Zero real report status queries");
  for (const [i, q] of queries.entries()) {
    assert.equal(q.token, `${speech.token}:status:${i + 1}`);
    assert.equal(q.accepted, c.device === "speaker" ? true : undefined);
    assert.ok(q.sequence > speech.sequence && q.sequence < reset.sequence);
  }
  assert.ok(
    r.events.some(
      (e) => e.type === "complete" && e.token === speech.token && !e.busy,
    ),
    "Missing real speech completion",
  );
}
run([
  "scripts/verify-report-fixture-negatives.js",
  "--manifest=" + m.artifacts.playerScenario.path,
]);
const units = spawnSync("npm", ["test"], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
assert.equal(units.status, 0, units.stdout + units.stderr);
for (const pattern of [
  /tests 210\b/,
  /pass 210\b/,
  /fail 0\b/,
  /skipped 0\b/,
  /cancelled 0\b/,
])
  assert.match(units.stdout, pattern);
const readers = run([
  "--test",
  "scripts/rival-input.test.js",
  "scripts/visit-input.test.js",
]);
for (const pattern of [/tests 21\b/, /pass 21\b/, /fail 0\b/, /skipped 0\b/])
  assert.match(readers, pattern);
const build = spawnSync("npm", ["run", "build"], {
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
assert.equal(build.status, 0, build.stdout + build.stderr);
console.log(
  "Report acceptance:85 exact state/image checkpoints,2881 independent DOM inputs,135 stripe groups,58 forced-route intermediate frames,3 missing-Pause negatives,5 setup negatives,210 units,21 reader boundaries and build. Actual speaker/Tandy I/O is conditional,not native elapsed-time or waveform parity.",
);
