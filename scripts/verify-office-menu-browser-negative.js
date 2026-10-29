import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/office-menu.spec.js",
  "--grep",
  "office entry bands",
  "--output=.local/office-menu-negative/browser",
];
if (process.env.DUCKTALES_OFFICE_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_OFFICE_TEST_CONFIG);
const result = spawnSync(process.execPath, args, {
  encoding: "utf8",
  timeout: 75000,
  maxBuffer: 2 * 1024 * 1024,
  env: { ...process.env, DUCKTALES_OFFICE_MENU_NEGATIVE: "omit-right-chord" },
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await mkdir(".local/office-menu-negative", { recursive: true });
await writeFile(".local/office-menu-negative/browser.log", output);
assert.ifError(result.error);
assert.equal(result.status, 1, "Missing chord Right must fail");
assert.match(output, /up-right-make/);
assert.match(output, /Expected:\s*3/);
assert.match(output, /Received:\s*1/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Office menu browser negative: missing real chord Right rejected at its original input boundary.",
);
