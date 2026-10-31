import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const m = JSON.parse(await readFile("reference/cave-audio-acceptance.json"));
const root = await mkdtemp(join(tmpdir(), "cave-audio-negative-"));
try {
  for (const kind of ["zero-cases", "missing-fixture", "corrupt-fixture"]) {
    const copy = structuredClone(m);
    const first = Object.keys(copy.artifacts)[0];
    assert.ok(first);
    if (kind === "zero-cases") copy.cases = [];
    if (kind === "missing-fixture")
      copy.artifacts[first].path = join(root, "absent-fixture.json");
    if (kind === "corrupt-fixture")
      copy.artifacts[first].sha256 = "0".repeat(64);
    const path = join(root, kind + ".json");
    await writeFile(path, JSON.stringify(copy));
    const r = spawnSync(
      process.execPath,
      ["scripts/verify-cave-audio-acceptance.js", "--manifest=" + path],
      { encoding: "utf8" },
    );
    assert.equal(r.error, undefined);
    assert.ok(
      r.status !== 0 && r.status !== null,
      kind + " incorrectly succeeded",
    );
    assert.match(
      r.stderr,
      kind === "zero-cases"
        ? /Zero cave audio cases/
        : kind === "missing-fixture"
          ? /ENOENT/
          : /Corrupt scenario fixture/,
    );
    console.log("Cave audio setup negative rejected:", kind);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
