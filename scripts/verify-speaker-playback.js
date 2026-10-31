// Strict focused acceptance. Proprietary originals/captures remain local.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = `.local/speaker-playback-${Date.now()}`;
await mkdir(root, { recursive: true });
const sources = [
  ...new Set([
    "src/speaker-driver.js",
    "src/speaker-game.js",
    "src/speaker-game-worklet.js",
    "src/game/audio-device.js",
    "src/game/speaker-audio.js",
    "src/game/tandy-audio.js",
    "src/game/browser.js",
    "tests/speaker-game.test.js",
    "tests/browser/tandy-game.spec.js",
    "tests/browser/title-audio.spec.js",
    "scripts/verify-speaker-playback.js",
    "reference/build.json",
    "reference/speaker-engine.json",
    ...(await readdir("src", { recursive: true, withFileTypes: true }))
      .filter((d) => d.isFile())
      .map((d) => `${d.parentPath}/${d.name}`),
  ]),
].sort();
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "SETUP: commit clean sound capture source",
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const archive = execFileSync("git", ["archive", "--format=zip", commit], {
  maxBuffer: 32 * 1024 * 1024,
});
await writeFile(root + "/sources.zip", archive);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const inventory = Object.fromEntries(
  await Promise.all(tracked.map(async (p) => [p, sha(await readFile(p))])),
);
await writeFile(
  root + "/source-revision.json",
  JSON.stringify(
    { commit, archiveSha256: sha(archive), files: inventory },
    null,
    2,
  ) + "\n",
);
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(sources.map(async (p) => [p, sha(await readFile(p))])),
  );
const initial = await hashes();
await writeFile(
  `${root}/sources.json`,
  JSON.stringify(initial, null, 2) + "\n",
);
function run(command, args, env = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  const output = (r.stdout ?? "") + (r.stderr ?? "");
  process.stdout.write(output);
  assert.ifError(r.error);
  assert.equal(
    r.status,
    0,
    `Required check failed: ${command} ${args.join(" ")}`,
  );
  return output;
}
run(process.execPath, ["scripts/verify-speaker-engine.js"]);
run(process.execPath, ["scripts/verify-speaker-note-gate.js"]);
run(process.execPath, ["scripts/verify-tandy-engine.js"]);
run(process.execPath, ["scripts/verify-tandy-game.js"]);
const unit = run(process.execPath, [
  "--test",
  "--test-reporter=tap",
  "tests/speaker-game.test.js",
]);
assert.match(unit, /# tests 3\b/);
assert.match(unit, /# pass 3\b/);
assert.match(unit, /# fail 0\b/);
assert.match(unit, /# skipped 0\b/);
run(
  "npx",
  [
    "playwright",
    "test",
    "tests/browser/tandy-game.spec.js",
    "tests/browser/title-audio.spec.js",
    "--config",
    "playwright.campaign.config.js",
    `--output=${root}/browser`,
    "--reporter=list,json",
  ],
  { PLAYWRIGHT_JSON_OUTPUT_FILE: `${root}/browser.json` },
);
const report = JSON.parse(await readFile(`${root}/browser.json`));
const cases = [];
function visit(suite) {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests) cases.push(t);
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites) visit(suite);
function checkBrowser(cases, errors) {
  assert.equal(cases.length, 7, "Missing or zero browser cases");
  assert.deepEqual(errors, []);
  for (const t of cases) {
    assert.equal(t.expectedStatus, "passed");
    assert.equal(
      t.results.length,
      1,
      "Unexpected retry or unfinished browser case",
    );
    assert.equal(t.results[0].status, "passed", "Skipped/failed browser case");
  }
}
checkBrowser(cases, report.errors);
// Acceptance-checker negative controls never alter authoritative reports.
assert.throws(() => checkBrowser([], []), /Missing or zero/);
const skipped = structuredClone(cases);
skipped[0].results[0].status = "skipped";
assert.throws(() => checkBrowser(skipped, []), /Skipped/);
const unfinished = structuredClone(cases);
unfinished[0].results = [];
assert.throws(() => checkBrowser(unfinished, []), /unfinished/);
run("npm", ["run", "build"]);
assert.deepEqual(await hashes(), initial, "Source changed during acceptance");
for (const [p, h] of Object.entries(inventory))
  assert.equal(sha(await readFile(p)), h, "Archived sound source changed " + p);
await writeFile(
  `${root}/receipt.json`,
  JSON.stringify(
    {
      completed: true,
      sources: "sources.json",
      browser: "browser.json",
      streamCases: 3,
      noteGateCases: 3,
      browserCases: 7,
      reportNegativeControls: 3,
      sourceCommit: commit,
      completeSourceInventory: true,
      scope:
        "Native conditional core evidence plus independent provider regression and actual browser audio acceptance. No full campaign or original waveform claim.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `PC-speaker playback acceptance passed; receipt: ${root}/receipt.json`,
);
