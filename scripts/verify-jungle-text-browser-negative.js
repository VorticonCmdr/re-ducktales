import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".local/jungle-text-verification", { recursive: true });
const root = await mkdtemp(".local/jungle-text-verification/browser-negative-");
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
    env: { ...process.env, DUCKTALES_JUNGLE_TEXT_NEGATIVE: "omit-work" },
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
  },
);
const output = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
await writeFile(`${root}/runner.log`, output);
assert.ifError(r.error);
assert.equal(r.status, 1);
assert.match(output, /1 failed/);
assert.match(output, /Native-counted jungle HUD budget/);
assert.doesNotMatch(
  output,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|ETIMEDOUT|Channel closed/,
);
console.log(
  `Jungle text browser control:omitted numeric work rejected by the native-counted HUD budget. Report:${root}`,
);
