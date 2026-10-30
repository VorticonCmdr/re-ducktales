// Focused cave composition/minimap acceptance; full-campaign replay is separate.
import assert from "node:assert/strict";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const output = ".local/cave-composition-integration-" + Date.now();
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "SETUP: commit focused integration source before capture",
);
await mkdir(output, { recursive: false });
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const archive = execFileSync("git", ["archive", "--format=zip", commit], {
  maxBuffer: 32 * 1024 * 1024,
});
await writeFile(output + "/sources.zip", archive);
const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const files = Object.fromEntries(
  await Promise.all(paths.map(async (p) => [p, sha(await readFile(p))])),
);
await writeFile(
  output + "/source-revision.json",
  JSON.stringify({ commit, archiveSHA256: sha(archive), files }, null, 2) +
    "\n",
);
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("DUCKTALES_")),
);
let logs = "",
  complete = false;
function run(args, extra = {}, expected = 0) {
  const r = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: { ...env, ...extra },
    timeout: 180000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const log = (r.stdout ?? "") + (r.stderr ?? "");
  logs += log;
  process.stdout.write(log);
  assert.ifError(r.error);
  assert.equal(
    r.status,
    expected,
    "Required cave composition check: " + args.join(" "),
  );
  return log;
}
const browser = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "--config",
  "playwright.campaign.config.js",
];
try {
  run(["scripts/verify-build.js"]);
  run(["scripts/verify-cave-composition-work.js"]);
  const core = run(["scripts/verify-cave.js"]);
  assert.match(core, /6 conditional original checkpoints/);
  assert.match(core, /4 independent shortened-path outcomes/);
  const tests = (await readdir("tests"))
    .filter((f) => f.endsWith(".test.js"))
    .sort()
    .map((f) => "tests/" + f);
  const unit = run(["--test", "--test-reporter=tap", ...tests]);
  for (const p of [
    /# tests 194\b/,
    /# pass 194\b/,
    /# fail 0\b/,
    /# skipped 0\b/,
  ])
    assert.match(unit, p);
  const args = [...browser, "tests/browser/cave-input.spec.js"];
  assert.match(run([...args, "--output=" + output + "/positive"]), /1 passed/);
  for (const [mode, pattern] of [
    ["omit-room", /Original cave composition boundary/],
    ["omit-minimap", /Original cave initial minimap/],
  ]) {
    const negative = run(
      [...args, "--output=" + output + "/" + mode],
      { DUCKTALES_CAVE_DRAWING_NEGATIVE: mode },
      1,
    );
    assert.match(negative, /1 failed/);
    assert.match(negative, pattern);
    assert.doesNotMatch(
      negative,
      /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|ETIMEDOUT|Channel closed/,
    );
  }
  const omitted = run(
    [...args, "--output=" + output + "/omit-all"],
    { DUCKTALES_CAVE_TIMING_BROWSER_NEGATIVE: "skip-work" },
    1,
  );
  assert.match(omitted, /1 failed/);
  assert.match(omitted, /Original cave composition boundary/);
  assert.doesNotMatch(
    omitted,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|ETIMEDOUT|Channel closed/,
  );
  run(["node_modules/vite/bin/vite.js", "build"]);
  for (const [p, h] of Object.entries(files))
    assert.equal(sha(await readFile(p)), h, "Changed loaded source " + p);
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    "",
    "Source inventory changed during gate",
  );
  complete = true;
} finally {
  await writeFile(output + "/verification.log", logs);
  await writeFile(
    output + "/result.json",
    JSON.stringify(
      {
        completed: complete,
        commit,
        units: 194,
        browserCases: 1,
        browserFailureControls: 3,
        sourceFileCount: paths.length,
        output,
        scope:
          "Focused cave composition/minimap runtime, independent component routes and actual browser controls; no whole-campaign or native uninterrupted timing acceptance",
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Cave composition integration record: " + output);
}
