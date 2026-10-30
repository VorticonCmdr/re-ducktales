// Full four-family current-runtime scenario. Historical campaign streams and
// original assets stay authoritative and untouched.
import assert from "node:assert/strict";
import { readFile, mkdir, mkdtemp, writeFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/jungle-line-campaign.json";
const manifest = JSON.parse(await readFile(manifestPath));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const checkpointCount = {
  "current-physical-easy-complete-campaign": 35,
  "cave-reveal-easy-complete-campaign": 34,
  "speaker-runtime-easy-complete-campaign": 34,
  "jungle-line-easy-complete-campaign": 35,
}[manifest.id];
assert.ok(
  Number.isInteger(checkpointCount),
  "Unsupported complete campaign contract",
);
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.physicalKeyboard, true);
assert.equal(
  manifest.pendingBrowserReplay,
  false,
  "SETUP: independent browser replay pending",
);
assert.equal(manifest.expectedCheckpointCount, checkpointCount);
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
// A runtime comparison keeps historical expectations/provenance intact while
// pinning a separate current consumer archive and a fresh actual-browser pass.
let consumerSource = source;
if (manifest.id === "speaker-runtime-easy-complete-campaign") {
  assert.equal(manifest.runtimeComparison, true);
  const baseline = await json("expectation-manifest");
  for (const key of [
    "captureCommit",
    "expectedCheckpointCount",
    "requiredEventCount",
    "checkpointNames",
    "expectedEnding",
    "expectedOwnership",
    "expectedFlightPresentations",
  ])
    assert.deepEqual(
      manifest[key],
      baseline[key],
      `Changed historical expectation ${key}`,
    );
  for (const role of [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
    "producer-source",
    "producer-archive",
    "producer-status",
    "producer-log",
    "ending-png",
  ])
    assert.deepEqual(
      manifest.artifacts[role],
      baseline.artifacts[role],
      `Replaced historical ${role}`,
    );
  consumerSource = await json("runtime-source");
  const runtimeStatus = await json("runtime-status");
  assert.equal(consumerSource.commit, manifest.runtimeCommit);
  assert.equal(runtimeStatus.sourceCommit, manifest.runtimeCommit);
  assert.equal(runtimeStatus.exitCode, 0);
  assert.equal(runtimeStatus.loadedSourcesUnchanged, true);
  assert.equal(runtimeStatus.historicalArtifactsPreserved, true);
  assert.equal(
    runtimeStatus.manifestSHA256,
    manifest.artifacts["expectation-manifest"].sha256,
  );
  assert.equal(
    runtimeStatus.captureToolSHA256,
    manifest.artifacts["runtime-capture-tool"].sha256,
  );
  const runtimeArchive = await readFile(
    manifest.artifacts["runtime-archive"].path,
  );
  assert.equal(sha(runtimeArchive), consumerSource.archiveSha256);
  const committed = spawnSync(
    "git",
    ["archive", "--format=zip", manifest.runtimeCommit],
    { timeout: 30000, maxBuffer: 32 * 1024 * 1024 },
  );
  assert.ifError(committed.error);
  assert.equal(committed.status, 0, "SETUP: missing runtime revision");
  assert.equal(
    sha(committed.stdout),
    consumerSource.archiveSha256,
    "Runtime archive differs from committed source",
  );
  const inventory = spawnSync(
    "python3",
    [
      "-c",
      `import json,zipfile,hashlib,sys
s=json.load(open(sys.argv[2]))
with zipfile.ZipFile(sys.argv[1]) as z:
 names=[n for n in z.namelist() if not n.endswith('/')]
 assert set(names)==set(s['files']), 'Incomplete runtime source archive'
 for n in names: assert hashlib.sha256(z.read(n)).hexdigest()==s['files'][n], 'Corrupt runtime source:'+n`,
      manifest.artifacts["runtime-archive"].path,
      manifest.artifacts["runtime-source"].path,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.ifError(inventory.error);
  assert.equal(inventory.status, 0, inventory.stderr);
  const changedGameFiles = [
    ...new Set([
      ...Object.keys(source.files),
      ...Object.keys(consumerSource.files),
    ]),
  ]
    .filter(
      (p) =>
        p.startsWith("src/game/") &&
        source.files[p] !== consumerSource.files[p],
    )
    .sort();
  assert.deepEqual(
    changedGameFiles,
    [
      "src/game/audio-device.js",
      "src/game/browser.js",
      "src/game/speaker-audio.js",
      "src/game/tandy-audio.js",
    ],
    "Unexpected game change in audio runtime comparison",
  );
  const actualSourceFiles = (
    await readdir("src", { recursive: true, withFileTypes: true })
  )
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  const expectedSourceFiles = Object.keys(consumerSource.files)
    .filter((p) => p.startsWith("src/"))
    .sort();
  assert.deepEqual(
    actualSourceFiles,
    expectedSourceFiles,
    "Unexpected or missing runtime source file",
  );
} else
  assert.equal(
    manifest.runtimeComparison,
    undefined,
    "Unsupported runtime comparison",
  );
if (manifest.id === "jungle-line-easy-complete-campaign") {
  assert.equal(manifest.completeSourceInventory, true);
  assert.equal(producer.captureCompleted, true);
  assert.equal(producer.loadedSourcesUnchanged, true);
  assert.equal(producer.historicalArtifactsPreserved, true);
  const contract = await json("browser-contract"),
    consumer = await json("consumer-source"),
    status = await json("consumer-status");
  for (const key of [
    "id",
    "captureCommit",
    "expectedCheckpointCount",
    "requiredEventCount",
    "checkpointNames",
    "expectedEnding",
    "expectedOwnership",
    "expectedFlightPresentations",
    "completeSourceInventory",
    "buildManifest",
  ])
    assert.deepEqual(
      manifest[key],
      contract[key],
      `Changed independent browser contract ${key}`,
    );
  for (const [role, spec] of Object.entries(contract.artifacts))
    assert.deepEqual(
      manifest.artifacts[role],
      spec,
      `Changed independently replayed artifact ${role}`,
    );
  assert.equal(status.exitCode, 0);
  assert.equal(status.loadedSourcesUnchanged, true);
  assert.equal(status.historicalArtifactsPreserved, true);
  assert.equal(
    status.manifestSHA256,
    manifest.artifacts["browser-contract"].sha256,
  );
  assert.equal(consumer.commit, manifest.consumerCommit);
  assert.equal(status.sourceCommit, manifest.consumerCommit);
  const srcFiles = Object.keys(source.files)
    .filter((p) => p.startsWith("src/"))
    .sort();
  assert.deepEqual(
    Object.keys(consumer.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
    srcFiles,
  );
  const partialSource = await json("partial-producer-source");
  for (const p of srcFiles)
    assert.equal(
      partialSource.files[p],
      source.files[p],
      `Input-only prefix game source differs ${p}`,
    );
  for (const p of srcFiles)
    assert.equal(
      consumer.files[p],
      source.files[p],
      `Independent consumer source differs ${p}`,
    );
  const actual = (
    await readdir("src", { recursive: true, withFileTypes: true })
  )
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    actual,
    srcFiles,
    "Unexpected or missing complete campaign source",
  );
  const prefix = await json("producer-prefix-replay");
  assert.equal(prefix.checkpoints, 27);
  assert.equal(prefix.recordedTailEvents, 0);
  assert.equal(prefix.lastCheckpoint, "arrival");
  assert.equal(prefix.inputCaptureTruncated, true);
  const bytes = await readFile(manifest.artifacts["consumer-archive"].path);
  assert.equal(sha(bytes), consumer.archiveSha256);
  const git = spawnSync(
    "git",
    ["archive", "--format=zip", manifest.consumerCommit],
    { timeout: 30000, maxBuffer: 32 * 1024 * 1024 },
  );
  assert.ifError(git.error);
  assert.equal(git.status, 0, "SETUP: missing independent consumer revision");
  assert.equal(sha(git.stdout), consumer.archiveSha256);
  const zip = spawnSync(
    "python3",
    [
      "-c",
      `import json,zipfile,hashlib,sys
s=json.load(open(sys.argv[2]))
with zipfile.ZipFile(sys.argv[1]) as z:
 names=[n for n in z.namelist() if not n.endswith('/')]
 assert set(names)==set(s['files']), 'Incomplete consumer source archive'
 for n in names: assert hashlib.sha256(z.read(n)).hexdigest()==s['files'][n], 'Corrupt consumer source:'+n`,
      manifest.artifacts["consumer-archive"].path,
      manifest.artifacts["consumer-source"].path,
    ],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.ifError(zip.error);
  assert.equal(zip.status, 0, zip.stderr);
} else
  assert.equal(
    manifest.completeSourceInventory,
    undefined,
    "Unsupported complete-source inventory",
  );
// Historical contracts still require their original source. The explicit audio
// comparison checks every src file against its independently archived consumer.
for (const [path, expected] of Object.entries(consumerSource.files))
  if (
    path.startsWith(
      manifest.runtimeComparison || manifest.completeSourceInventory
        ? "src/"
        : "src/game/",
    )
  )
    assert.equal(
      sha(await readFile(path)),
      expected,
      `Changed game source ${path}`,
    );
const checks = await json("campaign-checkpoints"),
  events = await json("captured-events");
assert.equal(checks.length, checkpointCount);
if (manifest.completeSourceInventory) {
  const parentBytes = await readFile(manifest.parentScenario.path);
  assert.equal(sha(parentBytes), manifest.parentScenario.sha256);
  const parent = JSON.parse(parentBytes),
    spec = parent.artifacts["campaign-checkpoints"],
    oldBytes = await readFile(spec.path);
  assert.equal(sha(oldBytes), spec.sha256);
  const previous = JSON.parse(oldBytes);
  for (let i = 0; i < 3; i++)
    for (const key of [
      "name",
      "at",
      "eventCount",
      "stateSha256",
      "pixelsSha256",
    ])
      assert.equal(
        checks[i][key],
        previous[i][key],
        `Changed pre-line prefix checkpoint${i} ${key}`,
      );
}

if (manifest.completeSourceInventory)
  for (const key of ["at", "eventCount", "stateSha256", "pixelsSha256"])
    assert.equal(
      checks[26][key],
      checks[27][key],
      "Only an identical extra mountain-entry marker is allowed",
    );
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
assert.equal(acceptedChecks.length, checkpointCount);
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
  assert.equal(observed.length, checkpointCount);
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
    `Current campaign browser:${checkpointCount} full states/pixel digests,4981 actual DOM events,four expeditions,winning deadline ending and restart.`,
  );
} else {
  await mkdir(".local/current-campaign-verification", { recursive: true });
  const root = await mkdtemp(".local/current-campaign-verification/run-");
  const logs = [];
  for (const [name, negative, pattern] of [
    ["positive", null, null],
    ["omit-checkpoint", "omit-checkpoint", /Missing required checkpoints/],
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
      assert.equal(result.checked, checkpointCount);
      assert.equal(result.consumed, 4981);
      assert.equal(result.rendered, manifest.expectedFlightPresentations);
      assert.equal(result.flagAliasPresentations, 0);
      assert.deepEqual(result.state.ending, manifest.expectedEnding);
    }
  }
  await Promise.all(logs);
  console.log(
    `Current campaign replay:${checkpointCount} carried states,4981 required inputs,four expeditions,winning ending;omitted checkpoint,altered ending and unfinished timeline rejected. Reports:${root}`,
  );
}
