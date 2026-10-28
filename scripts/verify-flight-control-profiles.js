import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  await readFile("reference/hard-flight-inputs.json"),
);
async function required(path) {
  return readFile(path).catch(() => {
    throw Error(`SETUP: missing ${path}; see docs/flight-input-boundaries.md`);
  });
}
assert.equal(manifest.buildManifest, "reference/build.json");
assert.equal(
  manifest.baselineCommit,
  "57beb92d1250452ee5e8ed22ec8e04b48321fe08",
);
assert.equal(
  hash(await required(manifest.sourceInputArtifact)),
  manifest.sourceInputSha256,
  "Changed independent source event stream",
);
assert.equal(
  hash(await required(manifest.observer.path)),
  manifest.observer.sha256,
  "Changed capture observer",
);
assert.equal(Object.keys(manifest.baselineSourceHashes).length, 4);
for (const [path, expected] of Object.entries(manifest.baselineSourceHashes))
  assert.equal(
    hash(execFileSync("git", ["show", `${manifest.baselineCommit}:${path}`])),
    expected,
    `Wrong baseline source ${path}`,
  );
assert.equal(manifest.artifacts.length, 2);
for (const artifact of manifest.artifacts)
  assert.equal(
    hash(await required(artifact.path)),
    artifact.sha256,
    `Corrupt ${artifact.path}`,
  );
const observed = JSON.parse(await required(manifest.artifacts[0].path));
const replay = JSON.parse(await required(manifest.artifacts[1].path));
assert.equal(replay.mode, "recorded-input replay");
assert.equal(replay.checked, 24);
assert.equal(replay.consumed, 3284);
function verify(profiles, observedProfiles) {
  assert.equal(profiles.length, 4, "Missing required flight profiles");
  assert.equal(observedProfiles.length, 4, "Missing observed profiles");
  let checked = 0;
  for (const [i, profile] of profiles.entries()) {
    const codes = profile.events.flatMap((event) => {
      assert.ok(Number.isInteger(event.count) && event.count > 0);
      assert.ok([192, 193, 197].includes(event.byte));
      return Array(event.count).fill(event.byte);
    });
    assert.equal(
      codes.length,
      profile.inputCount,
      "Missing consumed flight inputs",
    );
    assert.equal(codes.length, [226, 307, 262, 382][i]);
    assert.deepEqual(
      codes,
      observedProfiles[i],
      "Changed observed consumed input",
    );
    assert.equal(
      hash(Buffer.from(codes)),
      profile.sha256,
      "Corrupt consumed flight input digest",
    );
    checked++;
  }
  assert.equal(checked, 4, "Zero or unfinished flight profile checks");
}
verify(manifest.profiles, observed);
const wrong = structuredClone(observed);
wrong[0][17] = 192;
assert.throws(
  () => verify(manifest.profiles, wrong),
  /Changed observed consumed input/,
);
const missing = structuredClone(manifest.profiles);
missing[0].events[0].count--;
assert.throws(
  () => verify(missing, observed),
  /Missing consumed flight inputs/,
);
assert.throws(() => verify([], observed), /Missing required flight profiles/);
console.log(
  "Flight control streams:4 complete observed profiles,1177 consumed values, baseline sources/input identities,24-checkpoint source replay and3 negative controls. Port-input provenance, not original-game parity.",
);
