import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root =
  process.env.DUCKTALES_JUNGLE_VERIFICATION_ROOT ??
  ".local/office-jungle-treasure-verification";
await mkdir(root, { recursive: true });
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/jungle-treasure-replay.spec.js",
  `--output=${root}/browser-negative`,
];
if (process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_CAMPAIGN_TEST_CONFIG);
const result = spawnSync(process.execPath, args, {
  env: {
    ...process.env,
    DUCKTALES_TREASURE_REPLAY_NEGATIVE: "omit-jungle-move",
  },
  encoding: "utf8",
  timeout: 90000,
  maxBuffer: 4 * 1024 * 1024,
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(`${root}/browser-negative.log`, output);
assert.ifError(result.error);
assert.equal(result.status, 1);
assert.match(output, /Carried browser state3 input-120/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Jungle browser negative: missing the first jungle Right make rejected at input120 state, after the unchanged entry and first80 samples.",
);
