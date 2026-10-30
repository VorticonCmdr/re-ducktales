import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(
  await readFile("reference/mountain-phase-campaign-integration.json"),
);
assert.equal(m.id, "mountain-phase-campaign-clean-integration");
assert.equal(m.exitCode, 0);
function check(b, s) {
  assert.equal(b.length, s.bytes, "Corrupt campaign receipt size");
  assert.equal(sha(b), s.sha256, "Corrupt campaign receipt checksum");
}
const data = {};
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error(`SETUP: missing campaign integration ${s.path}`);
  });
  check(b, s);
  data[role] = b;
}
const status = JSON.parse(data.status),
  source = JSON.parse(data.source);
assert.equal(status.exitCode, 0);
assert.equal(status.completed, true);
assert.equal(status.loadedSourcesUnchanged, true);
assert.equal(status.captureToolSHA256, m.artifacts.runner.sha256);
assert.equal(
  status.captureToolSHA256,
  source.files["scripts/capture-mountain-phase-integration.py"],
);
assert.equal(status.historicalArtifactsPreserved, true);
assert.equal(status.sourceCommit, m.sourceCommit);
assert.equal(source.commit, m.sourceCommit);
assert.equal(Object.keys(source.files).length, m.sourceFileCount);
assert.equal(status.sourceFileCount, m.sourceFileCount);
assert.equal(
  Object.keys(status.protectedArtifacts).length,
  m.protectedArtifactCount,
);
for (const [p, h] of Object.entries(status.protectedArtifacts))
  assert.equal(sha(await readFile(p)), h, `Changed protected evidence ${p}`);
for (const [p, h] of Object.entries(m.checkedSources))
  assert.equal(sha(await readFile(p)), h, `Changed integration source ${p}`);
const git = spawnSync("git", ["archive", "--format=zip", m.sourceCommit], {
  timeout: 30000,
  maxBuffer: 32 * 1024 * 1024,
});
assert.ifError(git.error);
assert.equal(git.status, 0, "SETUP: missing integration revision");
assert.equal(sha(git.stdout), source.archiveSha256);
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
assert.equal(inventory.status, 0, "Corrupt archived source inventory");
const log = data.log.toString();
for (const p of [
  /# tests 186\b/,
  /# pass 186\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
  /runtime text timing:824 carried inputs,875 ordered images/,
  /treasure text timing:792 carried inputs,839 ordered images/,
  /Full campaign fixture controls:5 broken contracts rejected/,
  /Current campaign replay:34 carried states,4981 required inputs/,
  /Current campaign browser:34 full states\/pixel digests/,
  /Full current campaign browser negative:missing confirmation rejected/,
  /zero drawing deadline rejected at actual publication boundary/,
  /omitted numeric work rejected by the native-counted HUD budget/,
  /Current runtime gate passed:/,
  /Focused current mountain phase integration/,
  /"phaseCases": 6/,
  /"browserFailureControls": 4/,
  /Mountain timed DOM movement/,
])
  assert.match(log, p);
const report = JSON.parse(data.browser),
  cases = [];
function visit(s) {
  for (const p of s.specs ?? []) cases.push(...p.tests);
  for (const c of s.suites ?? []) visit(c);
}
for (const s of report.suites) visit(s);
assert.deepEqual(report.errors, []);
assert.equal(cases.length, 1, "Missing fresh browser case");
assert.equal(cases[0].expectedStatus, "passed");
assert.equal(cases[0].results.length, 1);
assert.equal(cases[0].results[0].status, "passed");
const progress = JSON.parse(data.progress);
assert.equal(progress.completed, true);
assert.equal(progress.consumed, 1016);
assert.deepEqual(progress.errors, []);
assert.equal(JSON.parse(data.checkpoints).length, 3);
const attachments = cases[0].results[0].attachments.filter(
  (a) => a.name === "line-boundaries",
);
assert.equal(attachments.length, 1, "Missing drawing boundaries");
const boundary = JSON.parse(Buffer.from(attachments[0].body, "base64"));
assert.ok(boundary.first.drawingWork.lineInstructions > 0);
assert.equal(boundary.first.drawingWork.omittedLines, 0);
assert.equal(boundary.first.drawingWork.textInstructions, 641);
assert.equal(boundary.first.drawingWork.textFormatterInstructions, 269);
assert.equal(boundary.first.drawingWork.textDriverInstructions, 372);
assert.equal(boundary.first.drawingWork.textPortWrites, 40);
assert.equal(boundary.first.drawingWork.instructions, 476996);
assert.equal(boundary.first.drawingWork.omittedTexts, 0);
assert.ok(boundary.moved.x > boundary.beforeMove.x);
assert.equal(boundary.moved.lives, 3);
assert.throws(() => check(Buffer.alloc(0), m.artifacts.log), /size/);
assert.throws(
  () => check(data.log, { ...m.artifacts.log, sha256: "0".repeat(64) }),
  /checksum/,
);
assert.equal(
  sha(await readFile("scripts/verify-mountain-phase-campaign-receipt.js")),
  m.receiptVerifierSHA256,
);
console.log(
  "Clean mountain-phase Easy campaign receipt verified:186 units,34 campaign checkpoints,4981 inputs,fresh jungle and mountain controls and required browser failure cases;2 receipt negatives. Full positive browser replay is source-pinned registered evidence,not another fresh run. Hard and native whole-game timing remain unproven.",
);
