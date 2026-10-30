// Full four-family current-runtime scenario. Historical campaign streams and
// original assets stay authoritative and untouched.
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, writeFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/current-physical-campaign.json";
const manifest = JSON.parse(await readFile(manifestPath));
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.physicalKeyboard, true);
assert.equal(
  manifest.pendingBrowserReplay,
  false,
  "SETUP: independent browser replay pending",
);
assert.equal(manifest.expectedCheckpointCount, 35);
assert.equal(manifest.requiredEventCount, 4981);
assert.equal(manifest.expectedEnding.won, true);
assert.equal(
  sha(await readFile(manifest.buildManifest.path)),
  manifest.buildManifest.sha256,
);
for (const [role, spec] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing ${role} artifact ${spec.path}`);
  });
  assert.equal(bytes.length, spec.bytes, `Corrupt ${role} size`);
  assert.equal(sha(bytes), spec.sha256, `Corrupt ${role} artifact`);
}
assert.ok(
  Object.keys(manifest.verificationSources).length > 0,
  "SETUP: missing verification source identities",
);
for (const [path, expected] of Object.entries(manifest.verificationSources))
  assert.equal(
    sha(await readFile(path)),
    expected,
    `Changed campaign verifier ${path}`,
  );
const json = async (role) => {
  assert.ok(
    manifest.artifacts[role],
    `SETUP: missing ${role} fixture declaration`,
  );
  return JSON.parse(await readFile(manifest.artifacts[role].path));
};
const source = await json("producer-source"),
  producer = await json("producer-status");
assert.equal(source.commit, manifest.captureCommit);
assert.equal(producer.sourceCommit, manifest.captureCommit);
assert.equal(producer.exitCode, 1); // Deliberate exploratory sentinel, never reported as a passing test.
assert.equal(producer.routeCompleted, true);
assert.equal(producer.observerError, null);
const archive = spawnSync(
  "python3",
  [
    "-c",
    `import json,zipfile,hashlib,sys
s=json.load(open(sys.argv[2]))
with zipfile.ZipFile(sys.argv[1]) as z:
 names=[n for n in z.namelist() if not n.endswith('/')]
 assert set(names)==set(s['files']), 'Incomplete producer source archive'
 for n in names: assert hashlib.sha256(z.read(n)).hexdigest()==s['files'][n], 'Corrupt archived source:'+n
print(len(names))`,
    manifest.artifacts["producer-archive"].path,
    manifest.artifacts["producer-source"].path,
  ],
  { encoding: "utf8", timeout: 30000 },
);
assert.ifError(archive.error);
assert.equal(archive.status, 0, archive.stderr);
assert.ok(Number(archive.stdout) > 0);
assert.equal(
  sha(await readFile(manifest.artifacts["producer-archive"].path)),
  source.archiveSha256,
);
const gitArchive = spawnSync(
  "git",
  ["archive", "--format=zip", manifest.captureCommit],
  {
    timeout: 30000,
    maxBuffer: 32 * 1024 * 1024,
  },
);
assert.ifError(gitArchive.error);
assert.equal(gitArchive.status, 0, "SETUP: missing producer Git revision");
assert.equal(
  sha(gitArchive.stdout),
  source.archiveSha256,
  "Producer archive differs from committed source",
);
// Consumer tooling can evolve, while any game-source change requires a new
// comparison rather than reusing a historical producer receipt.
for (const [path, expected] of Object.entries(source.files))
  if (path.startsWith("src/game/"))
    assert.equal(
      sha(await readFile(path)),
      expected,
      `Changed game source ${path}`,
    );
const checks = await json("campaign-checkpoints"),
  events = await json("captured-events");
assert.equal(checks.length, 35);
assert.equal(events.length, 4981);
assert.deepEqual(
  checks.map((c) => c.name),
  manifest.checkpointNames,
);
assert.equal(checks.at(-1).name, "ending");
assert.equal(checks.at(-1).eventCount, events.length);
assert.deepEqual(checks.at(-1).state.ending, manifest.expectedEnding);
for (const key of Object.keys(manifest.expectedOwnership))
  assert.deepEqual(
    checks.at(-1).state.campaign[key],
    manifest.expectedOwnership[key],
  );
for (const name of [
  "jungle-return",
  "photography-return",
  "cave-return",
  "mountain-return",
  "bank-deposited",
  "rival-report",
])
  assert.ok(
    checks.some((c) => c.name === name),
    `Missing required campaign route ${name}`,
  );
const acceptedProgress = await json("accepted-browser-progress");
const acceptedChecks = await json("accepted-browser-checkpoints");
const acceptedStatus = await json("accepted-browser-status");
assert.equal(
  acceptedProgress.completed,
  true,
  "Incomplete independent browser receipt",
);
assert.equal(acceptedProgress.consumed, 4981);
assert.deepEqual(acceptedProgress.errors, []);
assert.equal(acceptedChecks.length, 35);
assert.equal(acceptedStatus.status, "passed");
assert.deepEqual(acceptedStatus.failedTests, []);
for (let i = 0; i < checks.length; i++)
  for (const key of ["name", "at", "eventCount", "stateSha256", "pixelsSha256"])
    assert.equal(
      acceptedChecks[i][key],
      checks[i][key],
      `Accepted browser checkpoint${i} ${key}`,
    );
assert.equal((await json("accepted-browser-events")).length, 4981);
const browserRoot = process.argv
  .find((a) => a.startsWith("--browser="))
  ?.slice(10);
if (browserRoot) {
  const dirs = await readdir(browserRoot, { withFileTypes: true });
  const cases = dirs.filter((d) => d.isDirectory());
  assert.equal(cases.length, 1, "Zero or unexpected browser cases");
  const root = `${browserRoot}/${cases[0].name}`;
  const read = async (name) => JSON.parse(await readFile(`${root}/${name}`));
  const result = await read("replay-progress.json"),
    observed = await read("campaign-checkpoints.json");
  assert.equal(result.completed, true);
  assert.equal(result.consumed, 4981);
  assert.equal(result.expectedEvents, 4981);
  assert.deepEqual(result.errors, []);
  assert.equal(result.navigation.length, 1);
  assert.equal(observed.length, 35);
  for (let i = 0; i < checks.length; i++)
    for (const key of [
      "name",
      "at",
      "eventCount",
      "stateSha256",
      "pixelsSha256",
    ])
      assert.equal(
        observed[i][key],
        checks[i][key],
        `Browser checkpoint${i} ${key}`,
      );
  assert.deepEqual(result.lastState.ending, manifest.expectedEnding);
  assert.equal((await read("actual-events.json")).length, 4981);
  const run = JSON.parse(await readFile(`${browserRoot}/.last-run.json`));
  assert.equal(run.status, "passed");
  assert.deepEqual(run.failedTests, []);
  console.log(
    "Current campaign browser:35 full states/pixel digests,4981 actual DOM events,four expeditions,winning deadline ending and restart.",
  );
} else {
  await mkdir(".local/current-campaign-verification", { recursive: true });
  const root = await mkdtemp(".local/current-campaign-verification/run-");
  const logs = [];
  for (const [name, negative, pattern] of [
    ["positive", null, null],
    ["alter-ending", "alter-ending", /Recorded ending mismatch/],
    ["extend-timeline", "extend-timeline", /Unfinished ending timeline/],
  ]) {
    const r = spawnSync(
      process.execPath,
      [
        "scripts/replay-hard-campaign.js",
        manifest.artifactRoot,
        `--manifest=${manifestPath}`,
        ...(negative ? [`--negative=${negative}`] : []),
      ],
      { encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
    );
    const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
    logs.push(writeFile(`${root}/${name}.log`, output));
    assert.ifError(r.error);
    if (pattern) {
      assert.equal(r.status, 1);
      assert.match(output, pattern);
      assert.doesNotMatch(
        output,
        /SETUP:|ETIMEDOUT|Zero replay cases|Corrupt .*fixture/,
      );
    } else {
      assert.equal(r.status, 0, output.slice(-3000));
      const result = JSON.parse(r.stdout.trim());
      assert.equal(result.mode, "recorded-input replay");
      assert.equal(result.checked, 35);
      assert.equal(result.consumed, 4981);
      assert.equal(result.rendered, manifest.expectedFlightPresentations);
      assert.equal(result.flagAliasPresentations, 0);
      assert.deepEqual(result.state.ending, manifest.expectedEnding);
    }
  }
  await Promise.all(logs);
  console.log(
    `Current campaign replay:35 carried states,4981 required inputs,four expeditions,winning ending;altered ending and unfinished timeline rejected. Reports:${root}`,
  );
}
