// Independent exact browser replay of the earned-treasure route. The later
// losing campaign tail is not consumed or accepted by this bounded comparison.
import assert from "node:assert/strict";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { replayWinningPrefix } from "./lib/replay-winning-prefix.js";
import {
  json,
  fresh,
  archiveSource,
  checkSource,
  checkArtifacts,
  inventory,
} from "./lib/local-scenario-source.js";
const arg = (key) =>
  process.argv
    .find((a) => a.startsWith("--" + key + "="))
    ?.slice(key.length + 3);
const path = arg("manifest") ?? "reference/current-earned-route.json",
  m = await json(path);
if (process.argv.includes("--setup-negatives")) {
  const root = await mkdtemp(join(tmpdir(), "earned-route-negatives-")),
    checks = [];
  try {
    for (const kind of [
      "zero-checkpoints",
      "missing-fixture",
      "corrupt-fixture",
    ]) {
      const changed = structuredClone(m);
      if (kind === "zero-checkpoints") changed.expectedCheckpointCount = 0;
      if (kind === "missing-fixture")
        changed.artifacts.environment.path = join(root, "absent.json");
      if (kind === "corrupt-fixture")
        changed.artifacts.environment.sha256 = "0".repeat(64);
      const p = join(root, kind + ".json");
      await writeFile(p, JSON.stringify(changed));
      let failure;
      try {
        execFileSync(
          process.execPath,
          ["scripts/verify-current-earned-route.js", "--manifest=" + p],
          { stdio: "pipe" },
        );
      } catch (error) {
        failure = error;
      }
      assert.ok(failure && failure.status !== 0, "Accepted " + kind);
      assert.match(
        String(failure.stderr),
        kind === "zero-checkpoints"
          ? /Zero cases/
          : kind === "missing-fixture"
            ? /ENOENT|missing/
            : /Corrupt scenario fixture/,
      );
      checks.push({ kind, rejected: true, exitCode: failure.status });
    }
    console.log(JSON.stringify({ completed: true, checks }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  process.exit(0);
}
assert.equal(m.kind, "current-winning-valid-prefix");
assert.equal(m.nativeComparison, false);
assert.ok(
  m.expectedCheckpointCount > 0 && m.requiredEventCount > 0,
  "Zero cases",
);
assert.equal(m.lastCheckpoint, "bank-25");
assert.deepEqual(m.injections, []);
assert.deepEqual(m.fittedInputs, []);
assert.deepEqual(m.comparison.exclusions, []);
await originalGame();
await checkArtifacts(m.artifacts);
const root = await fresh(arg("output")),
  source = await archiveSource(root);
let result = { completed: false, accepted: false };
try {
  const positive = await withCarlsbadBrowser(async ({ page, state, until }) => {
    const points = [];
    await replayWinningPrefix({ page, state, points, manifest: path });
    const s = await state();
    assert.equal(s.money, 0);
    assert.equal(s.campaign.banked, 27050);
    assert.equal(s.campaign.day, 25);
    assert.equal(s.difficulty, 1);
    assert.equal(s.jungle.lives, 3);
    assert.equal(s.mountain.lives, 3);
    for (const key of ["cave", "jungle", "mountain"])
      assert.equal(s[key].outcome.code, 1);
    assert.ok(s.photography.photos.includes(s.photography.target));
    for (const id of [24, 28, 19, 9, 30, 21])
      assert.ok(s.campaign.playerCollected.includes(id));
    await page.locator("#restart").click();
    await until((v) => v.scene === "title");
    assert.equal((await state()).campaign.banked, 0);
    assert.equal((await state()).money, 0);
    return {
      checked: points.length,
      consumed: m.requiredEventCount,
      restart: true,
    };
  });
  await assert.rejects(
    () =>
      withCarlsbadBrowser(async ({ page, state }) => {
        await replayWinningPrefix({
          page,
          state,
          points: [],
          manifest: path,
          omitDifficulty: true,
        });
      }),
    /Prefix state standard-choice/,
    "Missing Standard input must fail at startup",
  );
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/") ||
      [
        "index.html",
        "package.json",
        "package-lock.json",
        "vite.config.js",
        "vite.campaign.config.js",
        "reference/build.json",
      ].includes(p),
  );
  await checkArtifacts(m.artifacts);
  result = {
    completed: true,
    accepted: true,
    nativeComparison: false,
    scope: m.scope,
    sourceCommit: source.commit,
    producer: m.producer,
    ...positive,
    semanticNegatives: 1,
    artifacts: await inventory(root, ["source-revision.json", "sources.zip"]),
  };
} finally {
  await writeFile(
    root + "/acceptance-status.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
console.log(JSON.stringify(result));
