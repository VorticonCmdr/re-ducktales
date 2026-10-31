// Saved current-runtime receipts;fresh browser execution is a separate command.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const m = await json("reference/repair-input-acceptance.json");
assert.equal(m.kind, "repair-input-acceptance");
assert.equal(m.nativeComparison, false);
await originalGame();
await checkArtifacts(m.artifacts);
async function currentSource(root) {
  const source = await validateProducerArchive(root);
  for (const [file, hash] of Object.entries(source.files))
    if (acceptedRuntimeSource(file))
      assert.equal(
        sha(await readFile(file)),
        hash,
        "Changed accepted runtime " + file,
      );
  return source;
}
const scenario = await json(m.artifacts.scenario.path);
assert.equal(scenario.kind, "repair-input-browser-regression");
assert.deepEqual(
  scenario.cases.map((c) => [c.key, c.checkpoints, c.events]),
  [
    ["zero", 10, 64],
    ["positive", 11, 106],
  ],
);
for (const c of scenario.cases) {
  await checkArtifacts(c.artifacts);
  await validateProducerArchive(c.producer);
}
const controls = await json(m.artifacts.result.path),
  source = await currentSource(m.consumer);
assert.equal(controls.completed, true);
assert.equal(controls.accepted, true);
assert.equal(controls.nativeComparison, false);
assert.equal(controls.sourceCommit, source.commit);
assert.deepEqual(
  controls.cases,
  scenario.cases.map((c) => ({
    key: c.key,
    checked: c.checkpoints,
    consumed: c.events,
    restart: true,
    semanticNegatives: 1,
  })),
);
await checkArtifacts(controls.artifacts);
const standard = await json(m.artifacts.standardScenario.path);
assert.equal(standard.kind, "standard-full-campaign-port-regression");
await checkArtifacts(standard.artifacts);
await validateProducerArchive(standard.producer);
const full = await json(m.artifacts.standardResult.path),
  fullSource = await currentSource(m.standardConsumer);
assert.equal(full.completed, true);
assert.equal(full.accepted, true);
assert.equal(full.nativeComparison, false);
assert.equal(full.sourceCommit, fullSource.commit);
assert.equal(full.producer, standard.producer);
assert.equal(full.checked, 85);
assert.equal(full.consumed, 5071);
assert.equal(full.restart, true);
assert.equal(full.semanticNegatives, 1);
await checkArtifacts(full.artifacts);
for (const c of scenario.cases) {
  const after = await json(c.artifacts["campaign-checkpoints"].path);
  assert.equal(
    after.find((p) => p.name === "after-p").state.systemOverlay,
    null,
  );
  assert.equal(
    after.find((p) => p.name === "pause").state.repairs.remaining,
    413,
  );
  assert.equal(
    after.find((p) => p.name === "pause").state.repairs.waitingForInputPoll,
    true,
  );
}
await validateProducerArchive(m.beforeSource);
const before = await json(m.artifacts.before.path);
assert.equal(
  before.find((p) => p.name === "after-p").state.systemOverlay.kind,
  "pause",
);
assert.equal(
  before.find((p) => p.name === "after-p").state.repairs.remaining,
  420,
);
await currentSource(m.checksSource);
for (const [key, count] of [
  ["units", 194],
  ["boundaries", 77],
]) {
  const log = await readFile(m.artifacts[key].path, "utf8");
  for (const [label, value] of [
    ["tests", count],
    ["pass", count],
    ["fail", 0],
    ["skipped", 0],
  ])
    assert.match(log, new RegExp(label + " " + value + "\\b"));
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
const setup = await json(m.artifacts.setupNegatives.path);
assert.equal(setup.completed, true);
assert.deepEqual(
  setup.checks,
  ["zero-cases", "missing-fixture", "corrupt-fixture"].map((kind) => ({
    kind,
    rejected: true,
    exitCode: 1,
  })),
);
for (const name of [
  "verify-repair-input-source",
  "verify-result-caller-source",
  "verify-rival-keyboard-source",
  "verify-flight-runtime",
]) {
  const check = spawnSync(process.execPath, ["scripts/" + name + ".js"], {
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr);
}
console.log(
  "Repair acceptance:21 exact browser checkpoints/170 DOM events,two Pause omission negatives,cash0/earned2800→2100,recovery/Restart;Standard85/5071 and omission negative;194 units,77 boundaries,three setup negatives,build and conditional original crash-state regression. Muted port comparison,not native timing/audio parity.",
);
