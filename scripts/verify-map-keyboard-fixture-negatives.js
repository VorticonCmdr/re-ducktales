import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import manifest from "../reference/map-keyboard.json" with { type: "json" };
const root = ".local/map-keyboard-verification";
await mkdir(root, { recursive: true });
function run() {
  const r = spawnSync(process.execPath, ["scripts/verify-map-keyboard.js"], {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(r.error);
  return { status: r.status, output: r.stdout + "\n" + r.stderr };
}
const required = manifest.artifacts["map-001-input.json"].path;
assert.ok(required.startsWith(".local/map-keyboard-capture-02/capture/"));
const bytes = await readFile(required);
try {
  await rename(required, required + ".negative-backup");
  const r = run();
  await writeFile(`${root}/missing-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(
    r.output,
    /SETUP: missing map keyboard artifact.*map-001-input.json/,
  );
} finally {
  await writeFile(required, bytes);
  await rm(required + ".negative-backup", { force: true });
}
const path = manifest.artifacts["map-consumption.json"].path,
  original = await readFile(path);
try {
  const b = Buffer.from(original);
  b[Math.floor(b.length / 2)] ^= 1;
  await writeFile(path, b);
  const r = run();
  await writeFile(`${root}/corrupt-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(r.output, /Corrupt map-consumption.json/);
} finally {
  await writeFile(path, original);
}
const positive = run();
await writeFile(`${root}/restored-positive.log`, positive.output);
assert.equal(positive.status, 0, positive.output);
console.log(
  "Map keyboard fixture controls:missing required input snapshot and same-size corrupt consumption trace rejected;exact originals restored and strict positive passes.",
);
