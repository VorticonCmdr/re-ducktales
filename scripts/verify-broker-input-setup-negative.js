import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(
  await readFile("reference/broker-input-browser.json"),
);
const root = await mkdtemp(join(tmpdir(), "broker-input-negative-"));
const checks = [];
try {
  for (const kind of ["zero-cases", "missing-fixture", "corrupt-fixture"]) {
    const copy = structuredClone(manifest);
    if (kind === "zero-cases") copy.cases = [];
    if (kind === "missing-fixture")
      copy.cases[0].artifacts.environment.path = join(root, "missing.json");
    if (kind === "corrupt-fixture")
      copy.cases[0].artifacts.environment.sha256 = "0".repeat(64);
    const path = join(root, kind + ".json");
    await writeFile(path, JSON.stringify(copy));
    let failure;
    try {
      execFileSync(
        process.execPath,
        ["scripts/verify-broker-control-route.js", "--manifest=" + path],
        { stdio: "pipe" },
      );
    } catch (error) {
      failure = error;
    }
    assert.ok(failure && failure.status !== 0, kind + " incorrectly succeeded");
    assert.match(
      String(failure.stderr),
      kind === "zero-cases"
        ? /Zero broker cases/
        : kind === "missing-fixture"
          ? /ENOENT/
          : /Corrupt scenario fixture/,
    );
    checks.push({ kind, rejected: true, exitCode: failure.status });
  }
  assert.equal(checks.length, 3);
  console.log(JSON.stringify({ completed: true, checks }));
} finally {
  await rm(root, { recursive: true, force: true });
}
