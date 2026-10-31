// Saved evidence checks; fresh browser execution is the manifest's repeat command.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  json,
  sha,
  checkArtifacts,
  checkSource,
} from "./lib/local-scenario-source.js";
import {
  acceptedRuntimeSource,
  verifyProtected,
} from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
const path =
    process.argv.find((a) => a.startsWith("--manifest="))?.slice(11) ??
    "reference/guide-input-acceptance.json",
  m = await json(path);
assert.equal(sha(await readFile(m.buildManifest)), m.buildManifestSha256);
await originalGame();
await checkArtifacts(m.artifacts);
for (const [root, commit] of [
  [m.captureRoot, m.captureSourceCommit],
  [m.consumerRoot, m.sourceCommit],
  [m.regressionRoot, m.regressionSourceCommit],
]) {
  const s = await checkSource(root, acceptedRuntimeSource);
  assert.equal(s.commit, commit);
}
const r = await json(m.consumerRoot + "/result.json"),
  status = await json(m.captureRoot + "/capture-status.json"),
  events = await json(m.captureRoot + "/captured-events.json"),
  checks = await json(m.captureRoot + "/campaign-checkpoints.json");
assert.equal(r.completed, true);
assert.equal(r.guide, true);
assert.equal(r.report, true);
assert.equal(r.checked, 30);
assert.equal(r.consumed, 506);
assert.equal(r.negativeControls, 1);
assert.equal(r.restart, true);
assert.equal(status.completed, true);
assert.equal(status.accepted, false);
assert.equal(status.route, "guide");
assert.equal(status.checkpoints, 30);
assert.equal(status.events, 506);
assert.equal(status.restart, true);
assert.equal(events.length, 506);
assert.equal(checks.length, 30);
assert.equal(checks.at(-1).eventCount, 506);
const point = (name) => {
  const rows = checks.filter((c) => c.name === name);
  assert.equal(rows.length, 1);
  return rows[0].state;
};
const arrive = point("arrival"),
  early = point("guide-before-poll"),
  pause = point("guide-pause"),
  wait = point("guide-waiting"),
  resume = point("guide-resumed"),
  quit = point("guide-quit"),
  no = point("guide-quit-no"),
  neutral = point("guide-neutral-after-no");
assert.equal(arrive.briefing.remaining, 210);
assert.equal(early.briefing.remaining, 204);
assert.equal(early.systemOverlay, null);
assert.equal(pause.briefing.remaining, 203);
assert.equal(pause.briefing.waitingForInputPoll, true);
assert.equal(pause.systemOverlay.kind, "pause");
assert.equal(pause.tick - arrive.tick, 7);
assert.equal(wait.briefing.remaining, 203);
assert.equal(wait.systemOverlay.phase, "waiting");
assert.equal(resume.briefing.remaining, 203);
assert.equal(resume.systemOverlay, null);
assert.equal(quit.briefing.remaining, 196);
assert.equal(quit.systemOverlay.kind, "quit");
assert.equal(no.briefing.remaining, 196);
assert.equal(no.systemOverlay, null);
assert.equal(neutral.scene, "expedition-briefing");
assert.equal(neutral.briefing.remaining, 189);
assert.equal(neutral.systemOverlay, null);
for (const s of [early, pause, wait, resume, quit, no, neutral]) {
  assert.equal(s.briefing.seed, arrive.briefing.seed);
  assert.equal(s.briefing.clue, arrive.briefing.clue);
}
const final = checks.at(-1).state;
assert.equal(final.scene, "jungle");
assert.equal(final.campaign.location, 1);
assert.equal(final.campaign.day, 6);
assert.equal(final.money, 3400);
assert.equal(final.systemOverlay, null);
const regression = await json(m.regressionRoot + "/result.json");
assert.equal(regression.completed, true);
assert.equal(regression.sourceCommit, m.regressionSourceCommit);
assert.equal(regression.componentCases, 8);
assert.equal(regression.componentPresentations, 2696);
assert.deepEqual(regression.headless, {
  checked: 34,
  consumed: 4981,
  rendered: 1470,
});
assert.equal(regression.browserCases.length, 14);
assert.equal(
  regression.browserCases.reduce((n, c) => n + c.checked, 0),
  313,
);
assert.equal(
  regression.browserCases.reduce((n, c) => n + c.consumed, 0),
  11095,
);
assert.ok(
  regression.browserCases.every(
    (c) => c.restart === true && c.checked > 0 && c.consumed > 0,
  ),
);
assert.deepEqual(
  regression.browserCases.slice(-2).map((c) => c.group),
  ["atomic-success", "atomic-report"],
);
assert.equal(regression.producerSources.length, 7);
await verifyProtected(regression.protectedFiles);
for (const [name, count] of [
  ["units", 194],
  ["boundaries", 22],
]) {
  const log = await readFile(m.artifacts[name].path, "utf8");
  assert.match(log, new RegExp("tests\\s+" + count));
  assert.match(log, /fail\s+0/);
  assert.match(log, /skipped\s+0/);
}
assert.match(await readFile(m.artifacts.build.path, "utf8"), /built in/);
assert.deepEqual(m.exclusions, []);
assert.deepEqual(m.memoryInjections, []);
assert.deepEqual(m.fittedInputs, []);
console.log(
  "Guide acceptance verified:30 exact state/image checkpoints,506 DOM events,Pause/Quit-No/fresh Fire,Restart and1 omission negative;14 preserved browser routes/313 checkpoints/11095 events,8 cave components,194 units and22 boundary checks;current game runtime unchanged.",
);
