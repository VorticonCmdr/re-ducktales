import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
const manifestPath =
  process.argv.find((arg) => arg.startsWith("--manifest="))?.slice(11) ??
  "reference/office-jungle-treasure.json";
const manifest = JSON.parse(await readFile(manifestPath));
assert.ok(
  [undefined, "office"].includes(manifest.verificationEdition),
  "Unknown jungle-treasure evidence edition",
);
const officeEdition = manifest.verificationEdition === "office";
import historicalHard from "../reference/hard-campaign-security.json" with { type: "json" };
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
const load = async (p) =>
  readFile(p).catch(() => {
    throw Error(`SETUP: missing treasure artifact ${p}`);
  });
const hard = officeEdition
  ? JSON.parse(await load(manifest.artifacts["hard-reference"].path))
  : historicalHard;
assert.equal(manifest.pending, false);
assert.equal(manifest.browserVerified, true);
assert.equal(manifest.milestone, "jungle-treasure");
assert.equal(manifest.expectedHard, false);
assert.equal(manifest.expectedCheckpointCount, 27);
assert.equal(manifest.requiredEventCount, 70);
assert.equal(manifest.expectedInputCount, 860);
assert.equal(
  Object.keys(manifest.artifacts).length,
  officeEdition ? 50 : 49,
  "Missing required evidence",
);
assert.equal(
  hash(await load(manifest.buildManifest)),
  manifest.buildManifestSha256,
);
for (const [name, spec] of Object.entries(manifest.artifacts)) {
  const b = await load(spec.path);
  assert.equal(b.length, spec.bytes, name);
  assert.equal(hash(b), spec.sha256, `Corrupt ${name}`);
}
for (const [p, h] of Object.entries(manifest.verificationTools))
  assert.equal(hash(await load(p)), h, `Changed verifier ${p}`);
for (const [record, commit, root, count] of [
  [
    manifest.captureProducer,
    manifest.captureCommit,
    officeEdition
      ? manifest.captureSourceArchive
      : `${manifest.captureRoot}/capture-sources`,
    officeEdition ? 502 : 127,
  ],
  [
    manifest.browserProducer,
    manifest.browserCommit,
    officeEdition
      ? manifest.browserSourceArchive
      : `${manifest.artifactRoot}/browser-sources`,
    officeEdition ? 503 : 128,
  ],
  [
    manifest.hardProducer,
    officeEdition ? hard.replayCommit : manifest.browserCommit,
    officeEdition
      ? manifest.hardSourceArchive
      : `${manifest.artifactRoot}/hard-sources`,
    officeEdition ? 498 : 126,
  ],
]) {
  const s = JSON.parse(await load(record));
  assert.equal(s.captureCommit ?? s.browserCommit ?? s.commit, commit);
  const files = officeEdition ? s.files : s.sha256;
  assert.equal(Object.keys(files).length, count);
  for (const [p, h] of Object.entries(files)) {
    assert.equal(hash(await load(`${root}/${p}`)), h, p);
    assert.equal(hash(execFileSync("git", ["show", `${commit}:${p}`])), h, p);
  }
}
for (const name of ["captured-events", "campaign-checkpoints", "timeline"])
  assert.equal(
    hash(await load(`${manifest.captureRoot}/${name}.json`)),
    manifest.artifacts[name].sha256,
    `Changed captured ${name}`,
  );
