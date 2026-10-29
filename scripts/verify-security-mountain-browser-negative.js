import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root = ".local/office-mountain-ascent-verification";
await mkdir(root, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/mountain-ascent-replay.spec.js",
    `--output=${root}/browser-negative`,
  ],
  {
    env: {
      ...process.env,
      DUCKTALES_MOUNTAIN_REPLAY_NEGATIVE: "omit-mountain-move",
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
assert.match(output, /Carried browser state12 input-480/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
console.log(
  "Mountain browser negative: omitting a required mountain Right make is rejected at an exact carried-state checkpoint.",
);
