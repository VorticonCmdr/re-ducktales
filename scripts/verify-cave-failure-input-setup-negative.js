import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { sha } from "./lib/local-scenario-source.js";
const m = JSON.parse(await readFile("reference/cave-failure-input-browser.json"));
const root = await mkdtemp(join(tmpdir(), "cave-failure-negative-")), checks = [];
try {
  for (const kind of ["zero-checkpoints", "missing-fixture", "corrupt-fixture"]) {
    const copy = structuredClone(m);
    if (kind === "zero-checkpoints") {
      const bytes = "[]\n", path = join(root, "empty.json");
      await writeFile(path, bytes);
      copy.expectedCheckpointCount = 0;
      copy.artifacts["campaign-checkpoints"] = { path, bytes: Buffer.byteLength(bytes), sha256: sha(bytes) };
    }
    if (kind === "missing-fixture") copy.artifacts.environment.path = join(root, "missing.json");
    if (kind === "corrupt-fixture") copy.artifacts.environment.sha256 = "0".repeat(64);
    const path = join(root, kind + ".json"); await writeFile(path, JSON.stringify(copy));
    let failure;
    try { execFileSync(process.execPath, ["scripts/verify-cave-failure-input-browser.js", "--manifest=" + path], { stdio: "pipe" }); }
    catch (error) { failure = error; }
    assert.ok(failure && failure.status !== 0, kind + " incorrectly succeeded");
    assert.match(String(failure.stderr), kind === "zero-checkpoints" ? /Zero cases/ :
      kind === "missing-fixture" ? /ENOENT/ : /Corrupt scenario fixture/);
    checks.push({ kind, rejected: true, exitCode: failure.status });
  }
  assert.equal(checks.length, 3);
  console.log(JSON.stringify({ completed: true, checks }));
} finally { await rm(root, { recursive: true, force: true }); }
