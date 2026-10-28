// Historical acceptance receipt validation, not a fresh browser execution.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
export async function verifyBrowserIntegrationReceipts(
  manifest,
  { cases, sources, artifacts },
) {
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(manifest.expectedSourceCount, sources);
  assert.equal(manifest.artifacts.length, artifacts);
  for (const artifact of manifest.artifacts) {
    const bytes = await readFile(artifact.path).catch(() => {
      throw Error(
        `SETUP: missing browser acceptance artifact ${artifact.path}`,
      );
    });
    assert.equal(bytes.length, artifact.bytes, artifact.path);
    assert.equal(hash(bytes), artifact.sha256, `Corrupt ${artifact.path}`);
  }
  const source = JSON.parse(await readFile(manifest.sourceRecord));
  assert.equal(source.integrationCommit, manifest.integrationCommit);
  assert.equal(Object.keys(source.sha256).length, manifest.expectedSourceCount);
  for (const [path, expected] of Object.entries(source.sha256)) {
    assert.equal(
      hash(await readFile(`${manifest.sourceRoot}/${path}`)),
      expected,
      path,
    );
    assert.equal(
      hash(
        execFileSync("git", ["show", `${manifest.integrationCommit}:${path}`]),
      ),
      expected,
      path,
    );
  }
  function check(report) {
    assert.deepEqual(report.errors, []);
    assert.equal(report.stats.expected, cases);
    assert.equal(report.stats.expected, manifest.expectedCaseCount);
    for (const key of ["skipped", "unexpected", "flaky"])
      assert.equal(report.stats[key], 0, key);
    const tests = [];
    function visit(suite) {
      for (const spec of suite.specs ?? []) tests.push(...spec.tests);
      for (const child of suite.suites ?? []) visit(child);
    }
    for (const suite of report.suites) visit(suite);
    assert.equal(tests.length, cases);
    for (const test of tests) {
      assert.equal(test.status, "expected");
      assert.equal(test.results.length, 1, "Unexpected retry");
      assert.equal(test.results[0].status, "passed");
    }
  }
  const report = JSON.parse(await readFile(manifest.results));
  check(report);
  const skipped = structuredClone(report);
  skipped.stats.expected--;
  skipped.stats.skipped++;
  assert.throws(() => check(skipped));
  const failed = structuredClone(report);
  failed.suites[0].specs[0].tests[0].results[0].status = "failed";
  assert.throws(() => check(failed));
  console.log(
    `Retained browser acceptance at${manifest.integrationCommit}:${cases} passed, zero skipped/retried,${sources} exact archived/committed sources;2 receipt negatives rejected. Fresh browser execution is separate.`,
  );
}
