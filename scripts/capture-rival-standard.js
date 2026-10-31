// Source-justified correction of two historical claim snapshots. Inputs and
// every old image stay unchanged;the game itself is never restored or patched.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  sha,
  checkArtifacts,
  inventory,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
const root = await fresh(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9),
);
const source = await archiveSource(root),
  rule = await json("reference/rival-standard-comparison.json");
await checkArtifacts({ legacy: rule.legacyManifest, source: rule.sourceRule });
const m = await json(rule.legacyManifest.path);
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.producer);
const events = await json(m.artifacts["captured-events"].path),
  checks = await json(m.artifacts["campaign-checkpoints"].path);
assert.equal(events.length, 5071);
assert.equal(checks.length, 85);
assert.deepEqual(rule.checkpoints, ["safari-flight-return-0", "dialogue-25"]);
const canonical = (v) =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
let result = { completed: false, accepted: false };
try {
  result = await withCarlsbadBrowser(async ({ page, state, until }) => {
    let now = 1,
      consumed = 0,
      corrected = 0;
    const observations = [];
    const advance = async (at) => {
      assert.ok(at >= now);
      if (at > now) await page.clock.runFor(at - now);
      now = at;
    };
    try {
      for (const expected of checks) {
        while (consumed < expected.eventCount) {
          const e = events[consumed++];
          await advance(e.time);
          await recordedDOMInput(page, e);
        }
        await advance(expected.at);
        const actual = await observeRecordedRoute({
          page,
          state: await state(),
          name: expected.name,
        });
        observations.push(actual);
        assert.equal(actual.state.diagnostic, null);
        assert.equal(actual.at, expected.at);
        assert.equal(actual.eventCount, expected.eventCount);
        const projection = structuredClone(actual.state);
        if (rule.checkpoints.includes(expected.name)) {
          assert.equal(expected.state.scene, "rival-claim");
          assert.equal(
            expected.state.campaign.rival.location,
            rule.oldRivalLocation,
          );
          assert.equal(
            actual.state.campaign.rival.location,
            rule.correctRivalLocation,
          );
          assert.equal(actual.state.departure.from, rule.correctRivalLocation);
          assert.equal(actual.state.departure.target, rule.oldRivalLocation);
          assert.deepEqual(
            actual.state.claim,
            rule.claim,
            "Original entry reader state",
          );
          delete projection.claim;
          projection.campaign.rival.location = rule.oldRivalLocation;
          corrected++;
        }
        assert.equal(
          sha(canonical(projection)),
          expected.stateSha256,
          "Unjustified Standard difference " + expected.name,
        );
        assert.equal(
          actual.pixelsSha256,
          expected.pixelsSha256,
          "Changed Standard pixels " + expected.name,
        );
        console.log("Rival Standard " + expected.name);
      }
      assert.equal(consumed, events.length);
      assert.equal(corrected, 2);
      await saveRecordedRoute({
        page,
        root,
        observations,
        difficulty: 1,
        physical: true,
        scope:
          "Full Standard port regression capture;only two source-justified claim snapshot corrections,new claim state asserted,all old inputs/images preserved. Not self-acceptance/native parity.",
      });
      await page.locator("#restart").click();
      await until((s) => s.scene === "title");
      assert.equal((await state()).money, 0);
      assert.equal((await state()).campaign.banked, 0);
      return {
        completed: true,
        accepted: false,
        checkpoints: observations.length,
        events: consumed,
        sourceCorrections: corrected,
        restart: true,
        sourceCommit: source.commit,
      };
    } catch (error) {
      observations.push(
        await observeRecordedRoute({
          page,
          state: await state(),
          name: "failure",
        }),
      );
      await saveRecordedRoute({
        page,
        root,
        observations,
        difficulty: 1,
        physical: true,
        scope: "FAILED source-corrected Standard exploration;not acceptance",
      });
      throw error;
    }
  });
  await checkSource(
    root,
    (p) =>
      p.startsWith("src/") ||
      p.startsWith("scripts/") ||
      p.startsWith("tests/") ||
      [
        "index.html",
        "package.json",
        "package-lock.json",
        "vite.config.js",
        "vite.campaign.config.js",
        "reference/build.json",
      ].includes(p),
  );
  result.artifacts = await inventory(root, [
    "source-revision.json",
    "sources.zip",
    "environment.json",
    "captured-events.json",
    "campaign-checkpoints.json",
    "timeline.json",
  ]);
} finally {
  await writeFile(
    root + "/capture-status.json",
    JSON.stringify(result, null, 2) + "\n",
  );
}
console.log(JSON.stringify(result));
