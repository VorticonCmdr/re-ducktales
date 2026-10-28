import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/security.spec.js",
  "--grep",
  "first control-center entry",
  "--output=.local/security-negative/browser",
];
if (process.env.DUCKTALES_SECURITY_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_SECURITY_TEST_CONFIG);
const result = spawnSync(process.execPath, args, {
  encoding: "utf8",
  timeout: 75000,
  maxBuffer: 2 * 1024 * 1024,
  env: { ...process.env, DUCKTALES_SECURITY_NEGATIVE: "omit-right" },
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await mkdir(".local/security-negative", { recursive: true });
await writeFile(".local/security-negative/browser.log", output);
assert.ifError(result.error);
assert.equal(
  result.status,
  1,
  "Missing Right must fail the required correct-choice route",
);
assert.match(output, /Unfinished security correct-choice map return/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Security browser negative: omitted real Right input fails the required correct-choice map return.",
);
