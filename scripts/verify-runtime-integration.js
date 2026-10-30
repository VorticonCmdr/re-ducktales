import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(
  await readFile("reference/speaker-runtime-integration.json"),
);
assert.equal(m.id, "persistent-speaker-runtime-clean-integration");
assert.equal(m.exitCode, 0);
assert.equal(m.checks.unitCases, 180);
assert.equal(m.checks.unitFailures, 0);
assert.equal(m.checks.unitSkips, 0);
assert.equal(m.checks.checkpoints, 34);
assert.equal(m.checks.requiredDOMEvents, 4981);
assert.equal(m.checks.campaignNegativeControls, 9);
assert.equal(m.checks.registeredActualAudioBrowserCases, 7);
function check(bytes, spec) {
  assert.equal(bytes.length, spec.bytes, "Corrupt integration artifact size");
  assert.equal(
    hash(bytes),
    spec.sha256,
    "Corrupt integration artifact checksum",
  );
}
const artifacts = {};
for (const [role, spec] of Object.entries(m.artifacts)) {
  const b = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing integration evidence ${spec.path}`);
  });
  check(b, spec);
  artifacts[role] = b;
}
assert.equal(
  Object.keys(artifacts).length,
  27,
  "Missing integration artifact declarations",
);
for (const spec of [m.scenario, m.audioScenario])
  check(await readFile(spec.path), spec);
const root = ".local/speaker-runtime-integration-01/";
const source = JSON.parse(artifacts[root + "source-revision.json"]);
const status = JSON.parse(artifacts[root + "runner-status.json"]);
assert.equal(status.sourceCommit, m.sourceCommit);
assert.equal(source.commit, m.sourceCommit);
assert.equal(Object.keys(source.files).length, m.sourceFileCount);
assert.equal(status.exitCode, 0);
assert.equal(status.historicalArtifactsPreserved, true);
assert.equal(
  Object.keys(status.protectedArtifacts).length,
  m.checks.protectedHistoricalArtifacts,
);
for (const [p, expected] of Object.entries(status.protectedArtifacts))
  assert.equal(
    hash(await readFile(p)),
    expected,
    `Changed protected artifact ${p}`,
  );
const archive = spawnSync("git", ["archive", "--format=zip", m.sourceCommit], {
  timeout: 30000,
  maxBuffer: 32 * 1024 * 1024,
});
assert.ifError(archive.error);
assert.equal(archive.status, 0, "SETUP: missing clean source revision");
assert.equal(hash(archive.stdout), source.archiveSha256);
assert.equal(hash(artifacts[root + "sources.zip"]), source.archiveSha256);
const log = artifacts[root + "verification.log"].toString();
for (const pattern of [
  /# tests 180\b/,
  /# pass 180\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
  /Full campaign fixture controls:5 broken contracts rejected/,
  /Current campaign replay:34 carried states,4981 required inputs/,
  /Current campaign browser:34 full states\/pixel digests/,
  /Full current campaign browser negative:missing confirmation rejected/,
  /Current runtime gate passed:/,
])
  assert.match(log, pattern);
const sample = m.artifacts[root + "verification.log"];
assert.throws(() => check(Buffer.alloc(0), sample), /size/);
assert.throws(
  () =>
    check(artifacts[root + "verification.log"], {
      ...sample,
      sha256: "0".repeat(64),
    }),
  /checksum/,
);
assert.equal(
  hash(await readFile("scripts/verify-runtime-integration.js")),
  m.receiptVerifierSHA256,
);
console.log(
  "Clean runtime integration receipt verified:734 archived files,27 exact evidence artifacts,879 preserved historical artifacts,180 units,34 campaign checkpoints;2 receipt negative controls.",
);
