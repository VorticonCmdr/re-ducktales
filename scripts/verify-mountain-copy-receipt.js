// Saved focused gate,source integrity and evidence availability. Not a fresh run.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = JSON.parse(await readFile("reference/mountain-copy-runtime.json"));
assert.equal(m.id, "mountain-source-copy-runtime-integration");
assert.equal(m.command, "node scripts/verify-mountain-copy-integration.js");
assert.equal(m.wholeGameComplete, false);
assert.equal(m.fullCampaignRefreshed, false);
assert.equal(m.exitCode, 0);
const artifacts = {};
assert.equal(Object.keys(m.artifacts).length, 4);
for (const [role, s] of Object.entries(m.artifacts)) {
  const b = await readFile(s.path).catch(() => {
    throw Error("SETUP: missing mountain copy receipt " + s.path);
  });
  assert.equal(b.length, s.bytes, "Corrupt receipt size");
  assert.equal(sha(b), s.sha256, "Corrupt receipt");
  artifacts[role] = b;
}
const source = JSON.parse(artifacts.source),
  result = JSON.parse(artifacts.result);
assert.equal(source.commit, m.sourceCommit);
assert.equal(
  sha(
    execFileSync("git", ["archive", "--format=zip", m.sourceCommit], {
      maxBuffer: 32 * 1024 * 1024,
    }),
  ),
  m.artifacts.archive.sha256,
);
assert.ok(
  Object.keys(m.checkedSources).length > 500,
  "Incomplete current source inventory",
);
for (const [p, h] of Object.entries(m.checkedSources)) {
  assert.equal(
    sha(await readFile(p)),
    h,
    "Changed current mountain copy source " + p,
  );
  assert.equal(
    sha(
      execFileSync("git", ["show", m.sourceCommit + ":" + p], {
        maxBuffer: 8 * 1024 * 1024,
      }),
    ),
    h,
    "Changed committed source " + p,
  );
  assert.equal(source.files[p], h);
}
assert.equal(result.completed, true);
assert.equal(result.units, 180);
assert.equal(result.nativeEraseCases, 34);
assert.equal(result.nativePrimitiveCases, 16);
assert.equal(result.ascentInputs, 764);
assert.equal(result.ascentCheckpoints, 26);
assert.equal(result.ascentPresentations, 870);
assert.equal(result.browserCases, 1);
assert.equal(result.browserFailureControls, 1);
const log = artifacts.log.toString();
assert.ok(
  log.trimEnd().endsWith(JSON.stringify(result, null, 2)),
  "Incomplete gate log",
);
assert.match(log, /# pass 180\b/);
assert.match(log, /1 passed/);
assert.match(log, /Original mountain copy work/);
assert.match(log, /1 failed/);
assert.match(log, /built in/);
execFileSync(process.execPath, ["scripts/verify-mountain-copy-work.js"], {
  stdio: "pipe",
});
console.log(
  JSON.stringify(
    {
      scope:
        "Saved source-pinned focused mountain integration,not fresh browser/full-campaign acceptance",
      sourceCommit: m.sourceCommit,
      sourceFiles: Object.keys(m.checkedSources).length,
      artifacts: 4,
      completed: true,
    },
    null,
    2,
  ),
);
