import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(
  await readFile("reference/sound-toggle-acceptance.json"),
);
const root = await mkdtemp(join(tmpdir(), "sound-toggle-negative-")),
  checks = [];
try {
  for (const kind of ["zero-cases", "missing-fixture", "corrupt-fixture"]) {
    const m = structuredClone(manifest);
    if (kind === "zero-cases") m.cases = [];
    if (kind === "missing-fixture")
      m.cases[0].result.path = join(root, "missing.json");
    if (kind === "corrupt-fixture") m.cases[0].result.sha256 = "0".repeat(64);
    const path = join(root, kind + ".json");
    await writeFile(path, JSON.stringify(m));
    let failure;
    try {
      execFileSync(
        process.execPath,
        ["scripts/verify-sound-toggle-acceptance.js", "--manifest=" + path],
        { stdio: "pipe" },
      );
    } catch (error) {
      failure = error;
    }
    assert.ok(failure && failure.status !== 0, kind + " incorrectly succeeded");
    assert.match(
      String(failure.stderr),
      kind === "zero-cases"
        ? /Zero sound-toggle cases/
        : kind === "missing-fixture"
          ? /ENOENT|SETUP: missing/
          : /Corrupt scenario fixture/,
    );
    checks.push({ kind, rejected: true, exitCode: failure.status });
  }
  assert.equal(checks.length, 3);
  console.log(JSON.stringify({ completed: true, checks }));
} finally {
  await rm(root, { recursive: true, force: true });
}
