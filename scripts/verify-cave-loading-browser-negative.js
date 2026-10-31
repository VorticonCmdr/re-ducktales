import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root = process.env.DUCKTALES_CAVE_LOADING_VERIFICATION_ROOT ?? ".local/cave-loading-negative";
await mkdir(root, { recursive: true });
const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test",
  "tests/browser/cave-input.spec.js", "--config", "playwright.campaign.config.js",
  `--output=${root}/browser-negative`], {
  env: { ...process.env, DUCKTALES_CAVE_LOAD_BROWSER_NEGATIVE: "skip-load-work" },
  encoding: "utf8", timeout: 180000, maxBuffer: 4 * 1024 * 1024,
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(`${root}/browser-negative.log`, output);
assert.ifError(result.error);
assert.equal(result.status, 1);
assert.match(output, /Original cave resource loading boundary/);
assert.match(output, /1 failed/);
assert.doesNotMatch(output, /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/);
console.log("Cave loading browser negative:retained work counters without actual loader waits rejected at the observed resource boundary.");
