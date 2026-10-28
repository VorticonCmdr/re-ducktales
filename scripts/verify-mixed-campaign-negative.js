import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Preserve the passing campaign's captures in their usual directory. This run
// must fail at a state comparison, not merely return a nonzero setup status.
await mkdir(".local/mixed-campaign", { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/mixed-campaign.spec.js",
    "--output=.local/mixed-campaign-negative",
  ],
  {
    env: { ...process.env, DUCKTALES_MIXED_NEGATIVE: "wrong-jungle-input" },
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(".local/mixed-campaign/negative-control.log", output);
assert.ifError(result.error);
assert.equal(result.status, 1, "wrong input must fail the browser test");
assert.match(
  output,
  /jungle 0 x/,
  "must fail the first jungle position comparison",
);
assert.match(
  output,
  /1 failed/,
  "exactly one negative-control case must execute",
);
assert.doesNotMatch(output, /SETUP:|No tests found|browserType\.launch:/);
console.log(
  "Mixed campaign negative control: wrong input rejected by the first jungle position comparison.",
);
