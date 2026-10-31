// Strict port regression of independent DOM events;not native timing evidence.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fresh, archiveSource, json, checkArtifacts, checkSource, inventory } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { observeRecordedRoute } from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const arg = (k) => process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
const m = await json(arg("manifest") ?? "reference/cave-failure-input-browser.json");
assert.equal(m.kind, "cave-failure-input-port-regression");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.producer);
await originalGame();
const load = (name) => json(m.artifacts[name].path);
const [events, checks, environment, timeline, capture] = await Promise.all(
  ["captured-events", "campaign-checkpoints", "environment", "timeline", "capture-status"].map(load));
assert.equal(capture.completed, true);
assert.equal(capture.accepted, false);
assert.equal(capture.restart, true);
assert.ok(events.length > 0 && checks.length > 0, "Zero cases");
assert.equal(events.length, m.requiredEventCount);
assert.equal(checks.length, m.expectedCheckpointCount);
assert.equal(events.length, capture.events);
assert.equal(checks.length, capture.checkpoints);
assert.equal(checks.at(-1).eventCount, events.length, "Unfinished input sequence");
assert.deepEqual(checks.map((c) => c.name), ["entry", "failure", "after-p", "pause", "pause-waiting", "resumed", "quit", "quit-no", "neutral", "map", "retry-cave"]);
assert.equal(environment.difficulty, 0);
assert.equal(environment.physical, true);
assert.equal(environment.clockOrigin, 1);
assert.equal(environment.displayMilliseconds, 8);
assert.equal(environment.capturePhase, "before-target-handler");
assert.equal(timeline.endAt, checks.at(-1).at);
assert.equal(timeline.clockOrigin, 1);
assert.equal(timeline.displayMilliseconds, 8);
assert.deepEqual(timeline.observations, checks.map(({ name, at, eventCount }) => ({ name, at, eventCount })));
for (let i = 0; i < events.length; i++) assert.ok(Number.isFinite(events[i].time) && events[i].time >= 1 &&
  events[i].time <= timeline.endAt && (!i || events[i].time >= events[i - 1].time), "Unordered/unconsumable event");
const root = await fresh(arg("output")), source = await archiveSource(root);
async function replay(omitPause = false) {
  return withCarlsbadBrowser(async ({ page, state, until }) => {
    let now = 1, consumed = 0, checked = 0, omitted = 0;
    const pause = events.findIndex((e, i) => i >= checks.find((c) => c.name === "failure").eventCount &&
      e.type === "keydown" && e.key === "p");
    assert.ok(pause >= 0, "Missing required Pause make");
    async function advance(at) { assert.ok(at >= now, "Late event/checkpoint");
      if (at > now) await page.clock.runFor(at - now); now = at; }
    for (const expected of checks) {
      assert.ok(expected.eventCount >= consumed && expected.eventCount <= events.length);
      while (consumed < expected.eventCount) {
        const e = events[consumed]; await advance(e.time);
        if (omitPause && consumed === pause) omitted++;
        else await recordedDOMInput(page, e);
        consumed++;
      }
      await advance(expected.at);
      const actual = await observeRecordedRoute({ page, state: await state(), name: expected.name });
      assert.equal(actual.state.diagnostic, null);
      assert.equal(actual.at, expected.at);
      assert.equal(actual.stateSha256, expected.stateSha256, "Cave failure state " + expected.name);
      assert.equal(actual.pixelsSha256, expected.pixelsSha256, "Cave failure pixels " + expected.name);
      assert.equal(actual.eventCount, expected.eventCount - omitted, "Unconsumed DOM events");
      checked++; console.log("Cave failure checkpoint " + expected.name);
    }
    assert.equal(consumed, events.length);
    assert.equal(checked, checks.length);
    assert.equal(now, timeline.endAt);
    const s = await state(); assert.equal(s.scene, "cave"); assert.equal(s.flight, null);
    assert.equal(s.departure, null); assert.equal(s.campaign.atomicAvailable, false);
    assert.deepEqual(s.campaign.playerCollected, []);
    const failed = checks.find((c) => c.name === "failure").state;
    assert.equal(s.money, failed.money); assert.equal(s.campaign.day, failed.campaign.day + 1);
    await page.locator("#restart").click(); await until((s) => s.scene === "title");
    assert.equal((await state()).campaign.day, 1); assert.equal((await state()).money, 0);
    return { checked, consumed, restart: true };
  });
}
let result = { completed: false, accepted: false };
try {
  const positive = await replay();
  await assert.rejects(() => replay(true), /Cave failure state pause/);
  await checkSource(root, (p) => p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/") ||
    ["index.html", "package.json", "package-lock.json", "vite.config.js", "vite.campaign.config.js", "reference/build.json"].includes(p));
  await checkArtifacts(m.artifacts);
  result = { completed: true, accepted: true, nativeComparison: false, ...positive,
    semanticNegatives: 1, sourceCommit: source.commit, producer: m.producer,
    artifacts: await inventory(root, ["source-revision.json", "sources.zip"]) };
} finally { await writeFile(root + "/acceptance-status.json", JSON.stringify(result, null, 2) + "\n"); }
console.log(JSON.stringify(result));
