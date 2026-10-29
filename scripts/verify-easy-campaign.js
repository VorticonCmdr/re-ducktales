import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/easy-campaign-security.json";
const verificationRoot = ".local/security-easy-campaign-verification";
const manifest = JSON.parse(
  await readFile(manifestPath).catch(() => {
    throw Error("SETUP: missing accepted Easy campaign manifest");
  }),
);
assert.equal(
  manifest.pendingBrowserReplay,
  false,
  "SETUP: new Easy capture requires an independent browser replay receipt",
);
assert.equal(
  manifest.evidenceLevel,
  "closed-loop port regression and independent browser scenario",
);
assert.ok(
  manifest.expectedCheckpointCount > 0 && manifest.requiredEventCount > 0,
);
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.expectedCheckpointCount, 36);
assert.equal(manifest.requiredEventCount, 3516);
assert.equal(manifest.expectedFlightPresentations, 1188);
assert.equal(manifest.expectedFlagAliasPresentations, 0);
assert.equal(
  Object.keys(manifest.artifacts).length,
  18,
  "Missing required Easy evidence",
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
  assert.equal(Object.keys(source.files).length, 268);
  for (const [path, hash] of Object.entries(source.files)) {
    const bytes = execFileSync("git", [
      "show",
      `${manifest.captureCommit}:${path}`,
    ]);
    assert.equal(
      digest(await readFile(`${manifest.captureSourceArchive}/${path}`)),
      hash,
      `Changed capture archive ${path}`,
    );
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
  assert.equal(source.browserCommit, manifest.replayCommit);
  assert.equal(Object.keys(source.files).length, 269);
  for (const [path, hash] of Object.entries(source.files)) {
    assert.equal(
      digest(await readFile(`${manifest.browserSourceArchive}/${path}`)),
      hash,
      `Changed browser archive ${path}`,
    );
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
const entrySource = JSON.parse(
  await readFile(manifest.artifacts["entry-capture-source"].path),
);
assert.equal(entrySource.captureCommit, manifest.entryCaptureCommit);
assert.equal(Object.keys(entrySource.files).length, 267);
for (const [p, h] of Object.entries(entrySource.files)) {
  assert.equal(
    digest(await readFile(`${manifest.entrySourceArchive}/${p}`)),
    h,
    p,
  );
  assert.equal(
    digest(
      execFileSync("git", ["show", `${manifest.entryCaptureCommit}:${p}`]),
    ),
    h,
    p,
  );
}
const entry = JSON.parse(
  await readFile(manifest.artifacts["entry-reference"].path),
);
assert.equal(entry.expectedHard, false);
assert.equal(entry.requiredEventCount, 928);
for (const [name, spec] of Object.entries(entry.artifacts)) {
  const bytes = await readFile(spec.path).catch(() => {
    throw Error(`SETUP: missing Easy entry artifact ${spec.path}`);
  });
  assert.equal(digest(bytes), spec.sha256, `Corrupt Easy entry ${name}`);
}
const entryChecks = JSON.parse(
  await readFile(entry.artifacts["campaign-checkpoints"].path),
);
const fullChecks = JSON.parse(
  await readFile(manifest.artifacts["campaign-checkpoints"].path),
);
const arrival = fullChecks.find(
  (c) => c.name === "arrival" && c.state.scene === "jungle",
);
assert.deepEqual(
  arrival,
  entryChecks[0],
  "Complete Easy route must carry independently verified entry",
);
const plan = JSON.parse(
  await readFile(manifest.artifacts["planning-selected"].path),
);
assert.equal(plan.delay, 60);
assert.equal(plan.used, 917);
assert.equal(plan.final.jungle.outcome.code, 1);
for (const mode of ["omit-easy-confirm", "omit-campaign-jungle-move"]) {
  const output = (await readFile(manifest.artifacts[mode].path)).toString();
  assert.match(output, /1 failed/);
  assert.match(
    output,
    mode === "omit-easy-confirm"
      ? /Carried browser state0 campaign-start/
      : /Error: Carried browser state\d+ jungle-input-\d+|Error: Recorded external event sequence/,
  );
  assert.doesNotMatch(
    output,
    /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch:/,
  );
}
for (const [path, hash] of Object.entries(manifest.verificationTools ?? {}))
  assert.equal(
    digest(await readFile(path)),
    hash,
    `Changed campaign verification tool ${path}`,
  );
const captureEnv = JSON.parse(
  await readFile(manifest.artifacts["capture-environment"].path),
);
assert.equal(captureEnv.completed, false);
assert.equal(captureEnv.mode, "exploratory");
assert.equal(captureEnv.observerError, null);
const inputProfile = JSON.parse(
  await readFile(manifest.artifacts["input-profile"].path),
);
assert.equal(inputProfile.requiredJungleInputs, 917);
assert.equal(inputProfile.jungleProvenance.authoredNeutralPrefix, 60);
const legacy = await readFile(inputProfile.jungleProvenance.legacySource);
assert.equal(digest(legacy), inputProfile.jungleProvenance.legacySourceSha256);
const inputCodes = inputProfile.jungle.flatMap((row) => {
  assert.ok(Number.isInteger(row.count) && row.count > 0 && row.count <= 917);
  assert.ok([0, 1, 3, 5, 7, 64].includes(row.byte));
  return Array(row.count).fill(row.byte);
});
assert.deepEqual(inputCodes, [
  ...Array(60).fill(0),
  ...JSON.parse(legacy).jungle.inputEvents.flatMap((e) =>
    Array(e.count).fill(e.byte),
  ),
]);
assert.equal(inputCodes.length, 917);
assert.deepEqual(plan.inputs, inputCodes);
const report = JSON.parse(
  await readFile(manifest.artifacts["browser-results"].path),
);
assert.deepEqual(report.errors, []);
assert.equal(report.stats.expected, 1);
for (const k of ["unexpected", "skipped", "flaky"])
  assert.equal(report.stats[k], 0);
const tests = [];
function visit(s) {
  for (const spec of s.specs ?? []) tests.push(...spec.tests);
  for (const child of s.suites ?? []) visit(child);
}
report.suites.forEach(visit);
assert.equal(tests.length, 1);
assert.equal(tests[0].status, "expected");
assert.equal(tests[0].results.length, 1);
assert.equal(tests[0].results[0].status, "passed");
const endingPng = PNG.sync.read(
  await readFile(manifest.artifacts["ending-png"].path),
);
assert.deepEqual(
  [endingPng.width, endingPng.height],
  manifest.endingScreenshotDimensions,
);
// This is a CSS-sized diagnostic screenshot. Logical320x200 RGBA comparisons
// use all36 independent canvas checkpoints below, with no resize/tolerance.
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
assert.equal(result.rendered, manifest.expectedFlightPresentations);
assert.equal(
  result.flagAliasPresentations,
  manifest.expectedFlagAliasPresentations,
);
assert.deepEqual(result.heldAtExploratoryEndpoint, []);
assert.equal(result.state.difficulty, 0);
assert.equal(result.state.ending.won, true);
assert.equal(result.state.jungle.frames, 917);
assert.equal(result.state.mountain.frames, 764);
assert.equal(result.state.jungle.outcome.code, 1);
assert.equal(result.state.mountain.outcome.code, 1);
assert.equal(result.state.cave.outcome.status, "treasure");
assert.equal(result.state.campaign.rivalUnlockMask, 15);
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
assert.equal(progress.expectedEvents, 3516);
assert.equal(progress.navigation.length, 1);
assert.equal(
  JSON.parse(await readFile(manifest.artifacts["browser-events"].path)).length,
  3516,
);
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
  [
    "wrong-security",
    /Unsupported security input map|Carried replay checkpoint1 flight-start/,
  ],
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
  `Easy campaign: ${result.checked} exact carried state and independent browser pixel checkpoints, all${result.consumed} input events consumed, ${result.rendered} flight presentations; 7 comparison negatives rejected. Port regression, not original whole-campaign parity.`,
);
