// Declare a complete exploratory stream for independent verification.
// This does not create a browser acceptance receipt or alter raw observations.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, relative } from "node:path";
const [capturePath, outPath, manifestPath] = process.argv.slice(2);
assert.ok(
  capturePath && outPath && manifestPath,
  "SETUP: provide capture root,declaration root,new manifest",
);
const root = resolve(".local");
for (const p of [capturePath, outPath])
  assert.ok(
    relative(root, resolve(p)) && !relative(root, resolve(p)).startsWith(".."),
    "SETUP: local evidence roots required",
  );
assert.ok(/^reference\/[a-z0-9-]+\.json$/.test(manifestPath));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = async (p) => JSON.parse(await readFile(p));
const raw = `${capturePath}/raw`,
  m = await json("reference/destination-jungle-treasure.json");
const [points, events, environment, report, runner, source] = await Promise.all(
  ["campaign-checkpoints", "captured-events", "environment"]
    .map((n) => json(`${raw}/${n}.json`))
    .concat([
      json(`${capturePath}/report.json`),
      json(`${capturePath}/runner-status.json`),
      json(`${capturePath}/source-revision.json`),
    ]),
);
assert.equal(points.length, 27);
assert.equal(events.length, 70);
assert.equal(points.at(-1).name, "complete-map");
assert.equal(runner.completed, true);
assert.equal(runner.exitCode, 1);
assert.equal(environment.completed, false);
assert.deepEqual(report.errors, []);
assert.deepEqual(
  [
    report.stats.expected,
    report.stats.unexpected,
    report.stats.skipped,
    report.stats.flaky,
  ],
  [0, 1, 0, 0],
);
const cases = [];
function visit(s) {
  for (const x of s.specs ?? []) cases.push(...x.tests);
  for (const x of s.suites ?? []) visit(x);
}
visit(report);
assert.equal(cases.length, 1);
assert.equal(cases[0].results.length, 1);
assert.equal(
  cases[0].results[0].error.message,
  "Error: EXPLORATORY treasure capture saved; this run is not acceptance",
);
assert.equal(cases[0].results[0].errors.length, 1);
assert.equal(source.commit, runner.sourceCommit);
assert.equal(
  sha(await readFile(`${capturePath}/sources.zip`)),
  source.archiveSha256,
);
assert.equal(
  sha(await readFile("reference/security-jungle-treasure-inputs.json")),
  source.files["reference/security-jungle-treasure-inputs.json"],
);
const last = points.at(-1).state,
  a = last.jungle;
const outcome = {
  money: last.money,
  day: last.campaign.day,
  playerCollected: last.campaign.playerCollected,
  frames: a.frames,
  presentations: a.presentations,
  lives: a.lives,
  seed: a.seed,
};
assert.deepEqual(outcome, m.expectedOutcome, "Gameplay outcome changed");
assert.deepEqual(
  points.map((p) => p.name),
  m.checkpointNames,
);
assert.equal(events.length, points.at(-1).eventCount);
await mkdir(outPath);
for (const name of ["campaign-checkpoints", "captured-events", "timeline"])
  await copyFile(`${raw}/${name}.json`, `${outPath}/${name}.json`);
await writeFile(
  `${outPath}/environment.json`,
  JSON.stringify(
    {
      ...environment,
      completed: true,
      mode: "declared-complete-route-contract",
      rawEnvironmentSha256: sha(await readFile(`${raw}/environment.json`)),
      declaration:
        "Complete exploratory contract;independent Game/browser acceptance pending",
    },
    null,
    2,
  ) + "\n",
);
Object.assign(m, {
  id: "draw-timed-easy-jungle-treasure",
  pending: true,
  pendingBrowserReplay: true,
  browserVerified: false,
  artifactRoot: outPath,
  captureRoot: raw,
  captureCommit: source.commit,
  sourceFileCounts: { capture: Object.keys(source.files).length },
  entryStateSha256: points[0].stateSha256,
  entryPixelsSha256: points[0].pixelsSha256,
  checkpoints: points.map(({ state, ...p }) => p),
  expectedOutcome: outcome,
});
delete m.browserCommit;
const paths = Object.fromEntries(
  ["environment", "campaign-checkpoints", "captured-events", "timeline"].map(
    (n) => [n, `${outPath}/${n}.json`],
  ),
);
Object.assign(paths, {
  "capture-source": `${capturePath}/source-revision.json`,
  "capture-zip": `${capturePath}/sources.zip`,
  "capture-environment": `${raw}/environment.json`,
  "capture-report": `${capturePath}/report.json`,
  "input-profile": "reference/security-jungle-treasure-inputs.json",
});
m.artifacts = {};
for (const [name, path] of Object.entries(paths)) {
  const b = await readFile(path);
  m.artifacts[name] = { path, bytes: b.length, sha256: sha(b) };
}
m.limitations = [
  "Port/browser route,not native whole-level parity",
  "Sprite/copy work is charged;line/text and other CPU costs remain incomplete",
  "Independent fixed-event browser acceptance pending;broader gate incomplete",
];
m.verify = `node scripts/verify-destination-routes.js ${manifestPath}`;
await writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    declared: true,
    accepted: false,
    checkpoints: points.length,
    events: events.length,
    outcome,
  }),
);
