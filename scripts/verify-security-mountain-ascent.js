import { verifySharedRuntimeFile } from "./shared-runtime-regression.js";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PNG } from "pngjs";
const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ??
  "reference/office-mountain-ascent.json";
const manifest = JSON.parse(await readFile(manifestPath));
assert.ok(
  [undefined, "office"].includes(manifest.verificationEdition),
  "Unknown mountain evidence edition",
);
const officeEdition = manifest.verificationEdition === "office";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const load = (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing mountain artifact ${p}`);
  });
assert.equal(manifest.pending, false);
assert.equal(manifest.browserVerified, true);
assert.equal(manifest.milestone, "mountain-ascent");
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.expectedCheckpointCount, 27);
assert.equal(manifest.requiredEventCount, 104);
assert.equal(manifest.expectedInputCount, 764);
assert.equal(
  Object.keys(manifest.artifacts).length,
  officeEdition ? 53 : 48,
  "Missing required evidence",
);
for (const name of [
  "environment",
  "captured-events",
  "campaign-checkpoints",
  "timeline",
  "capture-source",
  "input-profile",
  "browser-source",
  "browser-results",
  "browser-checkpoints",
  "browser-progress",
  "browser-events",
  "browser-negative",
])
  assert.ok(
    manifest.artifacts[name],
    `SETUP: missing required ${name} artifact`,
  );

assert.equal(
  hash(await load(manifest.buildManifest)),
  manifest.buildManifestSha256,
);
for (const [name, spec] of Object.entries(manifest.artifacts)) {
  const bytes = await load(spec.path);
  assert.equal(bytes.length, spec.bytes, name);
  assert.equal(hash(bytes), spec.sha256, `Corrupt ${name}`);
}
for (const [path, h] of Object.entries(manifest.verificationTools))
  assert.equal(hash(await load(path)), h, `Changed verifier ${path}`);
for (const [record, commit, archive, count] of [
  [
    manifest.captureProducer,
    manifest.captureCommit,
    officeEdition
      ? manifest.captureSourceArchive
      : `${manifest.captureRoot}/sources`,
    officeEdition ? 505 : 131,
  ],
  [
    manifest.browserProducer,
    manifest.browserCommit,
    officeEdition
      ? manifest.browserSourceArchive
      : `${manifest.artifactRoot}/browser-sources`,
    officeEdition ? 506 : 132,
  ],
]) {
  const source = JSON.parse(await load(record));
  assert.equal(source.captureCommit ?? source.browserCommit, commit);
  assert.equal(Object.keys(source.files).length, count);
  for (const [p, h] of Object.entries(source.files)) {
    assert.equal(hash(await load(`${archive}/${p}`)), h, p);
    assert.equal(hash(execFileSync("git", ["show", `${commit}:${p}`])), h, p);
  }
}
for (const name of ["captured-events", "campaign-checkpoints", "timeline"])
  assert.equal(
    hash(await load(`${manifest.captureRoot}/${name}.json`)),
    manifest.artifacts[name].sha256,
    `Changed captured ${name}`,
  );
const profile = JSON.parse(
  await load(manifest.artifacts["input-profile"].path),
);
const codes = profile.inputEvents.flatMap((row) => {
  assert.ok(Number.isInteger(row.count) && row.count > 0 && row.count <= 764);
  assert.ok([0, 1, 3, 5, 7, 64, 65, 67, 69, 71].includes(row.byte));
  return Array(row.count).fill(row.byte);
});
assert.equal(codes.length, 764);
assert.equal(hash(Buffer.from(codes)), profile.sha256);
assert.equal(profile.provenance.authoredNeutralPrefix, 0);
const legacy = await load(profile.provenance.legacySource);
assert.equal(hash(legacy), profile.provenance.legacySourceSha256);
assert.deepEqual(
  codes,
  JSON.parse(legacy).inputEvents.flatMap((row) =>
    Array(row.count).fill(row.byte),
  ),
);
const checks = JSON.parse(
  await load(manifest.artifacts["campaign-checkpoints"].path),
);
if (officeEdition) {
  const env = JSON.parse(
    await load(manifest.artifacts["capture-environment"].path),
  );
  assert.equal(env.completed, false);
  assert.equal(checks[0].stateSha256, manifest.entryStateSha256);
  assert.equal(checks[0].pixelsSha256, manifest.entryPixelsSha256);
}
assert.equal(checks.length, 27);
for (const c of checks) {
  assert.equal(hash(canonical(c.state)), c.stateSha256);
  const png = PNG.sync.read(
    await load(manifest.artifacts[`png-${c.name}`].path),
  );
  assert.deepEqual([png.width, png.height], [320, 200]);
  assert.equal(hash(png.data), c.pixelsSha256);
}
const report = JSON.parse(
  await load(manifest.artifacts["browser-results"].path),
);
assert.deepEqual(report.errors, []);
assert.equal(report.stats.expected, 2);
for (const key of ["unexpected", "skipped", "flaky"])
  assert.equal(report.stats[key], 0);
const tests = [];
function visit(s) {
  for (const spec of s.specs ?? []) tests.push(...spec.tests);
  for (const c of s.suites ?? []) visit(c);
}
report.suites.forEach(visit);
assert.equal(tests.length, 2);
for (const t of tests) {
  assert.equal(t.status, "expected");
  assert.equal(t.results.length, 1);
  assert.equal(t.results[0].status, "passed");
}
function compare(points) {
  assert.equal(points.length, 27, "Missing browser checkpoints");
  for (let i = 0; i < 27; i++)
    for (const k of ["name", "at", "eventCount", "stateSha256", "pixelsSha256"])
      assert.deepEqual(
        points[i][k],
        manifest.checkpoints[i][k],
        `Browser checkpoint${i} ${k}`,
      );
}
const browser = JSON.parse(
  await load(manifest.artifacts["browser-checkpoints"].path),
);
compare(browser);
const altered = structuredClone(browser);
altered[0].pixelsSha256 = "0".repeat(64);
assert.throws(() => compare(altered), /Browser checkpoint0 pixelsSha256/);
assert.throws(() => compare(browser.slice(1)), /Missing browser checkpoints/);
const progress = JSON.parse(
  await load(manifest.artifacts["browser-progress"].path),
);
assert.equal(progress.completed, true);
assert.equal(progress.consumed, 104);
assert.equal(progress.expectedEvents, 104);
assert.deepEqual(progress.errors, []);
assert.equal(progress.navigation.length, 1);
assert.equal(
  JSON.parse(await load(manifest.artifacts["browser-events"].path)).length,
  104,
);

const browserNegative = (
  await load(manifest.artifacts["browser-negative"].path)
).toString();
assert.match(browserNegative, /Carried browser state12 input-480/);
assert.match(browserNegative, /1 failed/);
assert.doesNotMatch(
  browserNegative,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
if (officeEdition) {
  for (const [prefix, sourceCount, caseCount, requiredTitle] of [
    ["hard", 498, 1, "Hard campaign carries"],
    ["jungle", 503, 3, "recorded jungle treasure"],
  ]) {
    const reference = JSON.parse(
      await load(manifest.artifacts[`${prefix}-reference`].path),
    );
    const source = JSON.parse(
      await load(manifest.artifacts[`${prefix}-browser-source`].path),
    );
    assert.equal(
      source.browserCommit,
      prefix === "hard" ? reference.replayCommit : reference.browserCommit,
    );
    assert.equal(Object.keys(source.files).length, sourceCount);
    for (const [path, hashValue] of Object.entries(source.files)) {
      assert.equal(
        hash(await load(`${manifest.regressionArchives[prefix]}/${path}`)),
        hashValue,
        path,
      );
      assert.equal(
        hash(execFileSync("git", ["show", `${source.browserCommit}:${path}`])),
        hashValue,
        path,
      );
      if (
        path.startsWith("src/") ||
        [
          "index.html",
          "vite.config.js",
          "tests/browser/helpers/recorded-campaign.js",
          "tests/browser/helpers/clock.js",
        ].includes(path)
      )
        await verifySharedRuntimeFile(
          path,
          hashValue,
          manifest.currentRuntimeRegression,
          prefix,
        );
    }
    const report = JSON.parse(
      await load(manifest.artifacts[`${prefix}-browser-results`].path),
    );
    assert.deepEqual(report.errors, []);
    assert.equal(report.stats.expected, caseCount);
    for (const key of ["unexpected", "skipped", "flaky"])
      assert.equal(report.stats[key], 0);
    const cases = [];
    function visit(suite) {
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests) cases.push({ title: spec.title, test });
      for (const child of suite.suites ?? []) visit(child);
    }
    report.suites.forEach(visit);
    assert.equal(cases.length, caseCount);
    assert.ok(cases.some((c) => c.title.startsWith(requiredTitle)));
    for (const { test } of cases) {
      assert.equal(test.status, "expected");
      assert.equal(test.results.length, 1);
      assert.equal(test.results[0].status, "passed");
    }
  }
} else {
  const sharedSource = JSON.parse(
    await load(manifest.artifacts["shared-browser-source"].path),
  );
  assert.equal(sharedSource.commit, manifest.sharedBrowserCommit);
  assert.equal(Object.keys(sharedSource.files).length, 84);
  for (const [p, h] of Object.entries(sharedSource.files)) {
    assert.equal(
      hash(await load(`${manifest.artifactRoot}/shared-sources/${p}`)),
      h,
      p,
    );
    assert.equal(
      hash(execFileSync("git", ["show", `${sharedSource.commit}:${p}`])),
      h,
      p,
    );
  }
  // The shared adapter must retain both existing recorded routes.
  const sharedReport = JSON.parse(
    await load(manifest.artifacts["shared-browser-results"].path),
  );
  assert.deepEqual(sharedReport.errors, []);
  assert.equal(sharedReport.stats.expected, 2);
  for (const key of ["unexpected", "skipped", "flaky"])
    assert.equal(sharedReport.stats[key], 0);
  const sharedTests = [];
  function sharedVisit(s) {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests)
        sharedTests.push({ title: spec.title, test: t });
    }
    for (const child of s.suites ?? []) sharedVisit(child);
  }
  sharedReport.suites.forEach(sharedVisit);
  assert.equal(sharedTests.length, 2);
  assert.ok(
    sharedTests.some((s) => s.title.startsWith("Hard campaign carries")),
  );
  assert.ok(
    sharedTests.some((s) => s.title.startsWith("recorded jungle treasure")),
  );
  for (const { test: t } of sharedTests) {
    assert.equal(t.status, "expected");
    assert.equal(t.results.length, 1);
    assert.equal(t.results[0].status, "passed");
  }
}
for (const [prefix, path, count, eventCount] of [
  ["hard", "reference/hard-campaign-security.json", 28, 4140],
  ["jungle", "reference/security-jungle-treasure.json", 27, 70],
]) {
  const reference = JSON.parse(
    await load(
      officeEdition ? manifest.artifacts[`${prefix}-reference`].path : path,
    ),
  );
  const expected = reference.browserCheckpoints ?? reference.checkpoints;
  const observed = JSON.parse(
    await load(manifest.artifacts[`${prefix}-regression-checkpoints`].path),
  );
  assert.equal(observed.length, count);
  for (let i = 0; i < count; i++)
    for (const key of ["name", "stateSha256", "pixelsSha256"])
      assert.equal(
        observed[i][key],
        expected[i][key],
        `${prefix} regression checkpoint${i} ${key}`,
      );
  const progress = JSON.parse(
    await load(manifest.artifacts[`${prefix}-regression-progress`].path),
  );
  assert.equal(progress.completed, true);
  assert.equal(progress.consumed, eventCount);
  assert.deepEqual(progress.errors, []);
  assert.equal(progress.navigation.length, 1);
  assert.equal(
    JSON.parse(
      await load(manifest.artifacts[`${prefix}-regression-events`].path),
    ).length,
    eventCount,
  );
}
const root = officeEdition
  ? ".local/office-mountain-ascent-verification"
  : ".local/security-mountain-ascent-verification";
await mkdir(root, { recursive: true });
function replay(mode) {
  const r = spawnSync(
    process.execPath,
    [
      "scripts/replay-hard-campaign.js",
      manifest.artifactRoot,
      `--manifest=${manifestPath}`,
      ...(mode ? [`--negative=${mode}`] : []),
    ],
    { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 },
  );
  assert.ifError(r.error);
  return { ...r, output: r.stdout + "\n" + r.stderr };
}
const positive = replay();
await writeFile(`${root}/positive.log`, positive.output);
assert.equal(positive.status, 0, positive.output);
const result = JSON.parse(positive.stdout);
assert.equal(result.mode, "recorded-input replay");
assert.equal(result.consumed, 104);
assert.equal(result.checked, 27);
assert.equal(result.rendered, 74);
assert.equal(result.flagAliasPresentations, 0);
assert.deepEqual(result.heldAtExploratoryEndpoint, []);
assert.deepEqual(
  {
    money: result.state.money,
    day: result.state.campaign.day,
    playerCollected: result.state.campaign.playerCollected,
    ...Object.fromEntries(
      ["frames", "presentations", "lives", "seed"].map((k) => [
        k,
        result.state.mountain[k],
      ]),
    ),
  },
  manifest.expectedOutcome,
);
for (const [mode, reason] of [
  [
    "wrong-security",
    /Unsupported security input map|Carried replay checkpoint0 entry/,
  ],
  ["alter-checkpoint", /Carried replay checkpoint0 entry/],
  ["omit-checkpoint", /Missing required checkpoints/],
]) {
  const r = replay(mode);
  await writeFile(`${root}/${mode}.log`, r.output);
  assert.equal(r.status, 1, mode);
  assert.match(r.output, reason);
  assert.doesNotMatch(r.output, /SETUP:|ENOENT|Cannot find module|Timed out/);
}
console.log(
  "Mountain:27 exact carried Game and independent browser state/pixel checkpoints,104 DOM events,764 unchanged mountain samples;8100 dollars/day17/three lives. Five comparison negatives. Port evidence,not native whole-level timing parity.",
);
