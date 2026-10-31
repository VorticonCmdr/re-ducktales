// Scoped source/observed-defect evidence; no native key-timing replay claim.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/atomic-input-source.json");
assert.equal(m.id, "atomic-input-boundaries");
assert.equal(m.ranges.length, 3);
assert.equal(Object.keys(m.artifacts).length, 5);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await checkArtifacts(m.artifacts);
const { image } = await originalGame();
let bytes = 0;
for (const r of m.ranges) {
  assert.ok(r.length > 0);
  assert.equal(
    sha(image.subarray(r.offset, r.offset + r.length)),
    r.sha256,
    r.purpose,
  );
  bytes += r.length;
}
assert.equal(bytes, 413);
const old = await json(m.artifacts["probe.json"].path);
assert.equal(old.notes.length, m.beforeProbe.expectedObservations);
assert.match(old.scope, /EXPLORATORY/);
const charge = old.notes.find((p) => p.name === "charge"),
  probe = old.notes.find((p) => p.name === "charge-p-probe");
assert.equal(charge.state.atomicTransport.phase, "charge");
assert.equal(charge.state.systemOverlay, null);
assert.equal(probe.at - charge.at, 8);
assert.equal(probe.state.atomicTransport.remaining, 7);
assert.equal(probe.state.systemOverlay.kind, "pause");
assert.equal(old.restart, true);
const source = await json(m.artifacts["source-revision.json"].path);
assert.equal(source.commit, m.beforeSourceCommit);
assert.equal(source.reconstructedFromGitAfterObservation, true);
assert.equal(
  sha(
    execFileSync("git", ["archive", "--format=zip", source.commit], {
      maxBuffer: 32 * 1024 * 1024,
    }),
  ),
  source.archiveSha256,
);
console.log(
  "Atomic source evidence:413 original bytes and observed pre-fix charge/P defect verified;new native key-timing replay not claimed.",
);
