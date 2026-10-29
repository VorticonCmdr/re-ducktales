import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/hard-campaign-security.json";
const verificationRoot =
  manifestPath === "reference/hard-campaign-security.json"
    ? ".local/hard-security-campaign-verification"
    : ".local/hard-campaign-verification";
const manifest = JSON.parse(
  await readFile(manifestPath).catch(() => {
    throw Error("SETUP: missing accepted Hard campaign manifest");
  }),
);
assert.equal(
  manifest.pendingBrowserReplay,
  false,
  "SETUP: new Hard capture requires an independent browser replay receipt",
);
assert.equal(
  manifest.evidenceLevel,
  "closed-loop port regression and independent browser scenario",
);
assert.ok(
  manifest.expectedCheckpointCount > 0 && manifest.requiredEventCount > 0,
);
for (const [name, spec] of Object.entries(manifest.artifacts)) {
  const bytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing ${name} artifact ${spec.path}`);
  });
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    spec.sha256,
    `Corrupt ${name} artifact`,
  );
}
// Historical producers and current checkers are different identities. Keep
// capture sources pinned while the current Game is actually replayed below.
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (manifest.captureProducer) {
  const source = JSON.parse(await readFile(manifest.captureProducer));
  assert.equal(source.captureCommit, manifest.captureCommit);
  assert.ok(Object.keys(source.sha256).length > 60);
  for (const [path, hash] of Object.entries(source.sha256)) {
    const bytes = path.startsWith(".local/")
      ? await readFile(`${manifest.artifactRoot}/capture-config.js`)
      : execFileSync("git", ["show", `${manifest.captureCommit}:${path}`]);
    assert.equal(
      digest(bytes),
      hash,
      `Changed campaign capture producer ${path}`,
    );
  }
}
if (manifest.browserReplayRoot) {
  const source = JSON.parse(
    await readFile(`${manifest.browserReplayRoot}/source-revision.json`),
  );
  assert.ok(Object.keys(source.sha256).length > 60);
  for (const [path, hash] of Object.entries(source.sha256)) {
    const bytes = manifest.replayCommit
      ? execFileSync("git", ["show", `${manifest.replayCommit}:${path}`])
      : await readFile(path);
    assert.equal(
      digest(bytes),
      hash,
      `Changed browser replay producer ${path}`,
    );
  }
}
for (const [path, hash] of Object.entries(manifest.verificationTools ?? {}))
  assert.equal(
    digest(await readFile(path)),
    hash,
    `Changed campaign verification tool ${path}`,
  );
await mkdir(verificationRoot, { recursive: true });
function replay(extra = []) {
  const r = spawnSync(
    process.execPath,
    [
      "scripts/replay-hard-campaign.js",
      manifest.artifactRoot,
      `--manifest=${manifestPath}`,
      ...extra,
    ],
    {
      encoding: "utf8",
      timeout: 60000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.ifError(r.error);
  return {
    status: r.status,
    text: `${r.stdout}\n${r.stderr}`,
    stdout: r.stdout,
  };
}
const positive = replay();
await writeFile(`${verificationRoot}/replay.log`, positive.text);
assert.equal(positive.status, 0, positive.text);
const result = JSON.parse(positive.stdout);
assert.equal(result.mode, "recorded-input replay");
assert.equal(result.checked, manifest.expectedCheckpointCount);
assert.equal(result.consumed, manifest.requiredEventCount);
assert.ok(result.rendered > 0 && result.flagAliasPresentations > 0);
assert.deepEqual(result.state.ending, manifest.expectedEnding);
assert.deepEqual(
  result.state.campaign.playerCollected,
  manifest.expectedOwnership.playerCollected,
);
const spec = manifest.artifacts["browser-checkpoints"];
assert.ok(spec, "SETUP: missing independent browser checkpoints");
const browserBytes = await readFile(spec.path).catch(() => {
  throw Error(`SETUP: missing independent browser capture ${spec.path}`);
});
assert.equal(
  createHash("sha256").update(browserBytes).digest("hex"),
  spec.sha256,
  "Corrupt browser capture",
);
const browser = JSON.parse(browserBytes);
function compareBrowser(checks) {
  assert.equal(
    checks.length,
    manifest.expectedCheckpointCount,
    "Missing browser checkpoints",
  );
  for (let i = 0; i < checks.length; i++) {
    const { name, stateSha256, pixelsSha256 } = checks[i];
    assert.deepEqual(
      { name, stateSha256, pixelsSha256 },
      manifest.browserCheckpoints[i],
      `Browser checkpoint${i}`,
    );
  }
}
compareBrowser(browser);
const progress = JSON.parse(
  await readFile(manifest.artifacts["browser-progress"].path),
);
assert.equal(
  progress.completed,
  true,
  "Incomplete independent browser receipt",
);
assert.equal(
  progress.consumed,
  manifest.requiredEventCount,
  "Unfinished independent browser input stream",
);
assert.deepEqual(progress.errors, [], "Independent browser rendering errors");
const wrongPixel = structuredClone(browser);
wrongPixel[0].pixelsSha256 = "0".repeat(64);
assert.throws(() => compareBrowser(wrongPixel), /Browser checkpoint0/);
assert.throws(
  () => compareBrowser(browser.slice(1)),
  /Missing browser checkpoints/,
);
assert.deepEqual(
  result.state.campaign.rivalCollected,
  manifest.expectedOwnership.rivalCollected,
);
for (const [mode, reason] of [
  ["wrong-difficulty", /Carried replay checkpoint0 campaign-start/],
  ["alter-checkpoint", /Carried replay checkpoint0 campaign-start/],
  ["omit-checkpoint", /Missing required checkpoints/],
]) {
  const negative = replay([`--negative=${mode}`]);
  await writeFile(`${verificationRoot}/${mode}.log`, negative.text);
  assert.equal(negative.status, 1, `${mode} must fail`);
  assert.match(negative.text, reason);
  assert.doesNotMatch(
    negative.text,
    /SETUP:|ENOENT|Cannot find module|Timed out/,
  );
}
console.log(
  `Hard campaign: ${result.checked} exact carried state and independent browser pixel checkpoints, all${result.consumed} input events consumed, ${result.rendered} flight presentations; 5 negative controls rejected. Port regression, not original whole-campaign parity.`,
);
