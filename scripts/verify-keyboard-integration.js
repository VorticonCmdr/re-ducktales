// Historical complete-run receipt. A fresh npm run verify remains the gate.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing keyboard integration receipt ${p};see docs/STATUS.md`,
    );
  });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(
  await required("reference/keyboard-integration.json"),
);
assert.equal(manifest.completed, true);
assert.equal(manifest.exitCode, 0);
assert.equal(manifest.command, "npm run verify");
assert.equal(manifest.unitCases, 117);
assert.equal(manifest.developmentBrowserCases, 91);
assert.equal(manifest.productionBrowserCases, 2);
assert.equal(manifest.skips, 0);
assert.equal(manifest.sourceFileCount, 529);
assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
assert.equal(
  sha(await required(manifest.buildManifest)),
  manifest.buildManifestSha256,
);
const roles = [
  "verify.log",
  "runner-status.json",
  "source-revision.json",
  "browser-collection.json",
  "development-status.json",
  "production-status.json",
  "collection-repair.json",
];
assert.deepEqual(Object.keys(manifest.artifacts).sort(), roles.toSorted());
for (const role of roles) {
  const a = manifest.artifacts[role],
    b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${role}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${role}`);
}
const load = (role) => required(manifest.artifacts[role].path);
const json = async (role) => JSON.parse(await load(role));
const runner = await json("runner-status.json");
assert.deepEqual(runner.command, ["npm", "run", "verify"]);
assert.equal(runner.exitCode, 0);
assert.equal(runner.sourceCommit, manifest.sourceCommit);
assert.ok(
  Number.isFinite(Date.parse(runner.startedAt)) &&
    Date.parse(runner.finishedAt) >= Date.parse(runner.startedAt),
);
for (const role of ["development-status.json", "production-status.json"])
  assert.deepEqual(await json(role), { status: "passed", failedTests: [] });
const repair = await json("collection-repair.json");
assert.equal(repair.sourceCommit, manifest.sourceCommit);
assert.equal(repair.source, ".local/production-browser-results");
assert.deepEqual(repair.productionStatus, {
  status: "passed",
  failedTests: [],
});
assert.ok(Date.parse(repair.collectedAt) >= Date.parse(runner.finishedAt));
const source = await json("source-revision.json");
assert.equal(source.commit, manifest.sourceCommit);
assert.equal(Object.keys(source.files).length, 529);
const tree = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", source.commit],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();
assert.deepEqual(
  Object.keys(source.files).sort(),
  tree,
  "Source archive omitted tracked files",
);
const root = manifest.artifacts["source-revision.json"].path.replace(
  /\/source-revision\.json$/,
  "",
);
for (const [p, h] of Object.entries(source.files)) {
  assert.ok(!p.startsWith("/") && !p.split("/").includes(".."));
  assert.equal(
    sha(await required(`${root}/sources/${p}`)),
    h,
    `Archived source ${p}`,
  );
  assert.equal(
    sha(execFileSync("git", ["show", `${source.commit}:${p}`])),
    h,
    `Git source ${p}`,
  );
}
const collection = await json("browser-collection.json");
assert.deepEqual(collection.errors, []);
// --list marks planned cases skipped;this is inventory,not an execution receipt.
assert.equal(collection.stats.expected, 0);
assert.equal(collection.stats.skipped, 91);
const planned = [];
function visit(s) {
  for (const spec of s.specs ?? []) {
    assert.equal(spec.tests.length, 1);
    planned.push(`${spec.file}:${spec.line}:${spec.column} › ${spec.title}`);
  }
  for (const child of s.suites ?? []) visit(child);
}
collection.suites.forEach(visit);
assert.equal(planned.length, 91);
const markers = [
  "Current runtime regression:seven actual browser cases",
  "Shared runtime fixture controls:",
  "Ordinary keyboard browser receipt:7 actual office/investment/trading cases",
  "Map ordinary keys:36 original input/128-flag/pointer comparisons",
  "Map keyboard fixture controls:",
  "Opening: 3 closed-loop cases, 33 exact original PNGs",
  "Office investment departure:7 exact native pictures",
  "Office menu:29 exact native and browser pictures,63 original input values",
  "Tandy corpus: 121 independently initialized requests",
  "Easy campaign: 36 exact",
  "Hard alternates:4 complete treasure/bank routes,169 exact",
  "Hard campaign: 28 exact",
  "Hard browser negative control:",
  "Difficulty browser negative:",
  "Office browser negative:",
  "Security browser negative:",
];
function checkLog(log) {
  for (const text of ["ℹ tests 117", "ℹ pass 117", "ℹ fail 0", "ℹ skipped 0"])
    assert.ok(log.includes(text), `Missing unit outcome ${text}`);
  assert.match(log, /^  91 passed /m);
  assert.match(log, /^  2 passed /m);
  assert.doesNotMatch(log, /^\s*(?:\d+ (?:failed|skipped|flaky)|✘)/m);
  const dev = [
    ...log.matchAll(/^  ✓\s+(\d+) tests\/browser\/(.+) \([^\n]*\)$/gm),
  ];
  assert.equal(dev.length, 91, "Missing or duplicate browser result");
  assert.deepEqual(
    dev.map((x) => Number(x[1])),
    Array.from({ length: 91 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    dev.map((x) => x[2]),
    planned,
    "Executed browser cases differ from collection",
  );
  const prod = [
    ...log.matchAll(
      /^  ✓\s+(\d+) tests\/production\/([^:]+):\d+:\d+ › (.+) \([^\n]*\)$/gm,
    ),
  ];
  assert.deepEqual(
    prod.map((x) => [Number(x[1]), x[2], x[3]]),
    [
      [
        1,
        "tandy-game.spec.js",
        "production game loads originals and plays, mutes and closes its persistent Tandy device",
      ],
      [
        2,
        "tandy-live.spec.js",
        "production worklet loads with original folder files,plays and stops",
      ],
    ],
  );
  for (const marker of markers)
    assert.ok(log.includes(marker), `Missing required segment ${marker}`);
}
const log = (await load("verify.log")).toString();
checkLog(log);
assert.throws(() =>
  checkLog(log.replace(/^  ✓\s+\d+ tests\/browser\/.*\n/m, "")),
);
assert.throws(() => checkLog(log.replace("ℹ pass 117", "ℹ pass 116")));
assert.throws(() => checkLog(log.replace("  91 passed ", "  90 passed ")));
assert.throws(() => checkLog(`${log}\n  1 skipped\n`));
assert.throws(() =>
  checkLog(
    log.replace("Security browser negative:", "Missing security negative:"),
  ),
);
assert.throws(() =>
  checkLog(
    log.replace(
      "tests/browser/hard-entry-replay.spec.js",
      "tests/browser/missing-entry.spec.js",
    ),
  ),
);
assert.throws(() =>
  checkLog(
    log.replace(
      "production worklet loads with original folder files,plays and stops",
      "production case omitted",
    ),
  ),
);
console.log(
  "Keyboard integration receipt:117 unit/91 development/2 production cases,zero skips,529 exact archived sources;7 damaged-report controls rejected. Historical complete run,not whole-game/native parity or fresh acceptance.",
);
