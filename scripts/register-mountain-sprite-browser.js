// Register only after the existing strict route checker accepts a provisional
// receipt. Raw captures and expected streams are never modified.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
const [manifestPath, browserRoot] = process.argv.slice(2);
assert.ok(
  manifestPath && browserRoot,
  "SETUP: provide pending manifest and completed browser root",
);
assert.ok(/^reference\/[a-z0-9-]+\.json$/.test(manifestPath));
assert.ok(!relative(resolve(".local"), resolve(browserRoot)).startsWith(".."));
const json = async (p) => JSON.parse(await readFile(p));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const m = await json(manifestPath),
  runner = await json(`${browserRoot}/runner-status.json`),
  source = await json(`${browserRoot}/source-revision.json`);
assert.equal(m.pendingBrowserReplay, true);
assert.equal(runner.completed, true);
assert.deepEqual(
  runner.steps.map((s) => [s.name, s.exitCode]),
  [
    ["positive", 0],
    ["negative", 0],
  ],
);
assert.equal(source.commit, runner.sourceCommit);
const directories = (
  await readdir(`${browserRoot}/browser`, { withFileTypes: true })
).filter((d) => d.isDirectory());
assert.equal(directories.length, 1, "SETUP: ambiguous browser evidence");
const route = `${browserRoot}/browser/${directories[0].name}`;
const paths = {
  "browser-source": `${browserRoot}/source-revision.json`,
  "browser-zip": `${browserRoot}/sources.zip`,
  "browser-runner": `${browserRoot}/runner-status.json`,
  "browser-report": `${browserRoot}/positive-report.json`,
  "browser-log": `${browserRoot}/positive.log`,
  "browser-config": `${browserRoot}/config.mjs`,
  "browser-negative": `${browserRoot}/controls/browser-negative.log`,
  "browser-progress": `${route}/replay-progress.json`,
  "browser-checkpoints": `${route}/campaign-checkpoints.json`,
  "browser-events": `${route}/actual-events.json`,
};
for (const [role, path] of Object.entries(paths)) {
  const bytes = await readFile(path);
  m.artifacts[role] = { path, bytes: bytes.length, sha256: sha(bytes) };
}
Object.assign(m, {
  pending: false,
  pendingBrowserReplay: false,
  browserVerified: true,
  browserCommit: source.commit,
});
m.sourceFileCounts.browser = Object.keys(source.files).length;
m.limitations = [
  "Port/browser route,not native whole-level parity",
  "Sprite work is charged;copy/text/line and other CPU costs remain incomplete",
  "Broader required integration gate remains incomplete",
];
const temporary = await mkdtemp(join(tmpdir(), "ducktales-mountain-receipt-"));
try {
  const provisional = join(temporary, "manifest.json");
  await writeFile(provisional, JSON.stringify(m, null, 2) + "\n");
  const check = spawnSync(
    process.execPath,
    ["scripts/verify-destination-routes.js", provisional],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  assert.ifError(check.error);
  assert.equal(
    check.status,
    0,
    `Route evidence rejected:\n${check.stdout}\n${check.stderr}`,
  );
  await writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n");
  process.stdout.write(check.stdout);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
