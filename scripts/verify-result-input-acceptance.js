// Saved current-port acceptance; fresh execution commands are in the manifest.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { originalGame } from "../tests/helpers/original-game.js";
import {
  json,
  sha,
  checkSource,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
import {
  acceptedRuntimeSource,
  verifyProtected,
} from "./lib/consumer-provenance.js";
const path =
    process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
    "reference/result-input-acceptance.json",
  m = await json(path);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
for (const [root, commit] of [
  [m.captureRoot, m.captureSourceCommit],
  [m.consumerRoot, m.sourceCommit],
  [m.regressionRoot, m.regressionSourceCommit],
])
  assert.equal((await checkSource(root, acceptedRuntimeSource)).commit, commit);
const r = await json(m.consumerRoot + "/result.json"),
  status = await json(m.captureRoot + "/capture-status.json"),
  events = await json(m.captureRoot + "/captured-events.json"),
  checks = await json(m.captureRoot + "/campaign-checkpoints.json");
assert.equal(r.completed, true);
assert.equal(r.award, true);
assert.equal(r.checked, 27);
assert.equal(r.consumed, 488);
assert.equal(r.restart, true);
assert.equal(r.negativeControls, 1);
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.route, "award");
assert.equal(status.checkpoints, 27);
assert.equal(status.events, 488);
assert.equal(status.restart, true);
assert.equal(events.length, 488);
assert.equal(checks.length, 27);
assert.equal(checks.at(-1).eventCount, 488);
const point = (name) => {
  const rows = checks.filter((c) => c.name === name);
  assert.equal(rows.length, 1);
  return rows[0].state;
};
for (const [prefix, total, phase] of [
  ["award", 280, "award"],
  ["notice", 700, "atomic"],
]) {
  const early = point(prefix + "-before-poll"),
    pause = point(prefix + "-pause"),
    wait = point(prefix + "-waiting"),
    resume = point(prefix + "-resumed"),
    quit = point(prefix + "-quit"),
    no = point(prefix + "-no"),
    neutral = point(prefix + "-neutral");
  assert.equal(early.expeditionResult.phase, phase);
  assert.equal(early.expeditionResult.remaining, total - 6);
  assert.equal(early.systemOverlay, null);
  assert.equal(pause.expeditionResult.remaining, total - 7);
  assert.equal(pause.expeditionResult.waitingForInputPoll, true);
  assert.equal(pause.systemOverlay.kind, "pause");
  assert.equal(wait.expeditionResult.remaining, total - 7);
  assert.equal(wait.systemOverlay.phase, "waiting");
  assert.equal(resume.expeditionResult.remaining, total - 7);
  assert.equal(resume.expeditionResult.skipRequested, false);
  assert.equal(resume.systemOverlay, null);
  assert.equal(quit.expeditionResult.remaining, total - 14);
  assert.equal(quit.systemOverlay.kind, "quit");
  assert.equal(no.expeditionResult.skipRequested, false);
  assert.equal(no.systemOverlay, null);
  assert.equal(neutral.expeditionResult.remaining, total - 21);
  assert.equal(neutral.expeditionResult.phase, phase);
  assert.equal(neutral.systemOverlay, null);
}
assert.equal(point("award-neutral").campaign.atomicAvailable, false);
assert.equal(point("unlock").campaign.atomicAvailable, true);
assert.equal(point("unlock").expeditionResult.remaining, 700);
const final = checks.at(-1).state;
assert.equal(final.scene, "map");
assert.equal(final.money, 3400);
assert.equal(final.campaign.day, 3);
assert.equal(final.campaign.atomicAvailable, true);
assert.deepEqual(final.campaign.playerCollected, [24]);
const reg = await json(m.regressionRoot + "/result.json");
assert.equal(reg.completed, true);
assert.equal(reg.sourceCommit, m.regressionSourceCommit);
assert.equal(reg.componentCases, 8);
assert.equal(reg.componentPresentations, 2696);
assert.deepEqual(reg.headless, { checked: 34, consumed: 4981, rendered: 1470 });
assert.equal(reg.browserCases.length, 15);
assert.equal(
  reg.browserCases.reduce((n, c) => n + c.checked, 0),
  343,
);
assert.equal(
  reg.browserCases.reduce((n, c) => n + c.consumed, 0),
  11601,
);
assert.ok(
  reg.browserCases.every(
    (c) => c.restart === true && c.checked > 0 && c.consumed > 0,
  ),
);
assert.equal(reg.browserCases.at(-1).group, "guide");
assert.equal(reg.producerSources.length, 8);
await verifyProtected(reg.protectedFiles);
for (const [name, count] of [
  ["units", 194],
  ["boundaries", 40],
]) {
  const log = await readFile(m.artifacts[name].path, "utf8");
  for (const [key, value] of [
    ["tests", count],
    ["pass", count],
    ["fail", 0],
    ["cancelled", 0],
    ["skipped", 0],
    ["todo", 0],
  ]) {
    const rows = [
      ...log.matchAll(new RegExp("^(?:ℹ|#) " + key + " (\\d+)\\s*$", "gm")),
    ];
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0][1]), value);
  }
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
assert.match(
  await readFile(m.artifacts["caller-source"].path, "utf8"),
  /567 original bytes/,
);
const audio = await json(m.audioManifest);
assert.equal(audio.cases, 2);
assert.deepEqual(audio.devices, ["speaker", "tandy"]);
assert.equal(
  (await checkSource(m.audioRoot, acceptedRuntimeSource)).commit,
  audio.sourceCommit,
);
for (const device of audio.devices) {
  const p = await json(audio.artifacts[device + ".json"].path);
  assert.equal(p.device, device);
  assert.equal(p.restart, true);
  assert.equal(p.stats.contextState, "running");
  assert.ok(Number(p.stats.signalSamples) > 0);
  const acks = p.events.filter((e) => e.type === "ack");
  assert.deepEqual(
    acks.slice(0, 4).map((e) => e.argument),
    [0, 36, 84, 36],
  );
  assert.equal(acks.filter((e) => e.argument === 36).length, 2);
}
assert.deepEqual(m.exclusions, []);
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.fittedInputs, []);
console.log(
  "Result acceptance verified:27 exact state/image checkpoints,488 DOM events,award40/notice100 controls,collection/unlock/Restart and1 omission negative;15 unchanged routes/343 checkpoints/11601 events,194 units and40 boundary checks;current game runtime unchanged.",
);
