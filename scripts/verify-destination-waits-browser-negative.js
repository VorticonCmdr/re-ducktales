import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const root =
  process.env.DUCKTALES_DESTINATION_WAIT_NEGATIVE_OUTPUT ??
  ".local/destination-waits-browser-negative";
await mkdir(root, { recursive: true });
const args = [
  "node_modules/@playwright/test/cli.js",
  "test",
  "tests/browser/destination.spec.js",
  "--grep",
  "destination entry bands",
  `--output=${root}/browser`,
];
if (process.env.DUCKTALES_MAP_TEST_CONFIG)
  args.push("--config", process.env.DUCKTALES_MAP_TEST_CONFIG);
const result = spawnSync(process.execPath, args, {
  encoding: "utf8",
  timeout: 120000,
  maxBuffer: 4 * 1024 * 1024,
  env: { ...process.env, DUCKTALES_DESTINATION_WAIT_NEGATIVE: "omit-right" },
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(`${root}/omit-right.log`, output);
assert.ifError(result.error);
assert.equal(result.status, 1, "Missing Right must fail");
assert.match(output, /Required Right make selects flight/);
assert.match(output, /Expected:\s*1/);
assert.match(output, /Received:\s*0/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed|Unfinished office/,
);
console.log(
  "Destination wait browser control:omitted real Right make rejected by exact selection comparison,without timeout.",
);
