// Strict recorded segment verification. Negative fixtures live in owned copies;
// authoritative captures and their manifests are never modified.
import assert from "node:assert/strict";
import {
  readFile,
  mkdir,
  mkdtemp,
  copyFile,
  writeFile,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const manifestPath = "reference/current-campaign-progress.json";
const manifest = JSON.parse(await readFile(manifestPath));
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(manifest.milestone, "campaign-progress");
assert.equal(manifest.expectedCheckpointCount, 24);
assert.equal(manifest.requiredEventCount, 3804);
assert.equal(
  hash(await readFile(manifest.buildManifest.path)),
  manifest.buildManifest.sha256,
);
for (const [path, expected] of Object.entries(manifest.verificationSources))
  assert.equal(
    hash(await readFile(path)),
    expected,
    `Changed verification source ${path}`,
  );
const originalHashes = {};
for (const [role, spec] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing ${spec.path}`);
  });
  assert.equal(bytes.length, spec.bytes, `Corrupt ${role} size`);
  assert.equal(hash(bytes), spec.sha256, `Corrupt ${role} fixture`);
  originalHashes[role] = hash(bytes);
}
await mkdir(".local/current-campaign-progress-verification", {
  recursive: true,
});
const output = await mkdtemp(
  ".local/current-campaign-progress-verification/run-",
);
const pendingLogs = [];
function run(
  name,
  root,
  args = [],
  expectedFailure,
  contractPath = manifestPath,
) {
  const r = spawnSync(
    process.execPath,
    [
      "scripts/replay-hard-campaign.js",
      root,
      `--manifest=${contractPath}`,
      ...args,
    ],
    { encoding: "utf8", timeout: 120000, maxBuffer: 8 * 1024 * 1024 },
  );
  const text = (r.stdout ?? "") + "\n" + (r.stderr ?? "");
  // Keep detailed local reports, never proprietary snapshots in version control.
  pendingLogs.push(writeFile(`${output}/${name}.log`, text));
  assert.ifError(r.error);
  if (expectedFailure) {
    assert.notEqual(r.status, 0, `${name} unexpectedly passed`);
    assert.match(text, expectedFailure, `${name} failed for the wrong reason`);
    assert.doesNotMatch(text, /ETIMEDOUT|Zero replay cases/);
    return;
  }
  assert.equal(r.status, 0, text.slice(-3000));
  const result = JSON.parse(r.stdout.trim());
  assert.equal(result.mode, "recorded-input replay");
  assert.equal(result.consumed, 3804);
  assert.equal(result.checked, 24);
  assert.equal(result.rendered, 1149);
  assert.equal(result.flagAliasPresentations, 0);
}
run("positive", manifest.artifactRoot);
run(
  "alter-checkpoint",
  manifest.artifactRoot,
  ["--negative=alter-checkpoint"],
  /Carried replay checkpoint0 campaign-start/,
);
run(
  "omit-checkpoint",
  manifest.artifactRoot,
  ["--negative=omit-checkpoint"],
  /Missing required checkpoints/,
);
run(
  "wrong-input",
  manifest.artifactRoot,
  ["--negative=wrong-security"],
  /Carried replay checkpoint1 flight-start/,
);
run(
  "partial-strict",
  manifest.artifactRoot,
  ["--through=cave-return"],
  /Partial campaign replay is diagnostic only/,
);
for (const kind of ["missing", "corrupt"]) {
  const root = `${output}/${kind}`;
  await mkdir(root);
  for (const [role, spec] of Object.entries(manifest.artifacts)) {
    if (kind === "missing" && role === "captured-events") continue;
    await copyFile(spec.path, `${root}/${role}.json`);
  }
  if (kind === "corrupt") {
    const p = `${root}/captured-events.json`;
    const events = JSON.parse(await readFile(p));
    events[0].time += 1;
    await writeFile(p, JSON.stringify(events));
  }
  run(
    kind,
    root,
    [],
    kind === "missing"
      ? /SETUP: missing recorded campaign artifact/
      : /Corrupt captured-events fixture/,
  );
}
// Keep event-count and fixture hashes internally valid; only its timestamp is
// impossible to consume. A fixture checksum error must not stand in for this check.
{
  const root = `${output}/unconsumed`;
  await mkdir(root);
  const contract = structuredClone(manifest);
  for (const [role, spec] of Object.entries(manifest.artifacts))
    await copyFile(spec.path, `${root}/${role}.json`);
  const path = `${root}/captured-events.json`;
  const events = JSON.parse(await readFile(path));
  const timeline = JSON.parse(await readFile(`${root}/timeline.json`));
  events.at(-1).time = timeline.endAt + 1;
  const bytes = JSON.stringify(events);
  await writeFile(path, bytes);
  contract.artifacts["captured-events"].sha256 = hash(bytes);
  const contractPath = `${root}/manifest.json`;
  await writeFile(contractPath, JSON.stringify(contract));
  run(
    "unconsumed",
    root,
    [],
    /Unconsumable or unordered required input event/,
    contractPath,
  );
}
for (const [role, spec] of Object.entries(manifest.artifacts))
  assert.equal(
    hash(await readFile(spec.path)),
    originalHashes[role],
    `Original ${role} fixture changed`,
  );
await Promise.all(pendingLogs);
console.log(
  `Current campaign progress:24 carried checkpoints,3804 external inputs,1149 flight presentations;7 negative controls rejected. Reports:${output}`,
);
