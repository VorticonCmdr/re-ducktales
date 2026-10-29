// Retained focused execution receipt; npm run test:browser executes fresh cases.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (p) =>
  readFile(p).catch(() => {
    throw Error(
      `SETUP: missing keyboard browser evidence ${p};see docs/ordinary-keyboard.md`,
    );
  });
const m = JSON.parse(
  await required("reference/ordinary-keyboard-browser.json"),
);
assert.equal(m.completed, true);
assert.equal(m.expectedCaseCount, 7);
assert.equal(m.sourceFileCount, 523);
assert.equal(Object.keys(m.artifacts).length, 84);
for (const [role, a] of Object.entries(m.artifacts)) {
  const b = await required(a.path);
  assert.equal(b.length, a.bytes, `Truncated ${role}`);
  assert.equal(sha(b), a.sha256, `Corrupt ${role}`);
}
const load = (role) => required(m.artifacts[role].path);
const json = async (role) => JSON.parse(await load(role));
const source = await json("positive/source-revision.json");
assert.equal(source.sourceCommit, m.sourceCommit);
assert.equal(Object.keys(source.files).length, 523);
assert.deepEqual(
  Object.keys(source.files).sort(),
  execFileSync("git", ["ls-tree", "-r", "--name-only", m.sourceCommit], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .sort(),
);
for (const [p, h] of Object.entries(source.files)) {
  assert.ok(!p.startsWith("/") && !p.split("/").includes(".."));
  assert.equal(
    sha(await required(`${m.sourceArchive}/${p}`)),
    h,
    `Archived ${p}`,
  );
  assert.equal(
    sha(execFileSync("git", ["show", `${m.sourceCommit}:${p}`])),
    h,
    `Git ${p}`,
  );
  // Metadata may advance; the actual runtime and tested input paths must match.
  if (
    p.startsWith("src/") ||
    p.startsWith("tests/browser/") ||
    ["index.html", "vite.config.js", "playwright.config.js"].includes(p)
  )
    assert.equal(
      sha(await required(p)),
      h,
      `Runtime changed since keyboard browser acceptance ${p}`,
    );
}
const titles = [
  "calendar travel produces company news and acknowledged bulletins stay consumed",
  "original assets, earned cash, stock transactions, held Fire limit, office return and restart",
  "original investment departure pictures, queued input flush, Tandy cues and restart use real controls",
  "office entry bands, labels and63 original key polls use real browser controls",
  "office defers reveal keys until its reader and flushes held controls after pause",
  "original office door pictures lead through a real dive, reward and restart",
  "office door sound requests reach the persistent Tandy device in original order",
];
function checkReport(report) {
  assert.deepEqual(report.errors, []);
  assert.equal(report.stats.expected, 7);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(report.stats[k], 0);
  const found = [];
  function visit(s) {
    for (const spec of s.specs ?? []) {
      assert.equal(spec.ok, true);
      assert.equal(spec.tests.length, 1);
      const test = spec.tests[0];
      assert.equal(test.status, "expected");
      assert.equal(test.results.length, 1);
      assert.equal(test.results[0].status, "passed");
      assert.equal(test.results[0].retry, 0);
      found.push({ file: spec.file, title: spec.title });
    }
    for (const child of s.suites ?? []) visit(child);
  }
  report.suites.forEach(visit);
  assert.deepEqual(
    found.map((c) => c.title),
    titles,
  );
  assert.deepEqual(found, m.expectedCases);
}
const report = await json("positive/browser-results.json");
checkReport(report);
assert.deepEqual(await json("positive/browser/.last-run.json"), {
  status: "passed",
  failedTests: [],
});
for (const [prefix, exit] of [
  ["positive", 0],
  ["negative", 1],
]) {
  const r = await json(`${prefix}/runner-status.json`);
  assert.equal(r.sourceCommit, m.sourceCommit);
  assert.equal(r.status, "finished");
  assert.equal(r.exitCode, exit);
  assert.ok(Date.parse(r.finishedAt) >= Date.parse(r.startedAt));
}
assert.deepEqual((await json("negative/runner-status.json")).environment, {
  DUCKTALES_OFFICE_MENU_NEGATIVE: "omit-right-chord",
});
const negative = (await load("negative/browser.log")).toString();
assert.match(negative, /up-right-make/);
assert.match(negative, /Expected:\s*3/);
assert.match(negative, /Received:\s*1/);
assert.match(negative, /1 failed/);
assert.doesNotMatch(
  negative,
  /SETUP:|No tests found|Test timeout|TimeoutError|browserType\.launch:|Test was interrupted|ETIMEDOUT|Channel closed/,
);
const nr = await json("negative/browser-results.json");
assert.deepEqual(nr.errors, []);
assert.equal(nr.stats.unexpected, 1);
for (const k of ["expected", "skipped", "flaky"]) assert.equal(nr.stats[k], 0);
for (const alter of [
  (r) => {
    r.stats.skipped = 1;
  },
  (r) => {
    r.suites.pop();
  },
  (r) => {
    r.stats.expected = 0;
  },
  (r) => {
    r.suites[0].specs[0].tests[0].results[0].status = "failed";
  },
]) {
  const broken = structuredClone(report);
  alter(broken);
  assert.throws(() => checkReport(broken));
}
console.log(
  "Ordinary keyboard browser receipt:7 actual office/investment/trading cases,523 exact sources,missing real chord rejected;4 damaged-report controls. Focused retained acceptance,not original aliases or map timing parity.",
);
