import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ??
  "reference/office-jungle-entry.json";
const manifest = JSON.parse(await readFile(manifestPath));
assert.ok(
  [undefined, "office"].includes(manifest.verificationEdition),
  "Unknown jungle-entry evidence edition",
);
const officeEdition = manifest.verificationEdition === "office";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(manifest.milestone, "jungle-entry");
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.expectedCheckpointCount, 1);
assert.equal(manifest.requiredEventCount, 50);
assert.deepEqual(
  Object.keys(manifest.artifacts).sort(),
  [
    "environment",
    "captured-events",
    "campaign-checkpoints",
    "timeline",
    "capture-source",
    "capture-environment",
    "entry-png",
    "browser-source",
    "browser-results",
    "browser-run",
    "input-pause-png",
  ].sort(),
  "Missing required evidence artifacts",
);
assert.equal(
  manifest.browserVerified,
  true,
  "Missing independent browser acceptance",
);
for (const [name, spec] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing jungle-entry artifact ${spec.path}`);
  });
  assert.equal(bytes.length, spec.bytes, name);
  assert.equal(hash(bytes), spec.sha256, `Corrupt ${name}`);
}
for (const [path, expected] of Object.entries(manifest.verificationTools))
  assert.equal(
    hash(await readFile(path)),
    expected,
    `Changed verifier ${path}`,
  );
for (const [record, commit, root, count] of [
  [
    manifest.captureProducer,
    manifest.captureCommit,
    officeEdition
      ? manifest.captureSourceArchive
      : `${manifest.captureRoot}/capture-sources`,
    officeEdition ? 499 : 124,
  ],
  [
    manifest.browserProducer,
    manifest.browserCommit,
    officeEdition
      ? manifest.browserSourceArchive
      : `${manifest.artifactRoot}/browser-sources`,
    officeEdition ? 500 : 125,
  ],
]) {
  const producer = JSON.parse(await readFile(record));
  assert.equal(producer.captureCommit ?? producer.browserCommit, commit);
  const files = officeEdition ? producer.files : producer.sha256;
  assert.equal(Object.keys(files).length, count);
  for (const [path, expected] of Object.entries(files)) {
    assert.equal(hash(await readFile(`${root}/${path}`)), expected, path);
    assert.equal(
      hash(execFileSync("git", ["show", `${commit}:${path}`])),
      expected,
      path,
    );
  }
}
// The accepted completion declaration is metadata. Player events, observations
// and expected state must remain identical to the original external capture.
for (const name of ["captured-events", "campaign-checkpoints", "timeline"])
  assert.equal(
    hash(await readFile(`${manifest.captureRoot}/${name}.json`)),
    manifest.artifacts[name].sha256,
    `Changed independent capture ${name}`,
  );
const [checkpoint] = JSON.parse(
  await readFile(manifest.artifacts["campaign-checkpoints"].path),
);
assert.equal(checkpoint.stateSha256, manifest.entryStateSha256);
assert.equal(checkpoint.pixelsSha256, manifest.entryPixelsSha256);
assert.equal(
  hash(
    PNG.sync.read(await readFile(manifest.artifacts["entry-png"].path)).data,
  ),
  manifest.entryPixelsSha256,
);
const browser = JSON.parse(
  await readFile(manifest.artifacts["browser-results"].path),
);
assert.deepEqual(browser.errors, []);
assert.equal(browser.stats.expected, 1);
for (const key of ["unexpected", "skipped", "flaky"])
  assert.equal(browser.stats[key], 0);
const browserTests = [];
function visit(suite) {
  for (const spec of suite.specs ?? []) browserTests.push(...spec.tests);
  for (const child of suite.suites ?? []) visit(child);
}
browser.suites.forEach(visit);
assert.equal(browserTests.length, 1);
assert.equal(browserTests[0].status, "expected");
assert.equal(browserTests[0].results.length, 1);
assert.equal(browserTests[0].results[0].status, "passed");
const root = officeEdition
  ? ".local/office-jungle-entry-verification"
  : ".local/security-jungle-entry-verification";
await mkdir(root, { recursive: true });
function replay(mode) {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/replay-hard-campaign.js",
      manifest.artifactRoot,
      `--manifest=${manifestPath}`,
      ...(mode ? [`--negative=${mode}`] : []),
    ],
    { encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
  );
  assert.ifError(result.error);
  return { ...result, output: `${result.stdout}\n${result.stderr}` };
}
const positive = replay();
await writeFile(`${root}/positive.log`, positive.output);
assert.equal(positive.status, 0, positive.output);
const result = JSON.parse(positive.stdout);
assert.equal(result.mode, "recorded-input replay");
assert.equal(result.consumed, 50);
assert.equal(result.checked, 1);
assert.equal(result.rendered, 74);
assert.equal(result.flagAliasPresentations, 0);
assert.deepEqual(result.heldAtExploratoryEndpoint, []);
for (const [mode, reason] of [
  [
    "wrong-security",
    /Unsupported security input map|Carried replay checkpoint0 jungle-entry/,
  ],
  ["alter-checkpoint", /Carried replay checkpoint0 jungle-entry/],
  ["omit-checkpoint", /Missing required checkpoints/],
]) {
  const negative = replay(mode);
  await writeFile(`${root}/${mode}.log`, negative.output);
  assert.equal(negative.status, 1, `${mode} must fail`);
  assert.match(negative.output, reason);
  assert.doesNotMatch(
    negative.output,
    /SETUP:|ENOENT|Cannot find module|Timed out/,
  );
}
console.log(
  "Jungle entry:50 independent DOM events,1 exact full Game state,74 flight presentations,no tail; fresh browser state/pixels and full input-controls receipt;3 negatives rejected. Port evidence,not native whole-level parity.",
);
