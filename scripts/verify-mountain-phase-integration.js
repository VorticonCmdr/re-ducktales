// Focused current mountain phase gate. Whole-campaign acceptance remains separate.
import assert from "node:assert/strict";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const output = ".local/mountain-phase-integration-" + Date.now();
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
const envBase = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("DUCKTALES_")),
);
let logText = "",
  result = null,
  errorText = null;
function run(command, args, env = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...envBase, ...env },
  });
  const log = (r.stdout ?? "") + (r.stderr ?? "");
  logText += log;
  process.stdout.write(log);
  assert.ifError(r.error);
  return { status: r.status, log };
}
function required(command, args) {
  const r = run(command, args);
  assert.equal(
    r.status,
    0,
    "Required mountain check failed: " + args.join(" "),
  );
  return r.log;
}
try {
  required(process.execPath, ["scripts/verify-build.js"]);
  required(process.execPath, ["scripts/verify-mountain-copy-runtime.js"]);
  required(process.execPath, ["scripts/verify-mountain-hud-runtime.js"]);
  required(process.execPath, ["scripts/verify-mountain-phase.js"]);
  const tests = (await readdir("tests"))
    .filter((f) => f.endsWith(".test.js"))
    .sort()
    .map((f) => "tests/" + f);
  const unit = required(process.execPath, [
    "--test",
    "--test-reporter=tap",
    ...tests,
  ]);
  for (const pattern of [
    /# tests 186\b/,
    /# pass 186\b/,
    /# fail 0\b/,
    /# skipped 0\b/,
  ])
    assert.match(unit, pattern);
  const args = [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/mountain-input.spec.js",
    "--config",
    "playwright.campaign.config.js",
  ];
  const positive = required(process.execPath, [
    ...args,
    "--output=" + output + "/positive",
  ]);
  assert.match(positive, /1 passed/);
  const negative = run(
    process.execPath,
    [...args, "--output=" + output + "/negative"],
    { DUCKTALES_MOUNTAIN_COPY_NEGATIVE: "omit-copies" },
  );
  assert.equal(negative.status, 1, "Browser accepted omitted copy work");
  assert.match(negative.log, /Original mountain copy work/);
  assert.match(negative.log, /1 failed/);
  for (const mode of ["omit-lines", "omit-numbers"]) {
    const r = run(
      process.execPath,
      [...args, "--output=" + output + "/" + mode],
      { DUCKTALES_MOUNTAIN_HUD_NEGATIVE: mode },
    );
    assert.equal(r.status, 1, "Browser accepted omitted HUD work");
    assert.match(
      r.log,
      new RegExp(
        mode === "omit-lines"
          ? "Original mountain HUD lines"
          : "Original mountain HUD numbers",
      ),
    );
    assert.match(r.log, /1 failed/);
  }
  const timing = run(
    process.execPath,
    [...args, "--output=" + output + "/one-retrace"],
    { DUCKTALES_MOUNTAIN_TIMING_BROWSER_NEGATIVE: "one-retrace" },
  );
  assert.equal(timing.status, 1, "Browser accepted omitted graphics deadline");
  assert.match(timing.log, /Mountain timed DOM movement/);
  assert.match(timing.log, /1 failed/);
  required("npm", ["run", "build"]);
  for (const [p, h] of Object.entries(files))
    assert.equal(sha(await readFile(p)), h, "Changed loaded source " + p);
  result = {
    scope:
      "Focused current mountain phase integration;not whole-game,whole-campaign or native timing acceptance",
    completed: true,
    units: 186,
    nativeEraseCases: 34,
    nativePrimitiveCases: 16,
    ascentInputs: 764,
    ascentCheckpoints: 26,
    ascentPresentations: 870,
    browserCases: 1,
    browserFailureControls: 4,
    nativeHudCases: 12,
    nativeHudCalls: 486,
    phaseCases: 6,
    retainedOriginalSamples: 80,
    output,
  };
  await writeFile(
    output + "/result.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  const final = JSON.stringify(result, null, 2) + "\n";
  logText += final;
  process.stdout.write(final);
} catch (error) {
  errorText = String(error);
  throw error;
} finally {
  await writeFile(output + "/verification.log", logText);
  await writeFile(
    output + "/runner-status.json",
    JSON.stringify(
      {
        command: "node scripts/verify-mountain-phase-integration.js",
        sourceCommit: commit,
        completed: result !== null,
        exitCode: result ? 0 : 1,
        error: errorText,
      },
      null,
      2,
    ) + "\n",
  );
}
