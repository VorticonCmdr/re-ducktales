// Validate exploratory evidence; this never promotes it to browser/native acceptance.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { sha, json, checkArtifacts } from "./lib/local-scenario-source.js";
const m = await json("reference/easy-mountain-investigation.json");
assert.equal(m.id, "easy-machu-projectile-route-investigation");
assert.equal(m.observations.length, 4);
assert.equal(Object.keys(m.artifacts).length, 10);
assert.equal(m.partialRestore, false);
assert.equal(m.runtimeMemoryWrites, false);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
const r = await json(m.artifacts["ghidra-counter-span.json"].path);
assert.equal(r.isError, false);
const span = JSON.parse(r.content[0].text);
assert.equal(span.program, m.staticEvidence.program);
assert.equal(span.address, m.staticEvidence.ghidraAddress);
assert.equal(span.length, 27);
const bytes = Buffer.from(span.data),
  exe = await readFile("game/DUCKTALE.EXE"),
  at = m.staticEvidence.originalFileOffset;
assert.equal(bytes.toString("hex"), span.hex);
assert.equal(sha(bytes), m.staticEvidence.sha256);
assert.deepEqual(bytes, exe.subarray(at, at + 27));
const src = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", m.runtimeSourceCommit, "src/"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
assert.ok(src.length > 0);
for (const p of src)
  assert.equal(
    sha(await readFile(p)),
    sha(execFileSync("git", ["show", m.runtimeSourceCommit + ":" + p])),
    "Changed investigation runtime " + p,
  );
const thunder = await json(
    m.artifacts["ducktales-easy-thunderclap-exploration.json"].path,
  ),
  failed = await json(
    m.artifacts["ducktales-easy-machu-exploration.json"].path,
  ),
  success = await json(
    m.artifacts["ducktales-easy-machu-exploration-03.json"].path,
  );
for (const [r, inputs, money, location] of [
  [thunder, 494, 2100, 33],
  [success, 710, 2700, 5],
]) {
  assert.match(r.scope, /EXPLORATORY/);
  assert.equal(r.entry.difficulty, 0);
  assert.equal(r.used, inputs);
  assert.equal(r.award.mountain.outcome.code, 1);
  assert.equal(r.award.mountain.lives, 3);
  assert.equal(r.returned.money, money);
  assert.deepEqual(r.returned.campaign.playerCollected, [location]);
  assert.equal(r.restarted, true);
}
assert.equal(failed.used, 706);
assert.equal(failed.award.mountain.outcome.code, 0);
assert.equal(failed.restarted, false);
const diagnostic = await json(
  m.artifacts["ducktales-machu-component-probe.json"].path,
);
assert.deepEqual(
  diagnostic.map((c) => c.difficulty),
  [0, 2],
);
const first = diagnostic[0].points.find(
  (p, i) => p.state.action !== diagnostic[1].points[i].state.action,
);
assert.equal(first.input, 429);
assert.equal(first.state.action, 8);
const plan = await json(m.artifacts["ducktales-machu-easy-plan.json"].path);
assert.equal(plan.initial.seed, 44031);
assert.equal(plan.initial.difficulty, 0);
assert.equal(plan.delay, 4);
assert.equal(plan.insertBeforeInput, 403);
assert.equal(plan.used, 710);
assert.equal(plan.final.outcome.code, 1);
assert.equal(plan.final.lives, 3);
console.log(
  "Exploratory evidence validated:10 local artifacts,27 original/Ghidra bytes,3 actual browser observations and conditional Easy/Hard diagnosis;not native or independent browser acceptance.",
);
