// Saved browser presentation evidence. Historical completed reward pages are
// independent pixel targets, not native transition captures or replay inputs.
import assert from "node:assert/strict";
import { sourceAwardTarget } from "./lib/source-award-target.js";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { spawnSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, sha, checkArtifacts } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import {
  compareAwardGroups,
  awardPixels,
} from "./lib/award-presentation-check.js";

const m = await json(
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
    "reference/current-winning-awards.json",
);
assert.equal(m.kind, "current-winning-award-presentations");
assert.equal(m.nativeComparison, false);
assert.deepEqual(m.comparison.exclusions, []);
const originalResources = await originalGame();
const exitProof = spawnSync(
  process.execPath,
  ["scripts/verify-jungle-award-exit-source.js"],
  { encoding: "utf8" },
);
assert.equal(exitProof.status, 0, exitProof.stdout + exitProof.stderr);
await checkArtifacts(m.artifacts);
const source = await validateProducerArchive(m.producer);
await validateProducerArchive(m.targetProducer);
for (const [path, hash] of Object.entries(source.files))
  if (acceptedRuntimeSource(path))
    assert.equal(
      sha(await readFile(path)),
      hash,
      "Changed accepted runtime " + path,
    );
const packet = await json(m.artifacts.presentations.path);
const old = await json(m.artifacts.targetCheckpoints.path);
assert.ok(packet.length > 0, "Zero award observations");
const required = [
  [24, "cave", 3000],
  [28, "jungle", 4000],
  [19, "mountain", 2000],
  [9, "cave", 5000],
  [30, "cave", 4500],
  [21, "cave", 6000],
];
assert.ok(m.includeNovay === undefined || typeof m.includeNovay === "boolean");
if (m.includeNovay) {
  required.push([10, "mountain", 7500]);
  assert.equal(
    m.artifacts.originalAwardSource.path,
    "reference/award-presentation-source.json",
  );
  const proof = spawnSync(
    process.execPath,
    ["scripts/verify-award-presentation-source.js"],
    { encoding: "utf8" },
  );
  assert.equal(proof.status, 0, proof.stdout + proof.stderr);
}
assert.deepEqual(
  m.cases.map(({ location, activity, value }) => [location, activity, value]),
  required,
);
assert.deepEqual(
  [...new Set(packet.map((v) => v.location))],
  required.map(([id]) => id),
);
assert.equal(
  new Set(packet.map((v) => v.key)).size,
  packet.length,
  "Duplicate award observation",
);
let groupsChecked = 0,
  negatives = 0,
  novayNegatives = 0;
