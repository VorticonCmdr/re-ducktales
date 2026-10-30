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
    "tests/browser/departure-sequence.spec.js",
    "tests/browser/destination-loop.spec.js",
    "tests/browser/campaign.spec.js",
    "--grep",
    "flight physical aliases|flight natural crash|Launchpad wipes|departure discards|destination autonomous|destination defers|original map pixels and keyboard bank round trip|keyboard flight lands, explores a cave, collects treasure and returns to the map",
    `--output=${root}/browser-positive`,
    "--config",
    "playwright.campaign.config.js",
  ],
  {
    env: process.env,
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
await writeFile(`${root}/browser-positive.log`, output);
process.stdout.write(output);
assert.ifError(r.error);
assert.equal(r.status, 0, "Required flight browser scenario failed");
assert.match(output, /\b9 passed\b/, "All nine browser scenarios must execute");
assert.doesNotMatch(
  output,
  /\d+ skipped|\d+ did not run|\d+ interrupted|No tests found/,
);
console.log(
  "Flight keyboard browser acceptance:all9 required scenarios executed,zero skipped.",
);
