// Historical full-gate receipt, separately scoped from a fresh npm run verify.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import manifest from "../reference/security-integration.json" with { type: "json" };
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) => readFile(p).catch(() => {
  throw Error(`SETUP: missing integration receipt ${p}; run npm run verify for fresh acceptance`);
});
assert.equal(manifest.completed, true);
assert.equal(manifest.exitCode, 0);
assert.equal(manifest.command, "npm run verify");
assert.equal(manifest.unitCases, 117);
assert.equal(manifest.developmentBrowserCases, 87);
assert.equal(manifest.productionBrowserCases, 2);
assert.equal(manifest.skips, 0);
assert.equal(sha(await required(manifest.buildManifest)), manifest.buildManifestSha256);
assert.equal(Object.keys(manifest.artifacts).length, 4);
for (const a of Object.values(manifest.artifacts)) {
  const b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${a.path}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${a.path}`);
}
const load = async (name) => required(manifest.artifacts[name].path);
for (const name of ["development-status.json", "production-status.json"])
  assert.deepEqual(JSON.parse(await load(name)), { status: "passed", failedTests: [] });
const source = JSON.parse(await load("source-revision.json"));
assert.equal(source.commit, manifest.sourceCommit);
assert.equal(manifest.sourceFileCount, 472);
assert.equal(Object.keys(source.files).length, manifest.sourceFileCount);
const root = manifest.artifacts["source-revision.json"].path.replace(/\/source-revision\.json$/, "");
for (const [p, h] of Object.entries(source.files)) {
  assert.equal(sha(await required(`${root}/sources/${p}`)), h, p);
  assert.equal(sha(execFileSync("git", ["show", `${source.commit}:${p}`])), h, p);
}
function checkLog(log) {
  for (const text of ["ℹ tests 117", "ℹ pass 117", "ℹ fail 0", "ℹ skipped 0"])
    assert.ok(log.includes(text), `Missing unit outcome: ${text}`);
  assert.match(log, /^  87 passed /m);
  assert.match(log, /^  2 passed /m);
  assert.equal([...log.matchAll(/^  ✓\s+\d+ tests\/browser\//gm)].length, 87);
  assert.equal([...log.matchAll(/^  ✓\s+\d+ tests\/production\//gm)].length, 2);
  assert.doesNotMatch(log, /^\s*(?:\d+ (?:failed|skipped|flaky)|✘)/m);
  for (const marker of [
    "Hard campaign: 28 exact", "Easy campaign: 36 exact",
    "Hard browser negative control:", "Difficulty browser negative:",
    "Office browser negative:", "Security browser negative:",
  ]) assert.ok(log.includes(marker), `Missing required gate segment ${marker}`);
}
const log = (await load("verify-attempt03.log")).toString();
checkLog(log);
assert.throws(() => checkLog(log.replace(/^  ✓\s+\d+ tests\/browser\/.*\n/m, "")));
assert.throws(() => checkLog(log.replace("ℹ pass 117", "ℹ pass 116")));
assert.throws(() => checkLog(log.replace("  87 passed ", "  86 passed ")));
assert.throws(() => checkLog(`${log}\n  1 skipped\n`));
assert.throws(() => checkLog(log.replace("Security browser negative:", "Missing security negative:")));
console.log("Security integration receipt:117 unit/87 development/2 production cases,zero skips,472 exact archived sources;5 damaged-report negatives rejected. Historical receipt,not fresh whole-game acceptance.");
