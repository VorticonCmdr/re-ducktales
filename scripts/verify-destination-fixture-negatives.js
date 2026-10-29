import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const video = process.argv.includes("--video");
const keyboard = process.argv.includes("--keyboard");
assert.ok(!(video && keyboard));
const manifest = JSON.parse(
  await readFile(
    keyboard
      ? "reference/destination-keyboard.json"
      : video
        ? "reference/destination-video.json"
        : "reference/destination.json",
  ),
);
const root = keyboard
  ? ".local/destination-keyboard-verification"
  : video
    ? ".local/destination-video-verification"
    : ".local/destination-verification";
await mkdir(root, { recursive: true });
function run() {
  const r = spawnSync(
    process.execPath,
    [
      video
        ? "scripts/verify-destination-video.js"
        : "scripts/verify-destination.js",
      ...(keyboard ? ["--manifest=reference/destination-keyboard.json"] : []),
    ],
    {
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.ifError(r.error);
  return { status: r.status, output: r.stdout + "\n" + r.stderr };
}
const requiredName = keyboard
  ? "notice-015-input.json"
  : video
    ? "notice-002-flip-after.json"
    : "notice-004-input.json";
const required = manifest.artifacts[requiredName].path;
assert.ok(
  required.startsWith(
    keyboard
      ? ".local/destination-keyboard-capture-01/capture/"
      : video
        ? ".local/map-notice-video-capture-01/capture/"
        : ".local/map-notice-capture-01/capture/",
  ),
);
const bytes = await readFile(required);
try {
  await rename(required, required + ".negative-backup");
  const r = run();
  await writeFile(`${root}/missing-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(r.output, /SETUP: missing destination evidence/);
  assert.ok(r.output.includes(requiredName));
} finally {
  await writeFile(required, bytes);
  await rm(required + ".negative-backup", { force: true });
}
const corruptName = keyboard ? "notice-012-input.json" : "notice-004-flush.png";
const path = manifest.artifacts[corruptName].path,
  original = await readFile(path);
try {
  const b = Buffer.from(original);
  b[Math.floor(b.length / 2)] ^= 1;
  await writeFile(path, b);
  const r = run();
  await writeFile(`${root}/corrupt-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.ok(r.output.includes(`Corrupt ${corruptName}`));
} finally {
  await writeFile(path, original);
}
const positive = run();
await writeFile(`${root}/restored-positive.log`, positive.output);
assert.equal(positive.status, 0, positive.output);
console.log(
  `Destination fixture controls:missing required input snapshot and same-size corrupt ${keyboard ? "reader snapshot" : "picture"} rejected;exact originals restored and strict positive passes.`,
);
