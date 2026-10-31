// Reproducible scoped admission. Full original timing and whole-campaign replay
// are separate gates and cannot be satisfied by this command.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const output = process.argv.find(a => a.startsWith("--output="))?.slice(9);
assert.ok(output?.startsWith(".local/"), "SETUP: supply a fresh --output=.local/NAME");
assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "",
  "SETUP: commit source before source-pinned verification");
await mkdir(output, { recursive: false });
const sha = b => createHash("sha256").update(b).digest("hex");
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const archive = execFileSync("git", ["archive", "--format=zip", commit], { maxBuffer: 32 * 1024 * 1024 });
await writeFile(output + "/sources.zip", archive);
const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const files = Object.fromEntries(await Promise.all(paths.map(async p => [p, sha(await readFile(p))])));
await writeFile(output + "/source-revision.json", JSON.stringify({ commit, archiveSHA256: sha(archive), files }, null, 2) + "\n");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("DUCKTALES_")));
env.PYTHONDONTWRITEBYTECODE = "1";
const checks = [];
function run(name, executable, args, patterns, extra = {}) {
  const r = spawnSync(executable, args, { encoding: "utf8", env: { ...env, ...extra },
    timeout: 240000, maxBuffer: 16 * 1024 * 1024 });
  const log = (r.stdout ?? "") + (r.stderr ?? "");
  writeFileSync(output + "/" + name + ".log", log);
  assert.ifError(r.error);
  assert.equal(r.status, 0, "Required check failed:" + name + "\n" + log);
  for (const pattern of patterns) assert.match(log, pattern, "Missing required result:" + name);
  checks.push({ name, status: 0, log: name + ".log", sha256: sha(log) });
  console.log("Passed:" + name);
}
let accepted = false;
try {
  run("work", process.execPath, ["scripts/verify-sprite-load-work.js"], [/"spriteCases": 46/, /"pictureCases": 1/, /"negativeControls": 10/]);
  run("boundaries", "python3", ["scripts/verify_cave_load_boundaries.py"], [/1075 original bytes\/396 instructions/, /2 negatives/]);
  run("startup-order", "python3", ["scripts/verify_cave_startup_order.py"], [/263 original bytes\/86 instructions/, /2 negatives/]);
  run("sequence", process.execPath, ["scripts/verify-cave-load-sequence.js"], [/4 original phase states\/all9 fields/, /3 negatives/]);
  run("passages", process.execPath, ["scripts/verify-cave-passage-order.js"], [/historical ordering negative rejected/]);
  run("routes", process.execPath, ["scripts/verify-cave.js"], [/6 conditional original checkpoints/, /4 independent shortened-path outcomes/]);
  const tests = (await readdir("tests")).filter(p => p.endsWith(".test.js")).sort().map(p => "tests/" + p);
  run("unit", process.execPath, ["--test", "--test-reporter=tap", ...tests], [/# tests 220\b/, /# pass 220\b/, /# fail 0\b/, /# skipped 0\b/]);
  run("browser", process.execPath, ["node_modules/@playwright/test/cli.js", "test", "tests/browser/cave-input.spec.js", "--config", "playwright.campaign.config.js", "--output=" + output + "/browser"], [/1 passed/]);
  run("loading-negative", process.execPath, ["scripts/verify-cave-loading-browser-negative.js"], [/retained work counters without actual loader waits rejected/], { DUCKTALES_CAVE_LOADING_VERIFICATION_ROOT: output + "/negative" });
  run("build", process.execPath, ["node_modules/vite/bin/vite.js", "build"], [/built in/]);
  assert.equal(checks.length, 10, "Unfinished required checks");
  for (const p of paths) assert.equal(sha(await readFile(p)), files[p], "Source changed during verification:" + p);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "", "Source changed during verification");
  accepted = true;
} finally {
  await writeFile(output + "/acceptance-status.json", JSON.stringify({ kind: "cave-counted-loading-scoped-admission", accepted,
    commit, checks, wholeCaveTimingAccepted: false, wholeCampaignAccepted: false,
    initialPreparationTimed: false, sourceArchiveSHA256: sha(archive) }, null, 2) + "\n");
}
console.log("Scoped cave counted loading accepted;complete original timing and fresh full campaign replay remain open.");
