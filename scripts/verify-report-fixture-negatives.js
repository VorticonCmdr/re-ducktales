import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { json, spec } from "./lib/local-scenario-source.js";
const path = process.argv.find((a) => a.startsWith("--manifest="))?.slice(11);
assert.ok(path, "Supply report browser manifest");
const m = await json(path),
  root = await mkdtemp(join(tmpdir(), "report-fixture-negative-")),
  checks = [];
try {
  for (const kind of [
    "zero-checkpoints",
    "missing-fixture",
    "corrupt-fixture",
    "missing-checkpoint",
    "unconsumed-event",
  ]) {
    const changed = structuredClone(m);
    if (kind === "zero-checkpoints") changed.expectedCheckpointCount = 0;
    if (kind === "missing-fixture")
      changed.artifacts["environment.json"].path = join(root, "absent.json");
    if (kind === "corrupt-fixture")
      changed.artifacts["environment.json"].sha256 = "0".repeat(64);
    if (kind === "missing-checkpoint") changed.expectedCheckpointCount++;
    if (kind === "unconsumed-event") {
      const points = await json(
        changed.artifacts["campaign-checkpoints.json"].path,
      );
      points.at(-1).eventCount--;
      const p = join(root, "points.json");
      await writeFile(p, JSON.stringify(points));
      changed.artifacts["campaign-checkpoints.json"] = await spec(p);
      // Consumer loads only manifest-declared paths,including this deliberate
      // altered fixture. It must fail before launching a browser.
    }
    const p = join(root, kind + ".json");
    await writeFile(p, JSON.stringify(changed));
    let failed;
    try {
      execFileSync(
        process.execPath,
        ["scripts/replay-report-presentation-browser.js", "--manifest=" + p],
        { stdio: "pipe" },
      );
    } catch (error) {
      failed = error;
    }
    assert.ok(failed && failed.status !== 0, "Accepted " + kind);
    assert.match(
      String(failed.stderr),
      {
        "zero-checkpoints": /Zero cases/,
        "missing-fixture": /missing|ENOENT/,
        "corrupt-fixture": /Corrupt scenario fixture/,
        "missing-checkpoint": /Wrong checkpoint count/,
        "unconsumed-event": /Unconsumed required events/,
      }[kind],
    );
    checks.push({ kind, rejected: true, exitCode: failed.status });
  }
  console.log(JSON.stringify({ completed: true, checks }));
} finally {
  await rm(root, { recursive: true, force: true });
}
