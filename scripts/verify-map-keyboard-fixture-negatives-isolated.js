// Run the immutable legacy checker on disposable copies. The historical checker
// intentionally renames/corrupts two fixtures; none of its writes reach captures.
import assert from "node:assert/strict";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  cp,
  symlink,
  rm,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  root = process.cwd();
const manifest = JSON.parse(await readFile("reference/map-keyboard.json"));
assert.equal(Object.keys(manifest.artifacts).length, 159);
const protectedArtifacts = {};
async function checkOriginals() {
  for (const a of Object.values(manifest.artifacts)) {
    let b;
    try {
      b = await readFile(resolve(root, a.path));
    } catch {
      throw Error(`SETUP: missing native map fixture ${a.path}`);
    }
    assert.equal(sha(b), a.sha256, `Original map capture changed:${a.path}`);
    protectedArtifacts[a.path] = a.sha256;
  }
}
await checkOriginals();
const output = resolve(
  process.env.DUCKTALES_EXPEDITION_KEYBOARD_VERIFICATION_ROOT ??
    ".local/expedition-keyboard-verification",
  "map-fixture-controls",
);
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "ducktales-map-negative-"));
let succeeded = false;
try {
  await mkdir(join(temporary, ".local"));
  // All paths that the legacy script can mutate are regular owned copies.
  await cp(
    resolve(root, ".local/map-keyboard-capture-02"),
    join(temporary, ".local/map-keyboard-capture-02"),
    { recursive: true, dereference: true },
  );
  for (const name of ["scripts", "src", "reference", "game"])
    await symlink(resolve(root, name), join(temporary, name), "dir");
  const gitDirectory = execFileSync(
    "git",
    ["rev-parse", "--absolute-git-dir"],
    { cwd: root, encoding: "utf8" },
  ).trim();
  const run = spawnSync(
    process.execPath,
    ["scripts/verify-map-keyboard-fixture-negatives.js"],
    {
      cwd: temporary,
      env: { ...process.env, GIT_DIR: gitDirectory, GIT_WORK_TREE: temporary },
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  await writeFile(
    join(output, "checker.log"),
    `${run.stdout ?? ""}\n${run.stderr ?? ""}`,
  );
  assert.ifError(run.error);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(
    run.stdout,
    /Map keyboard fixture controls:missing required input snapshot and same-size corrupt consumption trace rejected/,
  );
  for (const name of [
    "missing-fixture",
    "corrupt-fixture",
    "restored-positive",
  ]) {
    const b = await readFile(
      join(temporary, ".local/map-keyboard-verification", name + ".log"),
    );
    await writeFile(join(output, name + ".log"), b);
  }
  const positive = await readFile(
    join(output, "restored-positive.log"),
    "utf8",
  );
  assert.match(
    positive,
    /Map ordinary keys:36 original input\/128-flag\/pointer comparisons/,
  );
  await checkOriginals();
  succeeded = true;
  await writeFile(
    join(output, "report.json"),
    JSON.stringify(
      {
        completed: true,
        exitCode: 0,
        negativeCases: 2,
        restoredPositiveCases: 36,
        mutationsConfinedToTemporaryCopies: true,
        historicalArtifactsPreserved: true,
        protectedArtifacts,
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
  await checkOriginals();
}
assert.equal(succeeded, true);
console.log(
  "Map keyboard fixture controls:2 legacy negatives and36 restored positive cases pass on disposable copies;all159 original artifact hashes preserved.",
);
