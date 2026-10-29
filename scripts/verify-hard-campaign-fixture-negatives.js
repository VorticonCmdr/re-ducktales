import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const manifestPath = "reference/hard-campaign-office.json";
const manifest = JSON.parse(await readFile(manifestPath));
assert.equal(manifest.verificationEdition, "office");
const root = ".local/office-campaign-hard-verification";
await mkdir(root, { recursive: true });
function run() {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-hard-campaign.js", `--manifest=${manifestPath}`],
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
assert.ok(events.startsWith(".local/office-campaign-hard-accepted-01/"));
const originalEvents = await readFile(events);
try {
  await rename(events, `${events}.negative-backup`);
  const result = run();
  await writeFile(`${root}/missing-fixture.log`, result.output);
  assert.equal(result.status, 1);
  assert.match(result.output, /SETUP: missing captured-events artifact/);
} finally {
  await writeFile(events, originalEvents);
  await rm(`${events}.negative-backup`, { force: true });
}
const picture = manifest.artifacts["ending-png"].path;
assert.ok(picture.startsWith(".local/office-campaign-hard-03/"));
const originalPicture = await readFile(picture);
try {
  await writeFile(picture, Buffer.concat([originalPicture, Buffer.from([0])]));
  const result = run();
  await writeFile(`${root}/corrupt-fixture.log`, result.output);
  assert.equal(result.status, 1);
  assert.match(result.output, /Corrupt ending-png artifact/);
} finally {
  await writeFile(picture, originalPicture);
}
const restored = run();
await writeFile(`${root}/restored-positive.log`, restored.output);
assert.equal(restored.status, 0, restored.output);
console.log(
  "Hard campaign setup negatives: missing DOM stream and corrupt ending picture rejected; original bytes restored and strict verification passes.",
);
