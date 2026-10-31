// Exact captured stripe rules and independently retained completed port pages.
// This does not claim native uninterrupted timing or transition screenshots.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { spawnSync } from "node:child_process";
import { originalGame } from "../tests/helpers/original-game.js";
import { json, checkArtifacts, sha } from "./lib/local-scenario-source.js";
import {
  validateProducerArchive,
  acceptedRuntimeSource,
} from "./lib/consumer-provenance.js";
import { reportPixels, compareReportRows } from "./lib/report-pixel-check.js";
const path = process.argv.find((a) => a.startsWith("--manifest="))?.slice(11);
assert.ok(path, "Supply report row manifest");
const m = await json(path);
assert.equal(m.kind, "report-presentation-row-candidate");
assert.equal(m.nativeComparison, false);
assert.deepEqual(m.comparison.exclusions, []);
assert.ok(m.cases.length > 0, "Zero report cases");
await originalGame();
await checkArtifacts(m.artifacts);
const source = await validateProducerArchive(m.producer);
for (const [p, h] of Object.entries(source.files))
  if (acceptedRuntimeSource(p))
    assert.equal(sha(await readFile(p)), h, "Changed report runtime " + p);
for (const root of m.targetProducers) await validateProducerArchive(root);
const packet = await json(m.artifacts.presentations.path),
  seen = new Set();
let checked = 0,
  negatives = 0;
for (const c of m.cases) {
  const data = packet.filter((v) => v.key.startsWith(c.key + ":"));
  assert.ok(data.length > 0, "Missing report case");
  for (const v of data) {
    seen.add(v.key);
    assert.equal(v.state.diagnostic, null);
  }
  const image = PNG.sync.read(await readFile(m.artifacts[c.target].path));
  assert.equal(image.width, 320);
  assert.equal(image.height, 200);
  const old = await json(m.artifacts[c.targetCheckpoints].path),
    target = old.find((p) => p.name === c.targetCheckpoint);
  assert.ok(target);
  assert.equal(sha(image.data), target.pixelsSha256);
  const oldReport =
    target.state.rivalReport ?? target.state.claim ?? target.state.visitNotice;
  assert.equal(oldReport.target, c.targetId);
  if (c.variant !== undefined) assert.equal(oldReport.variant, c.variant);
  const ready = data.find(
    (v) => v.state.reportPresentation.phase === "publishing",
  );
  assert.ok(ready);
  const report =
    ready.state.rivalReport ?? ready.state.claim ?? ready.state.visitNotice;
  assert.equal(report.target, c.targetId);
  if (c.variant !== undefined) assert.equal(report.variant, c.variant);
  let incoming;
  if (c.incoming.kind === "checkpoint") {
    const p = PNG.sync.read(
      await readFile(m.artifacts[c.incoming.artifact].path),
    );
    assert.equal(p.width, 320);
    assert.equal(p.height, 200);
    incoming = p.data;
  } else if (c.incoming.kind === "clearing-page") {
    const v = data.find(
      (v) => v.state.reportPresentation.phase === "clearing-page",
    );
    assert.ok(v, "Missing incoming report publication");
    incoming = reportPixels(v);
    assert.ok(
      incoming.some((v, i) => i % 4 !== 3 && v !== 0),
      "Missing incoming report page",
    );
  } else if (c.incoming.kind === "previous-exit") {
    const v = packet.find((v) => v.key === c.incoming.key);
    assert.ok(
      v && packet.indexOf(v) < packet.indexOf(data[0]),
      "Missing preceding report exit",
    );
    assert.equal(v.state.reportPresentation.phase, "publishing-exit");
    assert.equal(v.state.reportPresentation.consumedRetraces, 75);
    incoming = reportPixels(v);
    for (let at = 0; at < incoming.length; at += 4)
      assert.deepEqual([...incoming.subarray(at, at + 4)], [0, 0, 0, 255]);
  } else throw Error("Unsupported report incoming rule");
  compareReportRows(data, incoming, image.data);
  checked += 15;
  if (!negatives) {
    const omitted = data.filter((v) => !v.key.endsWith("initial-wipe:0"));
    assert.throws(
      () => compareReportRows(omitted, incoming, image.data),
      /Missing report row groups/,
    );
    const changed = structuredClone(data),
      v = changed.find((v) => v.key.endsWith("initial-wipe:0")),
      bad = PNG.sync.read(Buffer.from(v.png.split(",")[1], "base64"));
    bad.data[0] = 255;
    v.png = "data:image/png;base64," + PNG.sync.write(bad).toString("base64");
    assert.throws(
      () => compareReportRows(changed, incoming, image.data),
      /Report row pixels/,
    );
    const blank = new Uint8Array(incoming.length);
    for (let at = 3; at < blank.length; at += 4) blank[at] = 255;
    assert.throws(
      () => compareReportRows(data, blank, image.data),
      /Report row pixels/,
    );
    negatives = 3;
  }
}
assert.equal(seen.size, packet.length, "Unconsumed report observations");
assert.equal(checked, m.expectedRowGroups);
const proof = spawnSync(
  process.execPath,
  ["scripts/verify-report-presentation-source.js"],
  { encoding: "utf8" },
);
assert.equal(proof.status, 0, proof.stdout + proof.stderr);
console.log(
  `Report rows:${m.cases.length} presentations,${checked} exact row groups,50 entry/75 total retraces,independent retained completed-page targets,${negatives} pixel/missing-group negatives. No image exclusions;port regression,not native timing parity.`,
);
