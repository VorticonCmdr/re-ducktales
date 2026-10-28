// Diagnostic segment evidence only. This never replaces full campaign acceptance.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const required = (path) =>
  readFile(path).catch(() => {
    throw Error(`SETUP: missing ${path}; see docs/security.md`);
  });
const json = async (path) => JSON.parse(await required(path));
const m = await json("reference/security-campaign-progress.json");
assert.equal(m.expectedCheckpointCount, 11);
assert.equal(m.expectedEventCount, 2316);
assert.equal(m.artifacts.length, m.expectedArtifactCount);
assert.ok(m.expectedArtifactCount > 0);
for (const f of m.artifacts) {
  const b = await required(f.path);
  assert.equal(b.length, f.bytes, `Truncated ${f.path}`);
  assert.equal(sha(b), f.sha256, `Corrupt ${f.path}`);
}
const root = m.artifactRoot,
  checks = await json(`${root}/campaign-checkpoints.json`),
  events = await json(`${root}/captured-events.json`),
  env = await json(`${root}/environment.json`),
  timeline = await json(`${root}/timeline.json`);
assert.equal(
  env.completed,
  false,
  "This is an incomplete exploratory capture, not acceptance",
);
assert.equal(checks.length, 11);
assert.equal(events.length, 2316);
assert.equal(timeline.observations.length, 11);
assert.equal(checks.at(-1).name, "photography-return");
assert.equal(checks.at(-1).state.money, 4050);
assert.equal(checks.at(-1).state.campaign.day, 12);
assert.equal(env.clockOrigin, 1);
assert.equal(env.displayMilliseconds, 8);
assert.equal(env.hard, true);
const producer = await json(`${root}/producer.json`);
for (const [path, hash] of Object.entries(producer.sha256)) {
  const snapshot = [
    "tests/browser/helpers/linked-campaign.js",
    "tests/browser/helpers/security.js",
    "tests/browser/helpers/flight-policy.js",
    "reference/security-campaign-inputs.json",
  ].includes(path);
  const b = snapshot
    ? await required(`${root}/capture-source/${path}`)
    : path.startsWith(".local/")
      ? await required(`${root}/capture-config.js`)
      : execFileSync("git", ["show", `${m.producerBaseCommit}:${path}`]);
  assert.equal(sha(b), hash, `Changed diagnostic capture producer ${path}`);
}
function replay(directory) {
  const r = spawnSync(
    process.execPath,
    ["scripts/replay-hard-campaign.js", directory, "--diagnose"],
    { encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 },
  );
  assert.ifError(r.error);
  return {
    status: r.status,
    text: `${r.stdout ?? ""}\n${r.stderr ?? ""}`,
    stdout: r.stdout,
  };
}
const positive = replay(root);
assert.equal(positive.status, 0, positive.text);
const result = JSON.parse(positive.stdout);
assert.equal(result.mode, "EXPLORATORY diagnostic");
assert.equal(result.checked, 11);
assert.equal(result.consumed, 2316);
assert.equal(result.rendered, 913);
assert.equal(result.state.scene, "visit-notice");
// Required input and expected outcomes remain separate. Remove the actual
// security Right key in a disposable fixture; the carried state must diverge.
const negativeRoot = ".local/security-campaign-progress-negative";
await mkdir(negativeRoot, { recursive: true });
for (const name of [
  "environment.json",
  "campaign-checkpoints.json",
  "timeline.json",
])
  await copyFile(`${root}/${name}`, `${negativeRoot}/${name}`);
const altered = structuredClone(events),
  index = altered.findIndex(
    (e) => e.type === "keydown" && e.key === "ArrowRight",
  );
assert.ok(index >= 0);
// Keep event count/timestamps unchanged; this is a wrong external direction,
// rather than an unfinished-stream metadata error before the game executes.
altered[index].key = "ArrowLeft";
await writeFile(
  `${negativeRoot}/captured-events.json`,
  JSON.stringify(altered),
);
const negative = replay(negativeRoot);
assert.equal(negative.status, 1);
assert.match(negative.text, /Carried replay checkpoint1 flight-start/);
assert.doesNotMatch(negative.text, /SETUP:|ETIMEDOUT|Late replay clock/);
await writeFile(`${negativeRoot}/replay.log`, negative.text);
console.log(
  "Security campaign diagnostic:11 exact carried state checkpoints,2316 consumed DOM inputs,913 flight presentations; wrong security direction rejected. Declared100ms diagnostic tail; NOT complete campaign acceptance.",
);
