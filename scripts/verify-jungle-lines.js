// Strict focused current-source acceptance. Default repeats both long component
// scenarios and actual browser controls; no cached report substitutes for a run.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "SETUP: use clean committed integration source",
);
const root = `.local/jungle-line-integration-${Date.now()}`;
await mkdir(root, { recursive: true });
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const archive = execFileSync("git", ["archive", "--format=zip", revision], {
  maxBuffer: 32 * 1024 * 1024,
});
await writeFile(`${root}/sources.zip`, archive);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const sources = Object.fromEntries(
  await Promise.all(tracked.map(async (p) => [p, sha(await readFile(p))])),
);
await writeFile(
  `${root}/source-revision.json`,
  JSON.stringify(
    { commit: revision, archiveSHA256: sha(archive), files: sources },
    null,
    2,
  ) + "\n",
);
const protectedFiles = {};
for (const p of await readdir("reference"))
  if (p.endsWith(".json"))
    protectedFiles[`reference/${p}`] = sha(await readFile(`reference/${p}`));
for (const name of ["ega-line-runtime-work", "jungle-presentation"]) {
  const m = JSON.parse(await readFile(`reference/${name}.json`));
  for (const spec of Object.values(m.artifacts))
    protectedFiles[spec.path] = sha(await readFile(spec.path));
}
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith("DUCKTALES_")),
);
let log = "";
async function run(command, args, extra = {}) {
  const r = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 600000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...env, ...extra },
  });
  const output = (r.stdout ?? "") + (r.stderr ?? "");
  log += output;
  process.stdout.write(output);
  await writeFile(`${root}/verification.log`, log);
  assert.ifError(r.error);
  assert.equal(
    r.status,
    0,
    `Required check failed: ${command} ${args.join(" ")}`,
  );
  return output;
}
const status = {
  completed: false,
  sourceCommit: revision,
  sourceFileCount: tracked.length,
  protectedFiles,
  scope:
    "Line-inclusive jungle component and actual-browser acceptance;not a fresh complete campaign or original whole-level timing proof.",
};
try {
  await run(process.execPath, ["scripts/jungle-line-timing.js"]);
  const files = (await readdir("tests"))
    .filter((p) => p.endsWith(".test.js"))
    .sort()
    .map((p) => `tests/${p}`);
  const unit = await run(process.execPath, [
    "--test",
    "--test-reporter=tap",
    ...files,
  ]);
  for (const regex of [
    /# tests 180\b/,
    /# pass 180\b/,
    /# fail 0\b/,
    /# skipped 0\b/,
  ])
    assert.match(unit, regex);
  await run(
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
  assert.equal(cases.length, 1, "Missing browser case");
  assert.equal(cases[0].expectedStatus, "passed");
  assert.equal(cases[0].results.length, 1, "Unexpected browser retry");
  assert.equal(
    cases[0].results[0].status,
    "passed",
    "Unfinished/skipped browser case",
  );
  await run(process.execPath, [
    "scripts/verify-jungle-line-browser-negative.js",
  ]);
  await run("npm", ["run", "build"]);
  for (const [p, h] of Object.entries(sources))
    assert.equal(sha(await readFile(p)), h, `Integration source changed ${p}`);
  for (const [p, h] of Object.entries(protectedFiles))
    assert.equal(sha(await readFile(p)), h, `Historical evidence changed ${p}`);
  status.completed = true;
  status.checks = {
    units: 180,
    componentInputs: 1616,
    componentImages: 1714,
    componentCheckpoints: 40,
    componentNegatives: 17,
    drawingBoundaries: 6,
    lineCalls: 60,
    drawingNegatives: 3,
    nativePrimitiveCases: 32,
    nativePrimitiveNegatives: 6,
    browserCases: 1,
    browserNegativeControls: 1,
    build: true,
  };
  console.log(`Jungle line integration passed;receipt:${root}/status.json`);
} finally {
  await writeFile(
    `${root}/status.json`,
    JSON.stringify(status, null, 2) + "\n",
  );
}
