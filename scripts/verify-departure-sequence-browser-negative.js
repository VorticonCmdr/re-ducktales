import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root =
  process.env.DUCKTALES_DEPARTURE_SEQUENCE_VERIFICATION_ROOT ??
  ".local/departure-sequence-verification";
await mkdir(root, { recursive: true });
const r = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/departure-sequence.spec.js",
    "--grep",
    "Launchpad wipes",
    `--output=${root}/browser-negative`,
    "--config",
    "playwright.campaign.config.js",
  ],
  {
    env: { ...process.env, DUCKTALES_DEPARTURE_SEQUENCE_NEGATIVE: "stall" },
    encoding: "utf8",
    timeout: 90000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
await writeFile(`${root}/browser-negative.log`, output);
assert.ifError(r.error);
assert.equal(r.status, 1);
assert.match(
  output,
  /Required automatic departure handoff without another Fire/,
);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed|Unfinished office/,
);
console.log(
  "Departure sequence browser negative:stalled automatic handoff rejected by the required flight assertion,without timeout.",
);
