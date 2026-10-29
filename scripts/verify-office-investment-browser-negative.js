import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/office-investments.spec.js",
  "--grep",
  "original investment departure pictures",
  "--output=.local/office-investment-negative/browser",
];
if (process.env.DUCKTALES_OFFICE_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_OFFICE_TEST_CONFIG);
const result = spawnSync(process.execPath, args, {
  encoding: "utf8",
  timeout: 75000,
  maxBuffer: 2 * 1024 * 1024,
  env: { ...process.env, DUCKTALES_INVESTMENT_DEPARTURE_NEGATIVE: "omit-left" },
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await mkdir(".local/office-investment-negative", { recursive: true });
await writeFile(".local/office-investment-negative/browser.log", output);
assert.ifError(result.error);
assert.equal(result.status, 1, "Missing Left must fail");
assert.match(output, /Unfinished office investment departure entry/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Investment departure browser negative: missing real Left rejects the required animation entry.",
);
