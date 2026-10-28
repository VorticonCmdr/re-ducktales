import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/hard-expedition.spec.js",
    "--grep",
    "Bermuda",
    "--output=.local/flight-input-browser-negative",
  ],
  {
    env: { ...process.env, DUCKTALES_FLIGHT_NEGATIVE: "omit-first-turn" },
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await mkdir(".local/flight-input-verification", { recursive: true });
await writeFile(
  ".local/flight-input-verification/browser-negative.log",
  output,
);
assert.ifError(result.error);
assert.equal(result.status, 1, "Missing flight turn must fail");
assert.match(output, /Consumed flight input18/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|browserType\.launch:|Corrupt consumed flight input stream/,
);
console.log(
  "Flight browser negative: missing real turn rejected at consumed input18, before actor/result comparisons.",
);
