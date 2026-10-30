import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".local/jungle-line-verification", { recursive: true });
const root = await mkdtemp(".local/jungle-line-verification/browser-negative-");
const r = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/jungle-line-input.spec.js",
    "--config",
    "playwright.campaign.config.js",
    `--output=${root}`,
  ],
  {
    encoding: "utf8",
    env: { ...process.env, DUCKTALES_JUNGLE_LINE_NEGATIVE: "zero-work" },
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
await writeFile(`${root}/runner.log`, output);
assert.ifError(r.error);
assert.equal(r.status, 1);
assert.match(output, /1 failed/);
assert.match(output, /Line-inclusive initial drawing deadline/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|ETIMEDOUT|Channel closed/,
);
console.log(
  `Jungle line browser control:zero drawing deadline rejected at actual publication boundary. Report:${root}`,
);
