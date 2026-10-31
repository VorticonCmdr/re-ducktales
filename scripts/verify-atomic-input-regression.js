// Saved current-consumer evidence, not a substitute for the manifest's fresh
// execution command. Historical fixtures and current runtime remain separate.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json,
  checkArtifacts,
  checkSource,
  sha,
} from "./lib/local-scenario-source.js";
import {
  verifyProtected,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const manifestPath =
  process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
  "reference/atomic-input-regression.json";
const m = await json(manifestPath);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
const source = await checkSource(m.consumerRoot, acceptedRuntimeSource);
assert.equal(source.commit, m.sourceCommit);
const r = await json(m.consumerRoot + "/result.json");
assert.equal(r.completed, true);
assert.equal(r.sourceCommit, m.sourceCommit);
assert.equal(r.componentCases, 8);
assert.equal(r.componentPresentations, 2696);
assert.deepEqual(r.headless, { checked: 34, consumed: 4981, rendered: 1470 });
assert.equal(r.browserCases.length, 12);
assert.equal(
  r.browserCases.reduce((n, c) => n + c.checked, 0),
  272,
);
assert.equal(
  r.browserCases.reduce((n, c) => n + c.consumed, 0),
  10117,
);
assert.ok(
  r.browserCases.every(
    (c) => c.restart === true && c.checked > 0 && c.consumed > 0,
  ),
);
assert.deepEqual(
  r.browserCases.map((c) => c.group),
  [
    "full",
    "cave",
    "mountain",
    "mountain",
    "jungle",
    "jungle",
    "safari",
    "safari",
    "safari",
    "safari",
    "safari",
    "safari",
  ],
);
assert.deepEqual(
  r.browserCases.filter((c) => c.group === "safari").map((c) => c.variant),
  [1, 2, 3, 4, 5, 6],
);
assert.equal(r.producerSources.length, 5);
assert.ok(Object.keys(r.protectedFiles).length > 0);
await verifyProtected(r.protectedFiles);
assert.deepEqual(m.comparisonExclusions, []);
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.fittedInputs, []);
assert.equal(m.expectedBrowserCases, 12);
assert.equal(m.expectedBrowserCheckpoints, 272);
assert.equal(m.requiredBrowserEvents, 10117);
const negatives = await json(m.negativeControls.resultPath);
assert.equal(negatives.completed, true);
assert.deepEqual(
  negatives.cases,
  ["zero-browser-cases", "unconsumed-event", "corrupt-result"].map((name) => ({
    name,
    rejected: true,
  })),
);
assert.equal(m.negativeControls.count, 3);
console.log(
  "Saved current-consumer regression verified:12 browser routes,272 exact state/image checkpoints,10117 DOM events,8 cave components/2696 presentations,and full headless campaign;historical inputs/expectations unchanged.",
);
