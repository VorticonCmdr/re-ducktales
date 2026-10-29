import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
await mkdir(".local/hard-security-campaign-verification", { recursive: true });
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/hard-campaign.spec.js",
  "--output=.local/hard-security-campaign-browser-negative",
];
if (process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG);
const r = spawnSync(process.execPath, args, {
  env: {
    ...process.env,
    DUCKTALES_RECORDED_NEGATIVE: "omit-hard-choice",
    DUCKTALES_CAPTURE_HARD_CAMPAIGN: "0",
  },
  encoding: "utf8",
  timeout: 60000,
  maxBuffer: 4 * 1024 * 1024,
});
const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
await writeFile(
  ".local/hard-security-campaign-verification/browser-negative.log",
  output,
);
assert.ifError(r.error);
assert.equal(r.status, 1, "Missing real browser input must fail");
assert.match(output, /Carried browser state0 campaign-start/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|No tests found|Test timeout|browserType\.launch:/,
);
console.log(
  "Hard browser negative control: missing required browser keyboard event rejected at the first campaign state checkpoint.",
);