for (const c of m.cases) {
  const observations = packet.filter((v) => v.location === c.location);
  for (const v of observations) {
    assert.equal(v.activity, c.activity);
    assert.equal(v.state.difficulty, 1);
    assert.equal(v.state.diagnostic, null);
    assert.equal(v.state.campaign.location, c.location);
    assert.equal(v.state.expeditionResult.value, c.value);
  }
  let targetPixels;
  if (c.targetKind === "source-composed") {
    assert.equal(m.includeNovay, true);
    assert.deepEqual([c.location, c.activity, c.value], [10, "mountain", 7500]);
    targetPixels = Buffer.from(sourceAwardTarget(c.value, originalResources));
  } else {
    assert.equal(c.targetKind, undefined, "Unsupported award target kind");
    const checkpoint = old.find((v) => v.name === c.targetCheckpoint);
    assert.ok(checkpoint, "Missing independent completed reward target");
    assert.equal(checkpoint.state.campaign.selected, c.location);
    assert.equal(checkpoint.state.expeditionResult.value, c.value);
    assert.equal(checkpoint.state.expeditionResult.phase, "award");
    assert.equal(checkpoint.state.systemOverlay, null);
    const png = PNG.sync.read(
      await readFile(m.artifacts[c.targetArtifact].path),
    );
    assert.equal(png.width, 320);
    assert.equal(png.height, 200);
    assert.equal(
      sha(png.data),
      checkpoint.pixelsSha256,
      "Corrupt completed reward pixels",
    );
    targetPixels = png.data;
    // Independently cross-check this composition against all six retained
    // pages before extending its original literal value text to7500.
    assert.equal(
      sha(sourceAwardTarget(c.value, originalResources)),
      sha(targetPixels),
      "Source-composed retained reward target",
    );
  }
  const groups = observations.filter(
    (v) => v.state.expeditionResult.presentation.transition,
  );
  // Original jungle Main01e0 wipes before returning. This is an exact black
  // page contract,not a pixel exclusion or a general missing-frame recovery.
  const incomingAlreadyCleared = c.activity === "jungle";
  if (incomingAlreadyCleared) {
    assert.equal(groups[0].state.jungle.phase, "complete");
    assert.equal(groups[0].state.jungle.outcome.code, 1);
    assert.equal(groups[0].state.jungle.frames, 421);
  }
  compareAwardGroups(groups, targetPixels, { incomingAlreadyCleared });
  if (incomingAlreadyCleared) {
    const wrong = structuredClone(groups),
      image = PNG.sync.read(Buffer.from(wrong[0].png.split(",")[1], "base64"));
    image.data[4] = 255;
    wrong[0].png =
      "data:image/png;base64," + PNG.sync.write(image).toString("base64");
    assert.throws(
      () =>
        compareAwardGroups(wrong, targetPixels, {
          incomingAlreadyCleared: true,
        }),
      /Uncleared incoming award page/,
    );
  }
  const publishing = observations.filter(
    (v) => v.state.expeditionResult.presentation.phase === "publishing",
  );
  assert.equal(publishing.length, 1, "Missing reward publication");
  assert.equal(
    publishing[0].state.expeditionResult.presentation.consumedRetraces,
    75,
  );
  assert.deepEqual(awardPixels(publishing[0]), targetPixels);
  groupsChecked += groups.length;
  if (c.targetKind === "source-composed") {
    assert.throws(
      () =>
        compareAwardGroups(
          groups,
          Buffer.from(sourceAwardTarget(7501, originalResources)),
        ),
      /Award row pixels/,
    );
    novayNegatives++;
  }
  if (!negatives) {
    assert.throws(
      () => compareAwardGroups(groups.slice(1), targetPixels),
      /Missing award row groups/,
    );
    const changed = structuredClone(groups),
      bad = PNG.sync.read(Buffer.from(changed[0].png.split(",")[1], "base64"));
    bad.data[0] = 255;
    changed[0].png =
      "data:image/png;base64," + PNG.sync.write(bad).toString("base64");
    assert.throws(
      () => compareAwardGroups(changed, targetPixels),
      /Award row pixels/,
    );
    const blank = structuredClone(groups);
    for (const v of blank.filter(
      (v) => v.state.expeditionResult.presentation.phase === "initial-wipe",
    )) {
      const image = PNG.sync.read(Buffer.from(v.png.split(",")[1], "base64"));
      for (let at = 0; at < image.data.length; at += 4)
        image.data.set([0, 0, 0, 255], at);
      v.png =
        "data:image/png;base64," + PNG.sync.write(image).toString("base64");
    }
    assert.throws(
      () => compareAwardGroups(blank, targetPixels),
      /Missing incoming award page/,
    );
    negatives = 3;
  }
}
assert.equal(groupsChecked, required.length * 15);
assert.equal(novayNegatives, m.includeNovay ? 1 : 0);
console.log(
  `Current Standard rewards:${required.length} awards across cave/jungle/mountain,${groupsChecked} exact row groups,75 retraces each,6 independent retained targets${m.includeNovay ? " plus original-source-composed7500" : ""},${4 + novayNegatives} pixel/missing-group/value negatives. No image exclusions;port regression,not native uninterrupted timing parity.`,
);
