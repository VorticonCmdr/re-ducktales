// Explore actual browser controls from an immutable simulation-authored player
// schedule. Capturing browser outputs never certifies them as original parity.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { fresh, archiveSource, checkSource, json, sha, checkArtifacts, inventory } from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { observeRecordedRoute, saveRecordedRoute } from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const arg = (k) => process.argv.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
const output = await fresh(arg("output")), source = await archiveSource(output);
const prefix = await json("reference/standard-wages-route.json");
await checkArtifacts(prefix.artifacts);
await validateProducerArchive(prefix.producer);
const planning = arg("plan");
assert.ok(planning, "SETUP: --plan required");
await validateProducerArchive(planning);
const plan = await json(planning + "/planning.json");
assert.equal(plan.completed, true);
assert.equal(plan.accepted, false);
assert.equal(plan.final.scene, "ending");
assert.equal(plan.final.difficulty, 1);
assert.ok(plan.final.ending.ready);
const prefixEvents = await json(prefix.artifacts["captured-events"].path);
const prefixChecks = await json(prefix.artifacts["campaign-checkpoints"].path);
const schedule = [...prefixEvents, ...plan.events];
assert.ok(plan.events.length > 0 && plan.points.length > 0);
assert.ok(plan.events[0].time > prefixChecks.at(-1).at);
const checks = [...prefixChecks.map((p) => ({ ...p, prefix: true })),
  ...plan.points.map((p) => ({ ...p, name: "continued-" + p.name, eventCount: p.eventCount + prefixEvents.length }))];
assert.equal(checks.at(-1).eventCount, schedule.length, "Unfinished planned inputs");
const canonical = (v) => JSON.stringify(v, (_, x) => x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);
let result = { completed: false, accepted: false };
try {
  result = await withCarlsbadBrowser(async ({ page, state, until }) => {
    let now = 1, consumed = 0;
    const observations = [];
    async function advance(at) {
      assert.ok(at >= now, "Unordered campaign schedule");
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    }
    try {
      for (const expected of checks) {
        while (consumed < expected.eventCount) {
          const event = schedule[consumed++];
          await advance(event.time);
          await recordedDOMInput(page, event);
        }
        await advance(expected.at);
        const actual = await observeRecordedRoute({ page, state: await state(), name: expected.name });
        observations.push(actual);
        assert.equal(actual.state.diagnostic, null);
        assert.equal(actual.eventCount, expected.eventCount);
        // Planning is conditional evidence until this independent browser
        // executes it. Require complete state equality,not only the outcome.
        assert.equal(actual.stateSha256, expected.stateSha256 ?? sha(canonical(expected.state)),
          "Browser/planner state " + expected.name);
        if (expected.prefix) assert.equal(actual.pixelsSha256, expected.pixelsSha256,
          "Immutable prefix pixels " + expected.name);
        console.log("Campaign browser " + expected.name);
      }
      assert.equal(consumed, schedule.length);
      const final = await state();
      assert.equal(final.scene, "ending");
      assert.equal(final.difficulty, 1);
      assert.equal(final.ending.ready, true);
      assert.equal(final.jungle.outcome.code, 1);
      assert.equal(final.mountain.outcome.code, 1);
      assert.equal(final.cave.outcome.code, 1);
      assert.ok(final.photography.photos.includes(final.photography.target));
      assert.ok(final.campaign.day >= 30);
      await saveRecordedRoute({ page, root: output, observations, difficulty: 1, physical: true,
        scope: "Exploratory full Standard campaign with all four expedition types and natural defeat ending;not self-acceptance or native parity" });
      await page.locator("#restart").click();
      await until((s) => s.scene === "title");
      assert.equal((await state()).campaign.banked, 0);
      assert.equal((await state()).money, 0);
      return { completed: true, accepted: false, checkpoints: observations.length, events: consumed,
        restart: true, sourceCommit: source.commit, endingWon: final.ending.won,
        banked: final.campaign.banked, rivalBanked: final.campaign.rival.banked, day: final.campaign.day };
    } catch (error) {
      observations.push(await observeRecordedRoute({ page, state: await state(), name: "failure" }));
      await saveRecordedRoute({ page, root: output, observations, difficulty: 1, physical: true,
        scope: "FAILED Standard full campaign browser exploration;not acceptance" });
      throw error;
    }
  });
  await checkSource(output, (p) => p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/") ||
    ["index.html", "package.json", "package-lock.json", "vite.config.js", "vite.campaign.config.js", "reference/build.json"].includes(p));
  result.artifacts = await inventory(output, ["source-revision.json", "sources.zip", "environment.json", "captured-events.json", "campaign-checkpoints.json", "timeline.json"]);
} finally {
  await writeFile(output + "/capture-status.json", JSON.stringify(result, null, 2) + "\n");
}
console.log(JSON.stringify(result));
