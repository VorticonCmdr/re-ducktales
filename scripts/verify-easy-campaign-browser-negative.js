import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const hash = (b) => createHash("sha256").update(b).digest("hex");
export async function verifyEasyNegative(mode) {
  assert.ok(["omit-easy-confirm", "omit-campaign-jungle-move"].includes(mode));
  const manifest = JSON.parse(
    await readFile("reference/easy-campaign-security.json"),
  );
  assert.equal(
    manifest.pendingBrowserReplay,
    false,
    "SETUP: Easy campaign needs independent positive acceptance",
  );
  for (const name of [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
  ]) {
    const spec = manifest.artifacts[name];
    assert.equal(
      hash(await readFile(spec.path)),
      spec.sha256,
      `Corrupt ${name}`,
    );
  }
  const root = ".local/security-easy-campaign-verification";
  await mkdir(root, { recursive: true });
  const r = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/mixed-campaign.spec.js",
      `--output=${root}/${mode}`,
    ],
    {
      env: {
        ...process.env,
        DUCKTALES_CAPTURE_EASY_CAMPAIGN: "0",
        DUCKTALES_CAPTURE_EASY_ENTRY: "0",
        DUCKTALES_EASY_RECORDED_NEGATIVE: mode,
      },
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  await writeFile(`${root}/${mode}.log`, output);
  assert.ifError(r.error);
  assert.equal(r.status, 1, "Missing real Easy input must fail");
  assert.match(output, /1 failed/);
  assert.match(
    output,
    mode === "omit-easy-confirm"
      ? /Carried browser state0 campaign-start/
      : /Error: Carried browser state\d+ jungle-input-\d+|Error: Recorded external event sequence/,
  );
  assert.doesNotMatch(
    output,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
  );
  console.log(
    `Easy campaign ${mode}:required real browser input omission rejected.`,
  );
}
if (process.argv[1]?.endsWith("verify-easy-campaign-browser-negative.js"))
  for (const mode of ["omit-easy-confirm", "omit-campaign-jungle-move"])
    await verifyEasyNegative(mode);
