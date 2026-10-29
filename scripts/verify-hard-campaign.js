import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/hard-campaign-security.json";
const manifest = JSON.parse(
  await readFile(manifestPath).catch(() => {
    throw Error("SETUP: missing accepted Hard campaign manifest");
  }),
);
assert.ok(
  [undefined, "office"].includes(manifest.verificationEdition),
  "Unknown Hard evidence edition",
);
const officeEdition = manifest.verificationEdition === "office";
const verificationRoot = officeEdition
  ? ".local/office-campaign-hard-verification"
  : manifestPath === "reference/hard-campaign-security.json"
    ? ".local/hard-security-campaign-verification"
    : ".local/hard-campaign-verification";
if (officeEdition) {
  assert.equal(manifest.expectedCheckpointCount, 28);
  assert.equal(manifest.requiredEventCount, 4140);
  assert.equal(manifest.expectedHard, true);
  assert.equal(
    Object.keys(manifest.artifacts).length,
    18,
    "Missing required Hard evidence",
  );
}
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
if (officeEdition) {
  for (const [role, count, revision, archive] of [
    [
      "capture-source",
      497,
      manifest.captureCommit,
      manifest.captureSourceArchive,
    ],
    [
      "browser-source",
      498,
      manifest.replayCommit,
      manifest.browserSourceArchive,
    ],
  ]) {
    const source = JSON.parse(await readFile(manifest.artifacts[role].path));
    assert.equal(
      source[role === "capture-source" ? "captureCommit" : "browserCommit"],
      revision,
    );
    assert.equal(Object.keys(source.files).length, count);
    for (const [path, hash] of Object.entries(source.files)) {
      assert.equal(
        digest(await readFile(`${archive}/${path}`)),
        hash,
        `Changed ${role} archive ${path}`,
      );
      assert.equal(
        digest(execFileSync("git", ["show", `${revision}:${path}`])),
        hash,
        `Changed ${role} producer ${path}`,
      );
    }
    const config = source.externalConfiguration;
    assert.equal(
      digest(await readFile(config.archive)),
      config.sha256,
      `Changed ${role} configuration`,
    );
    assert.equal(
      config.archive,
      manifest.artifacts[
        role === "capture-source" ? "capture-config" : "browser-config"
      ].path,
    );
  }
  const env = JSON.parse(
    await readFile(manifest.artifacts["capture-environment"].path),
  );
  assert.equal(env.completed, false);
  assert.equal(env.mode, "exploratory");
  assert.equal(env.observerError, null);
  const lifecycle = JSON.parse(
    await readFile(manifest.artifacts["capture-lifecycle"].path),
  );
  assert.equal(lifecycle.navigation.length, 1);
  const report = JSON.parse(
    await readFile(manifest.artifacts["browser-results"].path),
  );
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.expected, 1);
  for (const key of ["unexpected", "skipped", "flaky"])
    assert.equal(report.stats[key], 0);
  const tests = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) tests.push(...spec.tests);
    for (const child of suite.suites ?? []) visit(child);
  }
  report.suites.forEach(visit);
  assert.equal(tests.length, 1);
  assert.equal(tests[0].status, "expected");
  assert.equal(tests[0].results.length, 1);
  assert.equal(tests[0].results[0].status, "passed");
  const png = PNG.sync.read(
    await readFile(manifest.artifacts["ending-png"].path),
  );
  assert.deepEqual([png.width, png.height], [958, 599]);
  const negative = (
    await readFile(manifest.artifacts["browser-negative"].path)
  ).toString();
  assert.match(negative, /1 failed/);
  assert.match(negative, /Carried browser state0 campaign-start/);
  assert.doesNotMatch(
    negative,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:|ETIMEDOUT|Channel closed/,
  );
} else {
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
if (officeEdition) {
  assert.equal(result.rendered, 1629);
  assert.equal(result.flagAliasPresentations, 1);
  assert.deepEqual(result.heldAtExploratoryEndpoint, []);
  assert.equal(result.state.difficulty, 2);
  assert.equal(result.state.jungle.frames, 447);
  assert.equal(result.state.mountain.frames, 671);
  assert.equal(result.state.jungle.outcome.code, 1);
  assert.equal(result.state.mountain.outcome.code, 1);
  assert.equal(result.state.cave.outcome.status, "treasure");
  assert.equal(result.state.campaign.rivalUnlockMask, 15);
}
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
if (officeEdition) {
  assert.equal(progress.expectedEvents, 4140);
  assert.equal(progress.navigation.length, 1);
  assert.equal(
    JSON.parse(await readFile(manifest.artifacts["browser-events"].path))
      .length,
    4140,
  );
}
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
