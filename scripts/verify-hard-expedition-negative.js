import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const manifest = JSON.parse(
  await readFile("reference/hard-jungle-browser.json", "utf8"),
);
const input = await readFile(manifest.inputManifest).catch(() => {
  throw Error(`SETUP: missing ${manifest.inputManifest}`);
});
assert.equal(
  createHash("sha256").update(input).digest("hex"),
  manifest.inputManifestSha256,
  "corrupt Hard route inputs",
);
assert.equal(
  createHash("sha256")
    .update(await readFile(manifest.captureTool))
    .digest("hex"),
  manifest.captureToolSha256,
  "Hard capture tool identity changed",
);
const events = JSON.parse(input).jungle;
assert.equal(manifest.expectedScenarioCount, 1);
assert.equal(events.length, 18);
for (const e of events) {
  assert.ok(Number.isInteger(e.count) && e.count > 0);
  assert.ok([0, 1, 3, 5, 7, 64].includes(e.byte));
}
assert.equal(
  events.reduce((n, e) => n + e.count, 0),
  444,
);
assert.equal(manifest.jungle.expectedInputCount, 444);
assert.equal(manifest.jungle.expectedCheckpointCount, 26);
assert.equal(manifest.jungle.checkpoints.length, 26);
assert.equal(manifest.jungle.checkpoints.at(-1).inputCount, 444);
for (let i = 0; i < 26; i++)
  assert.ok(
    i === 0 ||
      manifest.jungle.checkpoints[i].inputCount >
        manifest.jungle.checkpoints[i - 1].inputCount,
  );

await mkdir(".local/hard-jungle", { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/hard-expedition.spec.js",
    "--output=.local/hard-expedition-negative",
  ],
  {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, DUCKTALES_HARD_NEGATIVE: "wrong-climb" },
  },
);
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
await writeFile(".local/hard-jungle/negative-control.log", output);
assert.ifError(result.error);
assert.equal(result.status, 1, "wrong climb must fail");
assert.match(
  output,
  /Hard jungle checkpoint22 x/,
  "must reject the first moving-platform climb",
);
assert.match(output, /1 failed/);
assert.doesNotMatch(output, /No tests found|SETUP:|browserType\.launch:/);
console.log(
  "Hard expedition negative control: wrong first climb rejected at checkpoint22 position.",
);
