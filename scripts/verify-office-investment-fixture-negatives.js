// Explicit setup negatives; restore the authoritative local picture in all cases.
import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import manifest from "../reference/office-investments.json" with { type: "json" };
const root = ".local/office-investment-verification";
await mkdir(root, { recursive: true });
const picture = manifest.artifacts["pose-2.png"].path;
const original = await readFile(picture);
function run() {
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-office-investments.js"],
    { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.ifError(r.error);
  return { ...r, output: r.stdout + "\n" + r.stderr };
}
try {
  await rename(picture, `${picture}.negative-backup`);
  const missing = run();
  await writeFile(`${root}/missing-fixture.log`, missing.output);
  assert.equal(missing.status, 1);
  assert.match(
    missing.output,
    /SETUP: missing office investment fixture.*pose-2.png/,
  );
} finally {
  await writeFile(picture, original);
  await import("node:fs/promises").then((fs) =>
    fs.rm(`${picture}.negative-backup`, { force: true }),
  );
}
try {
  await writeFile(picture, Buffer.concat([original, Buffer.from([0])]));
  const corrupt = run();
  await writeFile(`${root}/corrupt-fixture.log`, corrupt.output);
  assert.equal(corrupt.status, 1);
  assert.match(corrupt.output, /pose-2.png/);
} finally {
  await writeFile(picture, original);
}
const positive = run();
await writeFile(`${root}/restored-positive.log`, positive.output);
assert.equal(positive.status, 0, positive.output);
console.log(
  "Investment departure setup negatives: missing and corrupt picture rejected; original restored and strict verification passes.",
);
