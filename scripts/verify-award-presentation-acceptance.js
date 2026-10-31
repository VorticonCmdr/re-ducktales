import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";
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
    "reference/award-presentation-acceptance.json",
);
assert.equal(m.kind, "award-presentation-acceptance");
assert.equal(m.nativeComparison, false);
assert.ok(Array.isArray(m.cases) && m.cases.length > 0, "Zero award cases");
await checkArtifacts(m.artifacts);
async function current(root) {
  const s = await validateProducerArchive(root);
  for (const [p, h] of Object.entries(s.files))
    if (acceptedRuntimeSource(p))
      assert.equal(sha(await readFile(p)), h, "Changed accepted runtime " + p);
  const files = (await readdir("src", { recursive: true, withFileTypes: true }))
    .filter((d) => d.isFile())
    .map((d) => `${d.parentPath}/${d.name}`)
    .sort();
  assert.deepEqual(
    files,
    Object.keys(s.files)
      .filter((p) => p.startsWith("src/"))
      .sort(),
  );
  return s;
}
const target = PNG.sync.read(await readFile(m.target)).data;
assert.deepEqual(
  m.cases.map((c) => c.device),
  ["muted", "speaker", "tandy"],
);
const names = [
  "award-entry",
  "early-first-flush",
  "second-wipe",
  "early-second-flush",
  "award-ready",
  "atomic",
  "map",
  "restarted",
];
function audio(events, device) {
  if (device === "muted") {
    assert.deepEqual(events, []);
    return;
  }
  const a = events.filter((e) => e.type === "ack"),
    q = a.filter((e) => e.query),
    words = a.filter((e) => e.argument === 0x49);
  assert.equal(q.length, 1, "Missing terminal audio query");
  assert.equal(words.length, 2, "Missing original Sound49 call");
  if (q[0].busy)
    assert.ok(
      events.some(
        (e) => e.type === "complete" && e.token === q[0].token && !e.busy,
      ),
      "Missing terminal completion",
    );
  const reset = a.find(
    (e) =>
      e.argument === 0 &&
      e.sequence > q[0].sequence &&
      e.sequence < words[1].sequence,
  );
  assert.ok(reset, "Missing guarded return reset");
  assert.equal(words[1].token, null);
  assert.equal(words[1].busy, true);
  if (device === "speaker") assert.equal(words[1].accepted, true);
  else assert.equal(reset.busy, false);
}
for (const c of m.cases) {
  const source = await current(c.root),
    r = await json(c.root + "/result.json"),
    points = await json(c.root + "/campaign-checkpoints.json"),
    packet = await json(c.root + "/presentation.json");
  assert.equal(r.sourceCommit, source.commit);
  assert.equal(r.completed, true);
  assert.equal(r.accepted, false);
  assert.equal(r.verifiedBrowserSpec, true);
  assert.equal(r.device, c.device);
  assert.equal(r.groups, 15);
  assert.equal(r.retraces, 75);
  assert.equal(r.pixelNegatives, 2);
  assert.equal(r.restart, true);
  assert.equal(r.prefixEvents, 460);
  assert.equal(r.checkpoints, 8);
  assert.deepEqual(
    points.map((p) => p.name),
    names,
  );
  const events = await json(c.root + "/captured-events.json");
  const environment = await json(c.root + "/environment.json");
  const timeline = await json(c.root + "/timeline.json");
  assert.equal(environment.clockOrigin, 1);
  assert.equal(environment.displayMilliseconds, 8);
  assert.equal(environment.difficulty, 0);
  assert.equal(environment.physical, true);
  assert.equal(environment.completed, false);
  assert.equal(timeline.clockOrigin, 1);
  assert.equal(timeline.displayMilliseconds, 8);
  assert.equal(timeline.endAt, points.at(-1).at);
  assert.deepEqual(
    timeline.observations,
    points.map(({ name, at, eventCount }) => ({ name, at, eventCount })),
  );
  assert.equal(events.length, r.events);
  assert.equal(points.at(-1).eventCount, events.length);
  const groups = packet.video.filter(
    (v) => v.state.expeditionResult.presentation.transition,
  );
  compareAwardGroups(groups, target);
  assert.throws(
    () => compareAwardGroups(groups.slice(1), target),
    /Missing award row groups/,
  );
  const changed = structuredClone(groups),
    bad = PNG.sync.read(Buffer.from(changed[0].png.split(",")[1], "base64"));
  bad.data[0] = 255;
  changed[0].png =
    "data:image/png;base64," + PNG.sync.write(bad).toString("base64");
  assert.throws(() => compareAwardGroups(changed, target), /Award row pixels/);
  const blanked = structuredClone(groups);
  for (const group of blanked.filter(
    (v) => v.state.expeditionResult.presentation.phase === "initial-wipe",
  )) {
    const image = PNG.sync.read(Buffer.from(group.png.split(",")[1], "base64"));
    for (let at = 0; at < image.data.length; at += 4)
      image.data.set([0, 0, 0, 255], at);
    group.png =
      "data:image/png;base64," + PNG.sync.write(image).toString("base64");
  }
  assert.throws(
    () => compareAwardGroups(blanked, target),
    /Missing incoming award page/,
  );
  const publication = packet.video.find((v) => v.key === "publishing:none");
  assert.ok(publication);
  assert.equal(
    publication.state.expeditionResult.presentation.consumedRetraces,
    75,
  );
  assert.deepEqual(awardPixels(publication), target);
  for (const p of points) assert.equal(p.state.diagnostic, null);
  assert.equal(points[0].state.money, 400);
  assert.equal(points[0].state.pendingCaveSystemKeys.length, 3);
  assert.equal(points[2].state.money, 3400);
  assert.equal(points[2].state.pendingCaveSystemKeys, undefined);
  assert.equal(points[4].state.expeditionResult.presentation, undefined);
  assert.equal(points[4].state.expeditionResult.skipRequested, false);
  assert.equal(points[4].state.systemOverlay, null);
  assert.equal(points[4].state.campaign.atomicAvailable, false);
  assert.equal(points[6].state.scene, "map");
  assert.equal(points[6].state.money, 3400);
  assert.equal(points[6].state.campaign.day, 3);
  assert.equal(points[6].state.campaign.atomicAvailable, true);
  assert.ok(points[6].state.campaign.playerCollected.includes(24));
  assert.equal(points[7].state.scene, "title");
  assert.equal(points[7].state.money, 0);
  audio(packet.events, c.device);
  if (c.device !== "muted") {
    assert.throws(
      () =>
        audio(
          packet.events.filter((e) => !e.query),
          c.device,
        ),
      /terminal audio query/,
    );
    const words = packet.events.filter(
      (e) => e.type === "ack" && e.argument === 0x49,
    );
    assert.throws(
      () =>
        audio(
          packet.events.filter((e) => e !== words[1]),
          c.device,
        ),
      /Sound49 call/,
    );
  }
}
const replaySource = await current(m.replayRoot),
  replay = await json(m.replayRoot + "/result.json");
