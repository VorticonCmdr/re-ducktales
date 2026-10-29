import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const hash = (b) => createHash("sha256").update(b).digest("hex");
export async function verifyHardMovementNegative(key) {
  const catalog = JSON.parse(
    await readFile("reference/office-hard-expeditions.json"),
  );
  assert.equal(
    catalog.pending,
    false,
    "SETUP: Hard routes need independent positive acceptance",
  );
  const spec = catalog.artifacts[`manifest-${key}`];
  assert.ok(spec, "SETUP: unknown Hard expedition");
  const bytes = await readFile(spec.path);
  assert.equal(hash(bytes), spec.sha256);
  const m = JSON.parse(bytes);
  assert.equal(m.browserVerified, true);
  for (const name of [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
  ]) {
    const file = m.artifacts[name];
    assert.equal(
      hash(await readFile(file.path)),
      file.sha256,
      `Corrupt ${name}`,
    );
  }
  const root = ".local/office-hard-expeditions-verification";
  await mkdir(root, { recursive: true });
  const mode = "omit-expedition-move";
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/hard-expedition-replay.spec.js",
      "--grep",
      `Hard ${key} expedition`,
      `--output=${root}/${key}-negative`,
    ],
    {
      env: { ...process.env, DUCKTALES_HARD_REPLAY_NEGATIVE: mode },
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  await writeFile(`${root}/${key}-movement-negative.log`, output);
  assert.ifError(result.error);
  assert.equal(result.status, 1, "Missing physical movement must fail");
  // Native animation can defer movement. Either exact state or the independent
  // DOM stream must reject the omitted make at an expedition input checkpoint.
  assert.match(
    output,
    /Error: Carried browser state\d+ input-\d+|Error: Recorded external event sequence/,
  );
  assert.match(output, /1 failed/);
  assert.doesNotMatch(
    output,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
  );
  console.log(
    `Hard ${key}:missing movement rejected by carried state or required external-event comparison.`,
  );
  return output;
}
if (process.argv[1]?.endsWith("verify-security-hard-movement-negative.js"))
  for (const key of ["bermuda", "boola", "thunderclap", "machu"])
    await verifyHardMovementNegative(key);
