import assert from "node:assert/strict";
import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const root = ".local/security-hard-expeditions-verification";
await mkdir(root, { recursive: true });
const boola = JSON.parse(await readFile("reference/security-hard-boola.json"));
const thunder = JSON.parse(
  await readFile("reference/security-hard-thunderclap.json"),
);
function run() {
  const r = spawnSync(
    process.execPath,
    ["scripts/verify-security-hard-expeditions.js"],
    { encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
  );
  assert.ifError(r.error);
  return { ...r, output: r.stdout + "\n" + r.stderr };
}
const events = boola.artifacts["captured-events"].path,
  originalEvents = await readFile(events);
assert.ok(
  events.startsWith(".local/security-hard-expeditions-accepted-01/boola/"),
);
try {
  await rename(events, `${events}.negative-backup`);
  const r = run();
  await writeFile(`${root}/missing-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(
    r.output,
    /SETUP: missing Hard expedition artifact.*boola.*captured-events.json/,
  );
} finally {
  await writeFile(events, originalEvents);
  await rm(`${events}.negative-backup`, { force: true });
}
const picture = thunder.artifacts["png-input-2"].path,
  original = await readFile(picture);
assert.ok(
  picture.startsWith(".local/security-hard-expeditions-01/thunderclap/"),
);
try {
  await writeFile(picture, Buffer.concat([original, Buffer.from([0])]));
  const r = run();
  await writeFile(`${root}/corrupt-fixture.log`, r.output);
  assert.equal(r.status, 1);
  assert.match(r.output, /thunderclap png-input-2/);
} finally {
  await writeFile(picture, original);
}
const restored = run();
await writeFile(`${root}/restored-positive.log`, restored.output);
assert.equal(restored.status, 0, restored.output);
console.log(
  "Hard setup negatives:missing required DOM events and corrupt picture rejected;originals restored and strict verification passes.",
);
