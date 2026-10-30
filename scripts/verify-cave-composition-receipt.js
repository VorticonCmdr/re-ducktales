// Saved focused acceptance; this does not run a fresh browser or full campaign.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(
  await readFile("reference/cave-composition-integration.json"),
);
assert.equal(m.id, "cave-composition-clean-integration");
assert.equal(Object.keys(m.artifacts).length, m.expectedArtifactCount);
assert.ok(m.expectedArtifactCount >= 8, "Incomplete saved acceptance");
const data = {};
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing cave acceptance " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt cave receipt size " + role);
  assert.equal(sha(b), s.sha256, "Corrupt cave receipt checksum " + role);
  data[role] = b;
}
const source = JSON.parse(data.source),
  result = JSON.parse(data.result);
assert.equal(result.completed, true);
assert.equal(result.commit, m.sourceCommit);
assert.equal(source.commit, m.sourceCommit);
assert.equal(Object.keys(source.files).length, m.sourceFileCount);
assert.equal(result.sourceFileCount, m.sourceFileCount);
assert.equal(result.units, 194);
assert.equal(result.browserCases, 1);
assert.equal(result.browserFailureControls, 3);
assert.equal(sha(data.archive), source.archiveSHA256);
const git = spawnSync("git", ["archive", "--format=zip", source.commit], {
  timeout: 30000,
  maxBuffer: 32 * 1024 * 1024,
});
assert.ifError(git.error);
assert.equal(git.status, 0, "SETUP: missing cave source revision");
assert.equal(sha(git.stdout), source.archiveSHA256);
const inventory = spawnSync(
  "python3",
  [
    "-c",
    "import json,zipfile,hashlib,sys;z=zipfile.ZipFile(sys.argv[1]);s=json.load(open(sys.argv[2]));assert {n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}==s['files']",
    m.artifacts.archive.path,
    m.artifacts.source.path,
  ],
  { timeout: 30000 },
);
assert.ifError(inventory.error);
assert.equal(inventory.status, 0, "Incomplete archived source inventory");
for (const [p, h] of Object.entries(m.checkedSources))
  assert.equal(sha(await readFile(p)), h, "Changed focused cave source " + p);
assert.equal(
  sha(data.runner),
  source.files["scripts/verify-cave-composition-integration.js"],
);
const log = data.log.toString();
for (const pattern of [
  /598 original bytes,512 source-derived room plans/,
  /6 conditional original checkpoints/,
  /4 independent shortened-path outcomes/,
  /# tests 194\b/,
  /# pass 194\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
  /1 passed/,
  /Original cave composition boundary/,
  /Original cave initial minimap/,
  /built in/,
])
  assert.match(log, pattern);
assert.equal(
  (log.match(/1 failed/g) ?? []).length,
  3,
  "Missing required browser failure control",
);
assert.deepEqual(JSON.parse(data["positive-status"]), {
  status: "passed",
  failedTests: [],
});
for (const key of [
  "omit-room-status",
  "omit-minimap-status",
  "omit-all-status",
]) {
  const r = JSON.parse(data[key]);
  assert.equal(r.status, "failed");
  assert.equal(r.failedTests.length, 1);
}
console.log(
  `Saved cave composition acceptance:${m.sourceFileCount} source files,${m.expectedArtifactCount} artifacts,194 units,4 independent outcomes/replays,1 browser route and3 omission controls;full campaign replay pending.`,
);
