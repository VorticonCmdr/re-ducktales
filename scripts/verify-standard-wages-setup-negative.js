import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Alter temporary contracts only; producer fixtures and expected outputs remain
// immutable. These must fail before a browser or an output archive is created.
const manifest = JSON.parse(await readFile("reference/standard-wages-route.json"));
const temporary = await mkdtemp(join(tmpdir(), "standard-wages-negative-"));
const results = [];
try {
  for (const kind of ["zero-checkpoints", "missing-fixture", "corrupt-fixture"]) {
    const changed = structuredClone(manifest);
    if (kind === "zero-checkpoints") {
      changed.expectedCheckpointCount = 0;
      const path = join(temporary, "empty-checkpoints.json"), bytes = "[]\n";
      await writeFile(path, bytes);
      changed.artifacts["campaign-checkpoints"] = { path, bytes: Buffer.byteLength(bytes),
        sha256: createHash("sha256").update(bytes).digest("hex") };
    }
    if (kind === "missing-fixture") changed.artifacts.environment.path = join(temporary, "missing.json");
    if (kind === "corrupt-fixture") changed.artifacts.environment.sha256 = "0".repeat(64);
    const path = join(temporary, kind + ".json");
    await writeFile(path, JSON.stringify(changed));
    let failure;
    try {
      execFileSync(process.execPath, ["scripts/verify-standard-wages-route.js", "--manifest=" + path], { stdio: "pipe" });
    } catch (error) { failure = error; }
    assert.ok(failure && failure.status !== 0, kind + " incorrectly succeeded");
    assert.match(String(failure.stderr), kind === "zero-checkpoints" ? /Zero cases/ :
      kind === "missing-fixture" ? /ENOENT|missing/ : /Corrupt scenario fixture/);
    results.push({ kind, rejected: true, exitCode: failure.status });
  }
  assert.equal(results.length, 3);
  console.log(JSON.stringify({ completed: true, checks: results }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
