import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "reference/destination-jungle-entry.json",
      "reference/destination-jungle-treasure.json",
      "reference/destination-mountain-ascent.json",
    ];
const root = await mkdtemp(join(tmpdir(), "ducktales-route-negatives-"));
let checked = 0;
try {
  for (const path of paths) {
    const original = JSON.parse(await readFile(path));
    const run = async (name, mutate, pattern) => {
      const m = structuredClone(original);
      await mutate(m);
      const target = join(root, `${name}.json`);
      await writeFile(target, JSON.stringify(m));
      const r = spawnSync(
        process.execPath,
        ["scripts/verify-destination-routes.js", target],
        { encoding: "utf8", timeout: 30000, maxBuffer: 2 * 1024 * 1024 },
      );
      assert.ifError(r.error);
      assert.equal(r.status, 1, `${name} must fail`);
      assert.match(r.stdout + r.stderr, pattern, name);
      checked++;
    };
    const replace = async (m, role, value) => {
      const b = Buffer.from(JSON.stringify(value));
      const p = join(root, `${role}.json`);
      await writeFile(p, b);
      m.artifacts[role] = {
        path: p,
        bytes: b.length,
        sha256: createHash("sha256").update(b).digest("hex"),
      };
    };
    await run(
      "missing-events",
      async (m) => {
        m.artifacts["captured-events"].path = join(root, "absent.json");
      },
      /SETUP: missing destination route artifact/,
    );
    await run(
      "corrupt-events",
      async (m) => {
        m.artifacts["captured-events"].sha256 = "0".repeat(64);
      },
      /Corrupt captured-events/,
    );
    await run(
      "unfinished-events",
      async (m) => {
        const e = JSON.parse(
          await readFile(m.artifacts["captured-events"].path),
        );
        e.pop();
        await replace(m, "captured-events", e);
      },
      /AssertionError/,
    );
    await run(
      "skipped-browser-case",
      async (m) => {
        const r = JSON.parse(
          await readFile(m.artifacts["browser-report"].path),
        );
        r.stats.skipped++;
        await replace(m, "browser-report", r);
      },
      /AssertionError.*skipped/s,
    );
    await run(
      "zero-cases",
      async (m) => {
        m.expectedCheckpointCount = 0;
      },
      /AssertionError/,
    );
  }
  assert.equal(checked, paths.length * 5);
  console.log(
    `Destination route negatives: ${checked} required fixture, sequence, browser-skip and zero-case failures detected; original artifacts untouched.`,
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
