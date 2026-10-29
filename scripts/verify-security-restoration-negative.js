import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const root = ".local/security-restoration-negative";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/security.spec.js",
    "--config",
    "playwright.campaign.config.js",
    "--grep",
    "optional original security",
    `--output=${root}/browser`,
  ],
  {
    encoding: "utf8",
    timeout: 75000,
    maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, DUCKTALES_SECURITY_NEGATIVE: "omit-restoration" },
  },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await mkdir(root, { recursive: true });
await writeFile(`${root}/browser.log`, output);
assert.ifError(result.error);
assert.equal(
  result.status,
  1,
  "Removing the opt-in must fail the rejection check",
);
assert.match(output, /Unfinished security restored rejection/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Security restoration negative: removing the real checkbox input fails the required rejection.",
);
