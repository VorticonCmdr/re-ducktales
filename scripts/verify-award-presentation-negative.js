import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = await mkdtemp(join(tmpdir(), "award-negative-"));
try {
  for (const source of [false, true]) {
    const m = JSON.parse(
      await readFile(
        source
          ? "reference/award-presentation-source.json"
          : "reference/award-presentation-acceptance.json",
      ),
    );
    for (const kind of ["empty", "missing", "corrupt"]) {
      const copy = structuredClone(m);
      if (kind === "empty") {
        if (source) copy.ranges = [];
        else copy.cases = [];
      } else {
        const artifact = source
          ? copy.ranges[0].artifact
          : copy.artifacts[Object.keys(copy.artifacts)[0]];
        if (kind === "missing")
          artifact.path = join(root, "absent-fixture.json");
        else artifact.sha256 = "0".repeat(64);
      }
      const path = join(root, `${source}-${kind}.json`);
      await writeFile(path, JSON.stringify(copy));
      const r = spawnSync(
        process.execPath,
        [
          source
            ? "scripts/verify-award-presentation-source.js"
            : "scripts/verify-award-presentation-acceptance.js",
          "--manifest=" + path,
        ],
        { encoding: "utf8" },
      );
      assert.equal(r.error, undefined);
      assert.ok(r.status !== 0 && r.status !== null);
      assert.match(
        r.stderr,
        kind === "empty"
          ? source
            ? /AssertionError/
            : /Zero award cases/
          : kind === "missing"
            ? /ENOENT/
            : /Corrupt scenario fixture/,
      );
      console.log(
        "Award negative rejected:",
        source ? "source" : "acceptance",
        kind,
      );
    }
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
