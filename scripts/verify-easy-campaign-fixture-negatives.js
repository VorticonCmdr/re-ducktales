import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import manifest from "../reference/easy-campaign-security.json" with { type: "json" };
const root = ".local/security-easy-campaign-verification";
await mkdir(root, { recursive: true });
function run() {
  const r = spawnSync(process.execPath, ["scripts/verify-easy-campaign.js"], {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(r.error);
  return { ...r, output: r.stdout + "\n" + r.stderr };
}
const events = manifest.artifacts["captured-events"].path;
assert.ok(events.startsWith(".local/security-easy-campaign-accepted-01/"));
const savedEvents = await readFile(events);
try {
  await rename(events, `${events}.negative-backup`);
  const r = run();
  await writeFile(`${root}/missing-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(r.output, /SETUP: missing captured-events artifact/);
} finally {
  await writeFile(events, savedEvents);
  await rm(`${events}.negative-backup`, { force: true });
}
const picture = manifest.artifacts["ending-png"].path;
assert.ok(picture.startsWith(".local/security-easy-campaign-01/"));
const savedPicture = await readFile(picture);
try {
  await writeFile(picture, Buffer.concat([savedPicture, Buffer.from([0])]));
  const r = run();
  await writeFile(`${root}/corrupt-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(r.output, /Corrupt ending-png artifact/);
} finally {
  await writeFile(picture, savedPicture);
}
const restored = run();
await writeFile(`${root}/restored-positive.log`, restored.output);
assert.equal(restored.status, 0, restored.output);
console.log(
  "Easy campaign setup negatives:missing DOM stream and corrupt ending picture rejected;fixture bytes restored and strict verification passes.",
);
