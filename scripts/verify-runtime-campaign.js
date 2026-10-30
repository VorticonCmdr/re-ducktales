// Current runtime acceptance. Default validates the source-pinned complete
// browser receipt; --fresh-browser additionally repeats the actual full route.
import assert from "node:assert/strict";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const manifest =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/bios-clock-campaign.json";
const m = JSON.parse(await readFile(manifest));
const biosRuntime = m.id === "bios-clock-easy-complete-campaign";
const mountainPhase =
  biosRuntime || m.id === "mountain-phase-easy-complete-campaign";
const textTiming =
  mountainPhase || m.id === "jungle-text-easy-complete-campaign";
const expectedUnits = biosRuntime ? 194 : mountainPhase ? 186 : 180;
if (mountainPhase) assert.equal(m.expectedUnitCases, expectedUnits);
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
run(process.execPath, [
  "scripts/verify-cave-reveal.js",
  ...(biosRuntime ? ["--manifest=reference/bios-clock-cave-reveal.json"] : []),
]);
run(process.execPath, ["scripts/verify-speaker-engine.js"]);
run(process.execPath, [
  "scripts/verify-speaker-playback-receipt.js",
  biosRuntime
    ? "--manifest=reference/bios-clock-speaker-playback.json"
    : "--manifest=reference/speaker-playback-current.json",
]);
if (textTiming) {
  run(process.execPath, ["scripts/verify-ega-text.js"]);
  const native = JSON.parse(await readFile("reference/ega-text-native.json"));
  const inputs = JSON.parse(await readFile(native.artifacts.inputs.path));
  assert.equal(inputs.cases.length, 14);
  const { egaTransparentTextWork } =
    await import("../src/game/ega-text-work.js");
  for (let i = 0; i < 14; i++) {
    const spec = native.artifacts["case-" + String(i).padStart(2, "0")];
    const expected = JSON.parse(await readFile(spec.path)),
      trace = [];
    const work = egaTransparentTextWork(inputs.cases[i], {
      instruction: (ip) => trace.push(ip),
    });
    assert.deepEqual(trace, expected.trace, "Current runtime native text path");
    assert.equal(work.instructions, expected.trace.length);
    assert.equal(work.portWrites, expected.ports.length);
  }
}
if (m.completeSourceInventory)
  run(process.execPath, [
    textTiming
      ? "scripts/jungle-text-timing.js"
      : "scripts/jungle-line-timing.js",
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
assert.match(unit, new RegExp(`# tests ${expectedUnits}\\b`));
assert.match(unit, new RegExp(`# pass ${expectedUnits}\\b`));
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
if (m.completeSourceInventory) {
  const root = `.local/current-jungle-lines-${Date.now()}`;
  await mkdir(root, { recursive: true });
  run(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/browser/jungle-line-input.spec.js",
      "--config",
      "playwright.campaign.config.js",
      `--output=${root}/browser`,
      "--reporter=list,json",
    ],
    { PLAYWRIGHT_JSON_OUTPUT_FILE: `${root}/browser.json` },
  );
  const report = JSON.parse(await readFile(`${root}/browser.json`)),
    cases = [];
  function visit(s) {
    for (const p of s.specs ?? []) cases.push(...p.tests);
    for (const c of s.suites ?? []) visit(c);
  }
  for (const s of report.suites) visit(s);
  assert.deepEqual(report.errors, []);
  assert.equal(cases.length, 1, "Missing jungle browser case");
  assert.equal(cases[0].expectedStatus, "passed");
  assert.equal(cases[0].results.length, 1);
  assert.equal(
    cases[0].results[0].status,
    "passed",
    "Skipped or unfinished jungle browser case",
  );
}
run(process.execPath, [
  "scripts/verify-current-campaign-browser-negative.js",
  `--manifest=${manifest}`,
]);
if (m.completeSourceInventory)
  run(process.execPath, ["scripts/verify-jungle-line-browser-negative.js"]);
if (textTiming)
  run(process.execPath, ["scripts/verify-jungle-text-browser-negative.js"]);
if (mountainPhase)
  run(process.execPath, [
    "scripts/verify-mountain-phase-integration.js",
    ...(biosRuntime ? ["--bios-clock"] : []),
  ]);
if (biosRuntime)
  run(process.execPath, ["scripts/verify-bios-clock-integration.js"]);
run("npm", ["run", "build"]);
console.log(
  `Current runtime gate passed:22 originals,${expectedUnits} units,${m.expectedCheckpointCount} carried state/pixel checkpoints,${m.requiredEventCount} independent DOM events,9 campaign negatives,7 cave controls and registered7-case actual sound acceptance${m.completeSourceInventory ? `,17 jungle component controls and actual jungle deadline negative${textTiming ? " and omitted-text-work negative" : ""}` : ""}. Full Hard and native whole-game timing remain unproven.`,
);
