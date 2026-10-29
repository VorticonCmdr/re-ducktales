import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const m = JSON.parse(
  await readFile("reference/keyboard-campaign-regression.json"),
);
const root = ".local/keyboard-shared-runtime-fixture-controls";
await mkdir(root, { recursive: true });
function run() {
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-shared-runtime-regression.js"],
    {
      encoding: "utf8",
      timeout: 90000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  assert.ifError(r.error);
  return { code: r.status, output: `${r.stdout}\n${r.stderr}` };
}
const path = m.artifacts["mountain/browser-results.json"].path;
assert.equal(path, ".local/keyboard-mountain-browser-01/browser-results.json");
const original = await readFile(path);
try {
  await rename(path, `${path}.negative-backup`);
  const result = run();
  await writeFile(`${root}/missing.log`, result.output);
  assert.equal(result.code, 1);
  assert.match(
    result.output,
    /SETUP: missing current runtime regression.*keyboard-mountain-browser-01\/browser-results.json/,
  );
} finally {
  await writeFile(path, original);
  await rm(`${path}.negative-backup`, { force: true });
}
try {
  const corrupt = Buffer.from(original);
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  await writeFile(path, corrupt);
  const result = run();
  await writeFile(`${root}/corrupt.log`, result.output);
  assert.equal(result.code, 1);
  assert.match(result.output, /Corrupt mountain\/browser-results.json/);
} finally {
  await writeFile(path, original);
}
const restored = run();
await writeFile(`${root}/restored-positive.log`, restored.output);
assert.equal(restored.code, 0, restored.output);
console.log(
  "Shared runtime fixture controls:missing mountain report and same-size corruption rejected;exact bytes restored and strict positive passes.",
);
