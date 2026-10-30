// Current runtime acceptance. Default validates the source-pinned complete
// browser receipt; --fresh-browser additionally repeats the actual full route.
import assert from "node:assert/strict";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const manifest = "reference/speaker-runtime-campaign.json";
const m = JSON.parse(await readFile(manifest));
function run(command, args, extra = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 660000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, ...extra },
  });
  process.stdout.write((r.stdout ?? "") + (r.stderr ?? ""));
  assert.ifError(r.error);
  assert.equal(
    r.status,
    0,
    `Required check failed: ${command} ${args.join(" ")}`,
  );
  return r.stdout ?? "";
}
run("npm", ["run", "verify:build"]);
run(process.execPath, ["scripts/verify-cave-reveal.js"]);
run(process.execPath, ["scripts/verify-speaker-engine.js"]);
run(process.execPath, [
  "scripts/verify-speaker-playback-receipt.js",
  "--manifest=reference/speaker-playback-current.json",
]);
run(process.execPath, [
  "scripts/verify-current-campaign-fixtures.js",
  `--manifest=${manifest}`,
]);
run(process.execPath, [
  "scripts/verify-current-campaign.js",
  `--manifest=${manifest}`,
]);
const unitFiles = (await readdir("tests"))
  .filter((p) => p.endsWith(".test.js"))
  .sort()
  .map((p) => `tests/${p}`);
const unit = run(process.execPath, [
  "--test",
  "--test-reporter=tap",
  ...unitFiles,
]);
assert.match(unit, /# tests 180\b/);
assert.match(unit, /# pass 180\b/);
assert.match(unit, /# fail 0\b/);
assert.match(unit, /# skipped 0\b/);
let browserRoot = m.browserReplayRoot;
if (process.argv.includes("--fresh-browser")) {
  browserRoot = `.local/runtime-campaign-fresh-${Date.now()}`;
  await mkdir(browserRoot, { recursive: true });
  run(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/mixed-campaign.spec.js",
      "--config",
      "playwright.campaign.config.js",
      `--output=${browserRoot}`,
    ],
    { DUCKTALES_EASY_CAMPAIGN_MANIFEST: manifest },
  );
}
run(process.execPath, [
  "scripts/verify-current-campaign.js",
  `--manifest=${manifest}`,
  `--browser=${browserRoot}`,
]);
run(process.execPath, [
  "scripts/verify-current-campaign-browser-negative.js",
  `--manifest=${manifest}`,
]);
run("npm", ["run", "build"]);
console.log(
  "Current runtime gate passed:22 originals,180 units,34 carried state/pixel checkpoints,4981 independent DOM events,9 campaign negatives,7 cave controls and registered 7-case actual sound acceptance. Full Hard and native whole-game timing remain unproven.",
);