assert.equal(replay.sourceCommit, replaySource.commit);
assert.equal(replay.completed, true);
assert.equal(replay.accepted, true);
assert.equal(replay.checked, 8);
assert.equal(replay.consumed, 488);
assert.equal(replay.semanticNegatives, 1);
assert.equal(replay.restart, true);
const fs = await current(m.failureRoot),
  failure = await json(m.failureRoot + "/acceptance-status.json");
assert.equal(failure.sourceCommit, fs.commit);
assert.equal(failure.accepted, true);
assert.equal(failure.completed, true);
assert.equal(failure.checked, 11);
assert.equal(failure.consumed, 454);
assert.equal(failure.semanticNegatives, 1);
const cs = await current(m.checksRoot),
  checks = await json(m.checksRoot + "/result.json");
assert.equal(checks.sourceCommit, cs.commit);
assert.equal(checks.completed, true);
await checkArtifacts(checks.artifacts);
for (const [name, count] of [
  ["units", 201],
  ["boundaries", 130],
]) {
  const log = await readFile(m.checksRoot + "/" + name + ".log", "utf8");
  for (const [field, n] of [
    ["tests", count],
    ["pass", count],
    ["fail", 0],
    ["skipped", 0],
    ["cancelled", 0],
  ])
    assert.match(log, new RegExp(`(?:ℹ |# )${field} ${n}(?:\\r?\\n|$)`));
}
assert.match(await readFile(m.checksRoot + "/build.log", "utf8"), /built in/);
const proof = spawnSync(
  process.execPath,
  ["scripts/verify-award-presentation-source.js"],
  { encoding: "utf8" },
);
assert.equal(proof.status, 0, proof.stdout + proof.stderr);
process.stdout.write(proof.stdout);
console.log(
  "Award presentation accepted in declared scopes:muted/speaker/Tandy15 exact row groups/75 retraces,queued-key flushes,reward/cue order and map/Restart;strict muted8/488 plus failure11/454;201 units/130 boundaries/build. Full campaign rerecording and native uninterrupted timing remain pending.",
);
