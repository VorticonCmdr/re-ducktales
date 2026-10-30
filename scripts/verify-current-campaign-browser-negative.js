import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/mountain-phase-campaign.json";
await mkdir(".local/current-campaign-verification", {
  recursive: true,
});
const root = await mkdtemp(
  ".local/current-campaign-verification/browser-negative-",
);
const r = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/mixed-campaign.spec.js",
    "--config",
    "playwright.campaign.config.js",
    `--output=${root}`,
  ],
  {
    env: {
      ...process.env,
      DUCKTALES_EASY_CAMPAIGN_MANIFEST: manifestPath,
      DUCKTALES_EASY_RECORDED_NEGATIVE: "omit-easy-confirm",
    },
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
await writeFile(`${root}/runner.log`, output);
assert.ifError(r.error);
assert.equal(r.status, 1);
assert.match(output, /1 failed/);
assert.match(output, /Carried browser state0 campaign-start/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|ETIMEDOUT|Channel closed/,
);
console.log(
  `Full current campaign browser negative:missing confirmation rejected by startup state comparison. Report:${root}`,
);
