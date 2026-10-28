import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/difficulty.spec.js",
  "--grep",
  "original difficulty pictures",
  "--output=.local/difficulty-browser-negative",
];
if (process.env.DUCKTALES_DIFFICULTY_BROWSER_CONFIG)
  args.push("--config", process.env.DUCKTALES_DIFFICULTY_BROWSER_CONFIG);
const run = spawnSync(process.execPath, args, {
  env: { ...process.env, DUCKTALES_DIFFICULTY_NEGATIVE: "omit-up" },
  encoding: "utf8",
  timeout: 60000,
  maxBuffer: 4 * 1024 * 1024,
});
const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
await mkdir(".local/difficulty-verification", { recursive: true });
await writeFile(".local/difficulty-verification/browser-negative.log", output);
assert.ifError(run.error);
assert.equal(run.status, 1, "Missing menu input must fail acceptance");
assert.match(output, /Unfinished selected2/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|browserType\.launch:/,
);
console.log(
  "Difficulty browser negative: omitted Up rejected at required Hard selection.",
);
