// A recorded port regression, not a native DOS timing comparison. The explorer
// chooses player controls; this consumer reads only its independent event stream.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { observeRecordedRoute } from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
import { originalGame } from "../tests/helpers/original-game.js";
import { fresh, archiveSource, checkSource, json, checkArtifacts, inventory, sha } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";

const arg = (key) => process.argv.find((a) => a.startsWith("--" + key + "="))?.slice(key.length + 3);
const manifest = await json(arg("manifest") ?? "reference/standard-wages-route.json");
assert.ok(["standard-cave-safari-port-regression", "standard-full-campaign-port-regression"].includes(manifest.kind));
const full = manifest.kind === "standard-full-campaign-port-regression";
assert.equal(manifest.difficulty, 1);
assert.equal(manifest.physicalKeyboard, true);
assert.equal(manifest.nativeComparison, false);
await checkArtifacts(manifest.artifacts);
await validateProducerArchive(manifest.producer);
await originalGame(); // Fail setup if any of the supported original files differ.
const load = (name) => json(manifest.artifacts[name].path);
const [environment, events, checks, timeline, status] = await Promise.all(
  ["environment", "captured-events", "campaign-checkpoints", "timeline", full ? "capture-status" : "exploration-status"].map(load));
assert.equal(status.completed, true);
assert.equal(status.accepted, false, "Producer is exploration, never self-acceptance");
assert.equal(status.restart, true);
assert.equal(environment.difficulty, 1);
assert.equal(environment.physical, true);
assert.equal(environment.hard, false);
assert.equal(environment.clockOrigin, 1);
assert.equal(environment.displayMilliseconds, 8);
assert.equal(environment.capturePhase, "before-target-handler");
assert.ok(events.length > 0 && checks.length > 0, "Zero cases");
assert.equal(events.length, manifest.requiredEventCount);
assert.equal(events.length, status.events);
assert.equal(checks.length, manifest.expectedCheckpointCount);
assert.equal(checks.length, status.checkpoints);
assert.deepEqual(checks.map((c) => c.name), manifest.checkpointNames);
assert.equal(checks.at(-1).eventCount, events.length, "Unfinished input stream");
assert.equal(timeline.clockOrigin, environment.clockOrigin);
assert.equal(timeline.displayMilliseconds, environment.displayMilliseconds);
assert.equal(timeline.endAt, checks.at(-1).at);
assert.deepEqual(timeline.observations, checks.map(({ name, at, eventCount }) => ({ name, at, eventCount })));
const canonical = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
for (let i = 0; i < events.length; i++) {
  const e = events[i];
  assert.ok(Number.isFinite(e.time) && e.time >= environment.clockOrigin && e.time <= timeline.endAt &&
    (!i || e.time >= events[i - 1].time), "Unordered or unconsumable event");
}
for (const c of checks) {
  assert.equal(sha(canonical(c.state)), c.stateSha256, "Corrupt expected state " + c.name);
  assert.equal(c.state.diagnostic, null);
}
const output = await fresh(arg("output"));
const source = await archiveSource(output);
async function replay(omitDifficulty = false) {
  return withCarlsbadBrowser(async ({ page, state, until }) => {
    let now = environment.clockOrigin, consumed = 0, checked = 0, omitted = 0;
    const choice = events.findIndex((e) => e.type === "keydown" && e.key === "ArrowDown");
    assert.ok(choice >= 0 && choice < checks[0].eventCount, "Missing startup Standard selection");
    async function advance(at) {
      assert.ok(Number.isFinite(at) && at >= now, "Late recorded event/checkpoint");
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    }
    for (const expected of checks) {
      assert.ok(expected.eventCount >= consumed && expected.eventCount <= events.length,
        "Unconsumable checkpoint");
      while (consumed < expected.eventCount) {
        const event = events[consumed];
        await advance(event.time);
        if (omitDifficulty && consumed === choice) omitted++;
        else await recordedDOMInput(page, event);
        consumed++;
      }
      await advance(expected.at);
      const actual = await observeRecordedRoute({ page, state: await state(), name: expected.name });
      assert.equal(actual.state.diagnostic, null);
      assert.equal(actual.at, expected.at);
      assert.equal(actual.stateSha256, expected.stateSha256, "Standard state " + expected.name);
      assert.equal(actual.pixelsSha256, expected.pixelsSha256, "Standard pixels " + expected.name);
      assert.equal(actual.eventCount, expected.eventCount - omitted, "Unconsumed DOM input");
      checked++;
      console.log("Standard checkpoint " + expected.name);
    }
    assert.equal(consumed, events.length);
    assert.equal(checked, manifest.expectedCheckpointCount);
    assert.equal(now, timeline.endAt);
    const final = await state();
    assert.equal(final.difficulty, 1);
    assert.equal(final.scene, full ? "ending" : "map");
    assert.equal(final.money, 0);
    assert.ok(final.campaign.banked > 3400, "Safari earnings were not banked");
    assert.equal(final.cave.outcome.code, 1);
    assert.ok(final.photography.photos.includes(final.photography.target), "Missing target photo");
    if (full) {
      assert.equal(final.jungle.outcome.code, 1);
      assert.equal(final.mountain.outcome.code, 1);
      assert.equal(final.jungle.lives, 3);
      assert.equal(final.mountain.lives, 3);
      assert.deepEqual({ day: final.campaign.day, banked: final.campaign.banked,
        rivalBanked: final.campaign.rival.banked, playerCollected: final.campaign.playerCollected,
        won: final.ending.won, ready: final.ending.ready }, manifest.expectedOutcome,
      "Unfinished full Standard campaign");
    }
    assert.equal(final.systemOverlay, null);
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    assert.equal((await state()).money, 0);
    assert.equal((await state()).campaign.banked, 0);
    return { checked, consumed, restart: true };
  });
}
let result = { completed: false, accepted: false };
try {
  const positive = await replay();
  await assert.rejects(() => replay(true), /Standard state standard-choice/,
    "Removing Standard selection must change the compared state");
  await checkSource(output, (p) => p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/") ||
    ["index.html", "package.json", "package-lock.json", "vite.config.js", "vite.campaign.config.js", "reference/build.json"].includes(p));
  await checkArtifacts(manifest.artifacts);
  result = { completed: true, accepted: true, scope: manifest.scope, nativeComparison: false,
    ...positive, semanticNegatives: 1, sourceCommit: source.commit,
    producer: manifest.producer,
    artifacts: await inventory(output, ["source-revision.json", "sources.zip"]) };
} finally {
  await writeFile(output + "/acceptance-status.json", JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify(result));
