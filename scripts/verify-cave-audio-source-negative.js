import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const m = JSON.parse(await readFile("reference/cave-audio-calls-source.json"));
const root = await mkdtemp(join(tmpdir(), "cave-source-negative-"));
try {
  for (const kind of ["empty", "missing", "corrupt", "wrong-offset"]) {
    const copy = structuredClone(m);
    if (kind === "empty") copy.ranges = [];
    if (kind === "missing") copy.ranges[0].artifact.path = join(root, "absent-fixture.json");
    if (kind === "corrupt") copy.ranges[0].artifact.sha256 = "0".repeat(64);
    if (kind === "wrong-offset") copy.ranges[0].offset++;
    const path = join(root, kind + ".json");
    await writeFile(path, JSON.stringify(copy));
    const r = spawnSync(process.execPath, ["scripts/verify-cave-audio-calls-source.js", "--manifest=" + path], { encoding: "utf8" });
    assert.equal(r.error, undefined);
    assert.ok(r.status !== 0 && r.status !== null, kind + " incorrectly succeeded");
    assert.match(r.stderr, kind === "missing" ? /ENOENT/ : kind === "corrupt" ? /Corrupt scenario fixture/ : /AssertionError/);
    console.log("Cave source negative rejected:", kind);
  }
} finally { await rm(root, { recursive: true, force: true }); }
