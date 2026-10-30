// Validate an immutable saved combined gate; this never substitutes for a fresh gate.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(
  await readFile("reference/cave-composition-campaign-integration.json"),
);
assert.equal(m.id, "cave-composition-campaign-clean-integration");
const data = {};
assert.ok(Object.keys(m.artifacts).length >= 6, "Zero or incomplete receipt");
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing cave campaign receipt " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt receipt size " + role);
  assert.equal(sha(b), s.sha256, "Corrupt receipt checksum " + role);
  data[role] = b;
}
const status = JSON.parse(data.status),
  source = JSON.parse(data.source);
assert.equal(status.exitCode, 0);
assert.equal(status.completed, true);
assert.equal(status.loadedSourcesUnchanged, true);
assert.equal(status.historicalArtifactsPreserved, true);
assert.equal(source.commit, m.sourceCommit);
assert.equal(status.sourceCommit, m.sourceCommit);
assert.equal(Object.keys(source.files).length, m.sourceFileCount);
assert.equal(status.sourceFileCount, m.sourceFileCount);
assert.equal(status.captureToolSHA256, m.artifacts.runner.sha256);
assert.equal(
  status.captureToolSHA256,
  source.files["scripts/capture-mountain-phase-integration.py"],
);
assert.equal(
  Object.keys(status.protectedArtifacts).length,
  m.protectedArtifactCount,
);
for (const [p, h] of Object.entries(status.protectedArtifacts))
  assert.equal(sha(await readFile(p)), h, "Changed protected artifact " + p);
for (const [p, h] of Object.entries(m.checkedSources))
  assert.equal(sha(await readFile(p)), h, "Changed acceptance source " + p);
const r = spawnSync("git", ["archive", "--format=zip", source.commit], {
  timeout: 30000,
  maxBuffer: 32 * 1024 * 1024,
});
assert.ifError(r.error);
assert.equal(r.status, 0, "SETUP: missing source revision");
assert.equal(sha(r.stdout), source.archiveSha256);
assert.equal(sha(data.archive), source.archiveSha256);
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
assert.equal(inventory.status, 0, "Corrupt archived inventory");
for (const p of [
  /# tests 194\b/,
  /# pass 194\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
  /Current campaign replay:34 carried states,4981 required inputs/,
  /Current campaign browser:34 full states\/pixel digests,4981 actual DOM events/,
  /Full campaign fixture controls:5 broken contracts rejected/,
  /Full current campaign browser negative:missing confirmation rejected/,
  /BIOS seed: 3 exact source ranges/,
  /Original BIOS confirmation read/,
  /3 passed/,
  /"phaseCases": 6/,
  /"browserFailureControls": 4/,
  /Current runtime gate passed:22 originals,194 units/,
  /Cave composition:598 original bytes,512 source-derived room plans/,
  /Original cave composition boundary/,
  /Original cave initial minimap/,
  /4 independent shortened-path outcomes/,
])
  assert.match(data.log.toString(), p);
const focusedResults = Object.entries(m.artifacts)
  .filter(([k]) => k.startsWith("generated-") && k.endsWith("/result.json"))
  .map(([key]) => JSON.parse(data[key]));
assert.ok(
  focusedResults.some(
    (r) =>
      r.completed === true &&
      r.units === 194 &&
      r.browserCases === 8 &&
      r.browserFailureControls === 1,
  ),
  "Missing focused BIOS result",
);
assert.ok(
  focusedResults.some(
    (r) =>
      r.completed === true &&
      r.units === 194 &&
      r.browserCases === 1 &&
      r.browserFailureControls === 3,
  ),
  "Missing focused cave result",
);
console.log(
  `Saved cave campaign acceptance:${m.sourceFileCount} source files,${Object.keys(m.artifacts).length} artifacts,${m.protectedArtifactCount} preserved historical artifacts; complete Easy route, cave composition and default-clock browser cases.`,
);
