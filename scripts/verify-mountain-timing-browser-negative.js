import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root =
  process.env.DUCKTALES_MOUNTAIN_TIMING_VERIFICATION_ROOT ??
  ".local/mountain-sprite-timing-verification";
await mkdir(root, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/mountain-input.spec.js",
    `--output=${root}/browser-negative`,
    "--config",
    process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG ??
      "playwright.campaign.config.js",
  ],
  {
    env: {
      ...process.env,
      DUCKTALES_MOUNTAIN_TIMING_BROWSER_NEGATIVE: "one-retrace",
    },
    encoding: "utf8",
    timeout: 90000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(`${root}/browser-negative.log`, output);
assert.ifError(result.error);
assert.equal(result.status, 1);
assert.match(output, /Mountain timed DOM movement/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Mountain timing browser negative: one-retrace presentation rejected by fixed-duration DOM movement.",
);
