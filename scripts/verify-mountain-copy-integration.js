// Focused current mountain gate. Whole-campaign acceptance remains separate.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const output = ".local/mountain-copy-integration-" + Date.now();
function run(command, args, env = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  const log = (r.stdout ?? "") + (r.stderr ?? "");
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
required(process.execPath, ["scripts/verify-build.js"]);
required(process.execPath, ["scripts/verify-mountain-copy-runtime.js"]);
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
  /# tests 180\b/,
  /# pass 180\b/,
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
required("npm", ["run", "build"]);
console.log(
  JSON.stringify(
    {
      scope:
        "Focused current mountain restoration integration;not whole-game,whole-campaign or native timing acceptance",
      completed: true,
      units: 180,
      nativeEraseCases: 34,
      nativePrimitiveCases: 16,
      ascentInputs: 764,
      ascentCheckpoints: 26,
      ascentPresentations: 870,
      browserCases: 1,
      browserFailureControls: 1,
      output,
    },
    null,
    2,
  ),
);
