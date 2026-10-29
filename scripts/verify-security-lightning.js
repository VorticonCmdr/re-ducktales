import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PNG } from "pngjs";
const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ??
  "reference/office-lightning.json";
const manifest = JSON.parse(await readFile(manifestPath));
assert.ok(
  [undefined, "office"].includes(manifest.verificationEdition),
  "Unknown lightning evidence edition",
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
    throw Error(`SETUP: missing lightning artifact ${p}`);
  });
assert.equal(manifest.pending, false);
assert.equal(manifest.browserVerified, true);
assert.equal(manifest.milestone, "flight-lightning");
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.expectedCheckpointCount, 6);
assert.equal(manifest.requiredEventCount, 164);
assert.equal(manifest.expectedInputCount, 35);
assert.equal(
  hash(await load(manifest.originalEvidenceManifest)),
  manifest.originalEvidenceManifestSha256,
);
assert.equal(
  Object.keys(manifest.artifacts).length,
  officeEdition ? 40 : 32,
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
    officeEdition ? 507 : 90,
  ],
  [
    manifest.browserProducer,
    manifest.browserCommit,
    officeEdition
      ? manifest.browserSourceArchive
      : `${manifest.artifactRoot}/browser-sources`,
    officeEdition ? 508 : 94,
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
const codes = profile.events.flatMap((row) => {
  assert.ok(Number.isInteger(row.count) && row.count > 0 && row.count <= 35);
  assert.ok([192, 193, 197].includes(row.byte));
  return Array(row.count).fill(row.byte);
});
assert.equal(codes.length, 35);
assert.equal(hash(Buffer.from(codes)), profile.sha256);
assert.deepEqual(profile.provenance.policy, {
  altitude: [0, 15],
  climbHeading: 2,
});
const entry = JSON.parse(
  await load(manifest.artifacts["entry-reference"].path),
);
assert.equal(entry.milestone, "departure-entry");
assert.equal(entry.requiredEventCount, 60);
assert.equal(entry.buildManifest, manifest.buildManifest);
assert.equal(entry.buildManifestSha256, manifest.buildManifestSha256);
for (const [name, spec] of Object.entries(entry.artifacts))
  assert.equal(
    hash(await load(spec.path)),
    spec.sha256,
    `Changed departure ${name}`,
  );
const entrySource = JSON.parse(
  await load(manifest.artifacts["entry-source"].path),
);
assert.equal(entrySource.captureCommit, manifest.entryCommit);
assert.equal(Object.keys(entrySource.files).length, officeEdition ? 507 : 87);
if (officeEdition) {
  // This view uses the identical capture producer already audited above.
  assert.equal(
    manifest.artifacts["entry-source"].path,
    manifest.captureProducer,
  );
  assert.equal(
    manifest.artifacts["capture-source"].path,
    manifest.captureProducer,
  );
  assert.equal(
    manifest.artifacts["entry-source"].sha256,
    manifest.artifacts["capture-source"].sha256,
  );
  assert.equal(manifest.entryCommit, manifest.captureCommit);
  assert.equal(manifest.entrySourceArchive, manifest.captureSourceArchive);
} else {
  for (const [p, h] of Object.entries(entrySource.files)) {
    assert.equal(hash(await load(`${entry.captureRoot}/sources/${p}`)), h, p);
    assert.equal(
      hash(execFileSync("git", ["show", `${entrySource.captureCommit}:${p}`])),
      h,
      p,
    );
  }
}
const checks = JSON.parse(
  await load(manifest.artifacts["campaign-checkpoints"].path),
);
if (officeEdition) {
  const env = JSON.parse(
    await load(manifest.artifacts["capture-environment"].path),
  );
  assert.equal(env.completed, false);
}
assert.equal(checks.length, 6);
assert.equal(
  hash(PNG.sync.read(await load(manifest.artifacts["entry-png"].path)).data),
  checks[0].pixelsSha256,
  "Departure pixels",
);
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
  assert.equal(points.length, 6, "Missing browser checkpoints");
  for (let i = 0; i < 6; i++)
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
assert.equal(progress.consumed, 164);
assert.equal(progress.expectedEvents, 164);
assert.deepEqual(progress.errors, []);
assert.equal(progress.navigation.length, 1);
assert.equal(
  JSON.parse(await load(manifest.artifacts["browser-events"].path)).length,
  164,
);

const browserNegative = (
  await load(manifest.artifacts["browser-negative"].path)
).toString();
assert.match(browserNegative, /Carried browser state4 recovery/);
assert.match(browserNegative, /1 failed/);
assert.doesNotMatch(
  browserNegative,
  /SETUP:|ENOENT|No tests found|Test timeout|TimeoutError|browserType\.launch|Test was interrupted|ETIMEDOUT|Channel closed/,
);
if (officeEdition) {
  for (const [prefix, sourceCount, caseCount, requiredTitle] of [
    ["hard", 498, 1, "Hard campaign carries"],
    ["jungle", 503, 3, "recorded jungle treasure"],
    ["mountain", 506, 2, "recorded mountain summit"],
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
        assert.equal(
          hash(await load(path)),
          hashValue,
          `Changed shared runtime since retained ${prefix} browser receipt ${path}`,
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
  assert.equal(Object.keys(sharedSource.files).length, 86);
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
  assert.equal(sharedReport.stats.expected, 3);
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
  assert.equal(sharedTests.length, 3);
  assert.ok(
    sharedTests.some((s) => s.title.startsWith("recorded mountain summit")),
  );
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
  ["mountain", "reference/security-mountain-ascent.json", 27, 104],
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
  ? ".local/office-lightning-verification"
  : ".local/security-lightning-verification";
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
assert.equal(result.consumed, 164);
assert.equal(result.checked, 6);
assert.equal(result.rendered, 43);
assert.equal(result.flagAliasPresentations, 0);
assert.deepEqual(result.heldAtExploratoryEndpoint, []);
assert.deepEqual(
  Object.fromEntries(
    [
      "frames",
      "presentations",
      "seed",
      "phase",
      "inputReads",
      "lastInputCode",
    ].map((k) => [k, result.state.flight[k]]),
  ),
  manifest.expectedOutcome,
);
const entryChecks = JSON.parse(
  await load(entry.artifacts["campaign-checkpoints"].path),
);
assert.deepEqual(
  checks[0],
  entryChecks[0],
  officeEdition
    ? "Full flight must start at the exact same-capture external departure prefix"
    : "Full flight must start at independently verified departure",
);
const points = checks.map((c) => c.state.flight);
assert.equal(points[1].inputReads, 35);
assert.equal(points[1].lastInputCode, 192);
assert.equal(points[2].inputReads, 36);
assert.equal(points[2].lastInputCode, 0);
assert.equal(points[2].heading, 8);
assert.equal(points[3].frames, points[2].frames + 3);
assert.equal(points[3].lastInputCode, 0);
assert.ok(points[3].speed < points[2].speed);
assert.equal(points[4].frames, points[3].frames + 3);
assert.ok(points[4].speed > points[3].speed);
assert.ok(points[4].y < points[3].y);
assert.ok(points[5].inputReads > points[4].inputReads);
assert.equal(points[5].inputReads, 43);
assert.equal(points[5].lastInputCode, 0);
for (const [mode, reason] of [
  [
    "wrong-security",
    /Unsupported security input map|Carried replay checkpoint0 departure/,
  ],
  ["alter-checkpoint", /Carried replay checkpoint0 departure/],
  ["omit-checkpoint", /Missing required checkpoints/],
]) {
  const r = replay(mode);
  await writeFile(`${root}/${mode}.log`, r.output);
  assert.equal(r.status, 1, mode);
  assert.match(r.output, reason);
  assert.doesNotMatch(r.output, /SETUP:|ENOENT|Cannot find module|Timed out/);
}
console.log(
  "Lightning:6 exact carried Game and independent browser state/pixel checkpoints,164 DOM events,35 external samples; natural input36 flush,deceleration,fresh-key recovery,all releases consumed. Five comparison negatives and all three existing recorded routes retained. Port evidence,not native whole-flight parity.",
);
