import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const manifestPath =
  process.env.DUCKTALES_CAMPAIGN_MANIFEST ??
  "reference/hard-campaign-office.json";
const manifest = JSON.parse(await readFile(manifestPath));
const root =
  process.env.DUCKTALES_CAMPAIGN_VERIFICATION_ROOT ??
  (manifest.verificationEdition === "office"
    ? ".local/office-campaign-hard-verification"
    : ".local/hard-security-campaign-verification");
await mkdir(root, { recursive: true });
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/hard-campaign.spec.js",
  `--output=${root}/browser-negative`,
];
if (process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG);
const r = spawnSync(process.execPath, args, {
  env: {
    ...process.env,
    DUCKTALES_CAMPAIGN_MANIFEST: manifestPath,
    DUCKTALES_RECORDED_NEGATIVE: "omit-hard-choice",
    DUCKTALES_CAPTURE_HARD_CAMPAIGN: "0",
  },
  encoding: "utf8",
  timeout: 60000,
  maxBuffer: 4 * 1024 * 1024,
});
const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
await writeFile(`${root}/browser-negative.log`, output);
assert.ifError(r.error);
assert.equal(r.status, 1, "Missing real browser input must fail");
assert.match(output, /Carried browser state0 campaign-start/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:|ETIMEDOUT|Channel closed/,
);
console.log(
  "Hard browser negative control: missing required browser keyboard event rejected at the first campaign state checkpoint.",
);
