import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const manifestPath = "reference/office-jungle-entry.json";
const manifest = JSON.parse(await readFile(manifestPath));
assert.equal(manifest.verificationEdition, "office");
const root = ".local/office-jungle-entry-verification";
await mkdir(root, { recursive: true });
function run() {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-security-jungle-entry.js", `--manifest=${manifestPath}`],
    {
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.ifError(result.error);
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
}
const events = manifest.artifacts["captured-events"].path;
assert.ok(events.startsWith(".local/office-jungle-entry-accepted-01/"));
const originalEvents = await readFile(events);
try {
  await rename(events, `${events}.negative-backup`);
  const result = run();
  await writeFile(`${root}/missing-fixture.log`, result.output);
  assert.equal(result.status, 1);
  assert.match(result.output, /SETUP: missing jungle-entry artifact/);
} finally {
  await writeFile(events, originalEvents);
  await rm(`${events}.negative-backup`, { force: true });
}
const picture = manifest.artifacts["entry-png"].path;
assert.ok(picture.startsWith(".local/office-jungle-entry-accepted-01/"));
const originalPicture = await readFile(picture);
try {
  const corrupt = Buffer.from(originalPicture);
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  await writeFile(picture, corrupt);
  const result = run();
  await writeFile(`${root}/corrupt-fixture.log`, result.output);
  assert.equal(result.status, 1);
  assert.match(result.output, /Corrupt entry-png/);
} finally {
  await writeFile(picture, originalPicture);
}
const restored = run();
await writeFile(`${root}/restored-positive.log`, restored.output);
assert.equal(restored.status, 0, restored.output);
console.log(
  "Office-aware jungle-entry setup negatives: missing DOM stream and corrupt entry picture rejected; original bytes restored and strict verification passes.",
);
