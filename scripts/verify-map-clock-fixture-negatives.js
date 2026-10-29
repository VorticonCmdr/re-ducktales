import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const m = JSON.parse(await readFile("reference/map-clock.json"));
const root = ".local/map-clock-fixture-controls";
await mkdir(root, { recursive: true });
const path = m.artifacts["map-clock-inputs.json"].path;
assert.equal(path, ".local/map-clock-capture-01/capture/map-clock-inputs.json");
const original = await readFile(path);
function run() {
  const r = spawnSync(process.execPath, ["scripts/verify-map-clock.js"], {
    encoding: "utf8",
    timeout: 90000,
    maxBuffer: 2 * 1024 * 1024,
  });
  assert.ifError(r.error);
  return { code: r.status, output: `${r.stdout}\n${r.stderr}` };
}
try {
  await rename(path, `${path}.negative-backup`);
  const r = run();
  await writeFile(`${root}/missing.log`, r.output);
  assert.equal(r.code, 1);
  assert.match(
    r.output,
    /SETUP: missing map clock evidence.*map-clock-inputs.json/,
  );
} finally {
  await writeFile(path, original);
  await rm(`${path}.negative-backup`, { force: true });
}
try {
  const corrupt = Buffer.from(original);
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  await writeFile(path, corrupt);
  const r = run();
  await writeFile(`${root}/corrupt.log`, r.output);
  assert.equal(r.code, 1);
  assert.match(r.output, /Corrupt map-clock-inputs.json/);
} finally {
  await writeFile(path, original);
}
const restored = run();
await writeFile(`${root}/restored-positive.log`, restored.output);
assert.equal(restored.code, 0, restored.output);
console.log(
  "Map clock setup controls:missing clock stream and same-size corruption rejected;exact originals restored and strict positive passes.",
);
