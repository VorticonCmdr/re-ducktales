import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/jungle-line-integration.json"));
assert.equal(m.id, "jungle-line-clean-integration");
assert.equal(m.completed, true);
function check(b, s) {
  assert.equal(b.length, s.bytes, "Corrupt line receipt size");
  assert.equal(sha(b), s.sha256, "Corrupt line receipt checksum");
}
const data = {};
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error(`SETUP: missing line integration ${s.path}`);
  });
  check(b, s);
  data[role] = b;
}
const status = JSON.parse(data.status),
  source = JSON.parse(data.source);
assert.equal(status.completed, true);
assert.equal(status.sourceCommit, m.sourceCommit);
assert.equal(source.commit, m.sourceCommit);
assert.deepEqual(status.checks, m.checks);
assert.equal(Object.keys(source.files).length, status.sourceFileCount);
for (const [p, h] of Object.entries(status.protectedFiles))
  assert.equal(
    sha(await readFile(p)),
    h,
    `Changed protected line evidence ${p}`,
  );
for (const [p, h] of Object.entries(m.checkedSources))
  assert.equal(
    sha(await readFile(p)),
    h,
    `Changed line integration source ${p}`,
  );
const git = spawnSync("git", ["archive", "--format=zip", m.sourceCommit], {
  timeout: 30000,
  maxBuffer: 32 * 1024 * 1024,
});
assert.ifError(git.error);
assert.equal(git.status, 0, "SETUP: missing integration revision");
assert.equal(sha(git.stdout), source.archiveSHA256);
assert.equal(sha(data.archive), source.archiveSHA256);
const browser = JSON.parse(data.browser);
function cases(r) {
  const result = [];
  function visit(s) {
    for (const p of s.specs ?? []) result.push(...p.tests);
    for (const c of s.suites ?? []) visit(c);
  }
  for (const s of r.suites) visit(s);
  assert.deepEqual(r.errors, []);
  assert.equal(result.length, 1, "Missing browser case");
  assert.equal(result[0].expectedStatus, "passed");
  assert.equal(result[0].results.length, 1);
  assert.equal(
    result[0].results[0].status,
    "passed",
    "Skipped/unfinished browser case",
  );
  return result;
}
cases(browser);
assert.throws(() => cases({ ...browser, suites: [] }), /Missing browser case/);
const skipped = structuredClone(browser);
const mark = (s) => {
  for (const p of s.specs ?? [])
    for (const t of p.tests) t.results[0].status = "skipped";
  for (const c of s.suites ?? []) mark(c);
};
for (const s of skipped.suites) mark(s);
assert.throws(() => cases(skipped), /Skipped/);
const progress = JSON.parse(data.progress);
assert.equal(progress.completed, true);
assert.equal(progress.consumed, 1016);
assert.deepEqual(progress.errors, []);
assert.equal(JSON.parse(data.checkpoints).length, 3);
const boundary = JSON.parse(data.boundaries);
assert.ok(boundary.first.drawingWork.lineInstructions > 0);
assert.equal(boundary.first.drawingWork.omittedLines, 0);
assert.ok(boundary.moved.x > boundary.beforeMove.x);
assert.equal(boundary.moved.lives, 3);
const log = data.log.toString();
for (const p of [
  /# tests 180\b/,
  /# pass 180\b/,
  /# fail 0\b/,
  /# skipped 0\b/,
  /runtime line timing: 824 carried inputs,875 ordered images/,
  /treasure line timing: 792 carried inputs,839 ordered images/,
  /zero drawing deadline rejected at actual publication boundary/,
])
  assert.match(log, p);
assert.throws(
  () => check(data.log, { ...m.artifacts.log, sha256: "0".repeat(64) }),
  /checksum/,
);
assert.equal(
  sha(await readFile("scripts/verify-jungle-line-receipt.js")),
  m.receiptVerifierSHA256,
);
console.log(
  "Jungle line clean receipt verified:180 units,1616 inputs,1714 images,40 checkpoints,17 component negatives,browser walking/pause/quit and deadline control;3 receipt negatives. Not full campaign or native whole-level timing acceptance.",
);
