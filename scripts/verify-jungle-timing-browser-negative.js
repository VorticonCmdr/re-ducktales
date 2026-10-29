import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root =
  process.env.DUCKTALES_JUNGLE_TIMING_VERIFICATION_ROOT ??
  ".local/jungle-drawing-timing-verification";
await mkdir(root, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/jungle-input.spec.js",
    `--output=${root}/browser-negative`,
    "--config",
    process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG ??
      "playwright.campaign.config.js",
  ],
  {
    env: {
      ...process.env,
      DUCKTALES_JUNGLE_ENTRY_MANIFEST: "reference/destination-jungle-entry.json",
      DUCKTALES_JUNGLE_TIMING_BROWSER_NEGATIVE: "zero-work",
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
assert.match(output, /Jungle first redraw duration/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Jungle timing browser negative: omitted graphics wait rejected by actual first-redraw duration.",
);
