// Real browser observation from startup;no checkpoint restore or game patch.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  json,
  checkArtifacts,
  checkSource,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const forced = process.argv.includes("--forced"),
  root = await fresh(
    process.argv.find((a) => a.startsWith("--output="))?.slice(9),
  );
const source = await archiveSource(root),
  m = await json("reference/standard-wages-full-route.json");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.producer);
const checks = await json(m.artifacts["campaign-checkpoints"].path),
  events = await json(m.artifacts["captured-events"].path);
const entry = forced
  ? checks.find((c) => c.name === "safari-flight-return-0")
  : checks.find((c) => c.state.scene === "rival-report");
assert.ok(entry);
const result = await withCarlsbadBrowser(async ({ page, state, until }) => {
  let now = 1;
  const points = [];
  const note = async (name) => {
    const p = await observeRecordedRoute({ page, state: await state(), name });
    points.push(p);
    console.log(
      name,
      JSON.stringify({
        scene: p.state.scene,
        tick: p.state.tick,
        report: p.state.rivalReport,
        overlay: p.state.systemOverlay,
        rival: p.state.campaign.rival,
      }),
    );
  };
  for (const e of events.slice(0, entry.eventCount)) {
    if (e.time > now) await page.clock.runFor(e.time - now);
    now = e.time;
    await recordedDOMInput(page, e);
  }
  await page.clock.runFor(entry.at - now);
  assert.equal((await state()).scene, forced ? "rival-claim" : "rival-report");
  await note("entry");
  await page.keyboard.press("p");
  await page.clock.runFor(16);
  await note("after-p");
  await saveRecordedRoute({
    page,
    root,
    observations: points,
    difficulty: 1,
    physical: true,
    scope:
      "Exploratory muted rival report/forced claim P boundary;not acceptance or native timing",
  });
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  return {
    completed: true,
    accepted: false,
    forced,
    checkpoints: points.length,
    events: points.at(-1).eventCount,
    restart: true,
    sourceCommit: source.commit,
  };
});
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/"),
);
await writeFile(
  root + "/capture-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
