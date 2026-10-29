// Explicit setup negatives; restore the authoritative local picture in all cases.
import assert from "node:assert/strict";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ??
  "reference/office-lightning.json";
const manifest = JSON.parse(await readFile(manifestPath));
const root =
  manifest.verificationEdition === "office"
    ? ".local/office-lightning-verification"
    : ".local/security-lightning-verification";
await mkdir(root, { recursive: true });
const picture = manifest.artifacts["png-before-strike"].path;
const original = await readFile(picture);
function run() {
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-security-lightning.js", `--manifest=${manifestPath}`],
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
    /SETUP: missing lightning artifact.*before-strike.png/,
  );
} finally {
  await writeFile(picture, original);
  await import("node:fs/promises").then((fs) =>
    fs.rm(`${picture}.negative-backup`, { force: true }),
  );
}
try {
  const corruptBytes = Buffer.from(original);
  corruptBytes[Math.floor(corruptBytes.length / 2)] ^= 1;
  await writeFile(picture, corruptBytes);
  const corrupt = run();
  await writeFile(`${root}/corrupt-fixture.log`, corrupt.output);
  assert.equal(corrupt.status, 1);
  assert.match(corrupt.output, /Corrupt png-before-strike/);
} finally {
  await writeFile(picture, original);
}
const positive = run();
await writeFile(`${root}/restored-positive.log`, positive.output);
assert.equal(positive.status, 0, positive.output);
console.log(
  "Lightning setup negatives: missing and corrupt picture rejected; original restored and strict verification passes.",
);
