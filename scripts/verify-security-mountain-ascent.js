import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { PNG } from "pngjs";
import manifest from "../reference/security-mountain-ascent.json" with { type: "json" };
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
    `${manifest.captureRoot}/sources`,
    131,
  ],
  [
    manifest.browserProducer,
    manifest.browserCommit,
    `${manifest.artifactRoot}/browser-sources`,
    132,
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
  /SETUP:|ENOENT|No tests found|Test timeout|browserType\.launch/,
);
const root = ".local/security-mountain-ascent-verification";
await mkdir(root, { recursive: true });
function replay(mode) {
  const r = spawnSync(
    process.execPath,
    [
      "scripts/replay-hard-campaign.js",
      manifest.artifactRoot,
      "--manifest=reference/security-mountain-ascent.json",
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