const checkpoints = JSON.parse(
  await load(manifest.artifacts["campaign-checkpoints"].path),
);
const profile = JSON.parse(
  await load(manifest.artifacts["input-profile"].path),
);
const codes = [];
for (const row of profile.inputEvents) {
  assert.ok(Number.isInteger(row.count) && row.count > 0 && row.count <= 860);
  assert.ok([0, 1, 3, 5, 7, 64, 65, 67, 69, 71].includes(row.byte));
  codes.push(...Array(row.count).fill(row.byte));
}
assert.equal(codes.length, 860);
assert.equal(hash(Buffer.from(codes)), profile.sha256);
assert.equal(profile.provenance.authoredNeutralPrefix, 3);
const legacyBytes = await load(profile.provenance.legacySource);
assert.equal(hash(legacyBytes), profile.provenance.legacySourceSha256);
const legacyInputs = JSON.parse(legacyBytes).jungle.inputEvents.flatMap((row) =>
  Array(row.count).fill(row.byte),
);
assert.deepEqual(codes, [0, 0, 0, ...legacyInputs]);
assert.equal(checkpoints.length, 27);
for (const point of checkpoints) {
  assert.equal(hash(canonical(point.state)), point.stateSha256);
  const png = PNG.sync.read(
    await load(manifest.artifacts[`png-${point.name}`].path),
  );
  assert.deepEqual([png.width, png.height], [320, 200]);
  assert.equal(hash(png.data), point.pixelsSha256);
}
function report(r, count) {
  assert.deepEqual(r.errors, []);
  assert.equal(r.stats.expected, count);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(r.stats[k], 0);
  const tests = [];
  function visit(s) {
    for (const spec of s.specs ?? []) tests.push(...spec.tests);
    for (const child of s.suites ?? []) visit(child);
  }
  r.suites.forEach(visit);
  assert.equal(tests.length, count);
  for (const t of tests) {
    assert.equal(t.status, "expected");
    assert.equal(t.results.length, 1);
    assert.equal(t.results[0].status, "passed");
  }
}
report(JSON.parse(await load(manifest.artifacts["browser-results"].path)), 3);
report(
  JSON.parse(await load(manifest.artifacts["hard-browser-results"].path)),
  1,
);
const browser = JSON.parse(
  await load(manifest.artifacts["browser-checkpoints"].path),
);
function compare(points) {
  assert.equal(points.length, 27, "Missing browser checkpoints");
  for (let i = 0; i < points.length; i++)
    for (const k of ["name", "at", "eventCount", "stateSha256", "pixelsSha256"])
      assert.deepEqual(
        points[i][k],
        manifest.checkpoints[i][k],
        `Browser checkpoint${i} ${k}`,
      );
}
compare(browser);
const altered = structuredClone(browser);
altered[0].pixelsSha256 = "0".repeat(64);
assert.throws(() => compare(altered), /Browser checkpoint0 pixelsSha256/);
assert.throws(() => compare(browser.slice(1)), /Missing browser checkpoints/);
const progress = JSON.parse(
  await load(manifest.artifacts["browser-progress"].path),
);
assert.equal(progress.completed, true);
assert.equal(progress.consumed, 70);
assert.deepEqual(progress.errors, []);
assert.equal(progress.navigation.length, 1);
assert.equal(
  JSON.parse(await load(manifest.artifacts["browser-events"].path)).length,
  70,
);
const hardProgress = JSON.parse(
  await load(manifest.artifacts["hard-browser-progress"].path),
);
assert.equal(hardProgress.completed, true);
assert.equal(hardProgress.consumed, 4140);
assert.deepEqual(hardProgress.errors, []);
assert.equal(
  JSON.parse(await load(manifest.artifacts["hard-browser-events"].path)).length,
  4140,
);
const hardBrowser = JSON.parse(
  await load(manifest.artifacts["hard-browser-checkpoints"].path),
);
assert.equal(hardBrowser.length, 28);
for (let i = 0; i < 28; i++)
  for (const k of ["name", "stateSha256", "pixelsSha256"])
    assert.equal(
      hardBrowser[i][k],
      hard.browserCheckpoints[i][k],
      `Hard regression checkpoint${i} ${k}`,
    );
const root = officeEdition
  ? ".local/office-jungle-treasure-verification"
  : ".local/security-jungle-treasure-verification";
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
assert.equal(result.consumed, 70);
assert.equal(result.checked, 27);
assert.equal(result.rendered, 74);
assert.equal(result.flagAliasPresentations, 0);
assert.deepEqual(result.heldAtExploratoryEndpoint, []);
assert.deepEqual(
  {
    money: result.state.money,
    day: result.state.campaign.day,
    playerCollected: result.state.campaign.playerCollected,
    frames: result.state.jungle.frames,
    presentations: result.state.jungle.presentations,
    lives: result.state.jungle.lives,
    seed: result.state.jungle.seed,
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
  "Jungle treasure:27 exact carried Game and independent browser state/pixel checkpoints,all70 DOM events,860 jungle samples,1050 dollars/one life;5 comparison negatives. Shared adapter retains all28 Hard browser checkpoints. Port evidence,not native whole-level timing parity.",
);
