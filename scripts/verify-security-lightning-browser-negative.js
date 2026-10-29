import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root = ".local/office-lightning-verification";
await mkdir(root, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/flight-lightning-replay.spec.js",
    `--output=${root}/browser-negative`,
  ],
  {
    env: {
      ...process.env,
      DUCKTALES_LIGHTNING_REPLAY_NEGATIVE: "omit-lightning-throttle",
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
assert.match(output, /Carried browser state4 recovery/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Lightning browser negative: missing fresh throttle rejected at recovery state,after unchanged departure,strike and deceleration.",
);
