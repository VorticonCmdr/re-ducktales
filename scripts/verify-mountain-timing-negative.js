// Deliberately bypass work in an isolated process. Required timing must fail.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const root = await mkdtemp(join(tmpdir(), "ducktales-mountain-work-negative-"));
try {
  const hook = join(root, "bypass.mjs");
  await writeFile(
    hook,
    `import {Mountain} from ${JSON.stringify(pathToFileURL(resolve("src/game/mountain.js")).href)};\nMountain.prototype.present=function*(commands){this.pending=commands;yield {clock:'retrace',remaining:1};};\n`,
  );
  const result = spawnSync(
    process.execPath,
    ["--import", hook, "scripts/diagnose-expedition-timing.js"],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1, "Timing checker accepted omitted sprite work");
  assert.match(result.stdout, /"timingParity": false/);
  assert.match(result.stderr, /UNRESOLVED: mountain elapsed input cadence/);
  console.log(
    "Mountain timing negative: isolated one-retrace bypass rejected by elapsed-cadence check.",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
