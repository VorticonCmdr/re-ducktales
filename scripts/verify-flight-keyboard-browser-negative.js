import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const root =
  process.env.DUCKTALES_FLIGHT_KEYBOARD_VERIFICATION_ROOT ??
  ".local/flight-keyboard-verification";
await mkdir(root, { recursive: true });
const r = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/flight-keyboard.spec.js",
    "--grep",
    "flight physical aliases",
    `--output=${root}/browser-negative`,
    "--config",
    "playwright.campaign.config.js",
  ],
  {
    env: { ...process.env, DUCKTALES_FLIGHT_KEYBOARD_NEGATIVE: "drop-release" },
    encoding: "utf8",
    timeout: 90000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
await writeFile(`${root}/browser-negative.log`, output);
assert.ifError(r.error);
assert.equal(r.status, 1);
assert.match(output, /Flight alias release-edge byte/);
assert.match(output, /1 failed/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed|Unfinished office/,
);
console.log(
  "Flight keyboard browser negative:lost release-edge input rejected by the required native-byte assertion,without timeout.",
);
