// Explore an unread key in09f5's final wait,then the office's first reader.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  fresh,
  archiveSource,
  checkSource,
  json,
  checkArtifacts,
} from "./lib/local-scenario-source.js";
import { validateProducerArchive } from "./lib/consumer-provenance.js";
import { withCarlsbadBrowser } from "./lib/carlsbad-browser.js";
import {
  observeRecordedRoute,
  saveRecordedRoute,
} from "../tests/browser/helpers/entry-recording.js";
import { recordedDOMInput } from "../tests/browser/helpers/recorded-dom-input.js";
const arg = (k) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const after = process.argv.includes("--after"),
  root = await fresh(arg("output")),
  source = await archiveSource(root);
const m = await json("reference/broker-input-browser.json"),
  c = m.cases.find((c) => c.key === "fire");
assert.ok(c);
await checkArtifacts(c.artifacts);
await validateProducerArchive(c.producer);
const checks = await json(c.artifacts["campaign-checkpoints"].path),
  events = await json(c.artifacts["captured-events"].path),
  entry = checks.find((c) => c.name === "entry");
assert.ok(entry);
const result = await withCarlsbadBrowser(async ({ page, state, until }) => {
  const points = [];
  const note = async (name) =>
    points.push(
      await observeRecordedRoute({ page, state: await state(), name }),
    );
  let now = 1;
  for (const e of events.slice(0, entry.eventCount)) {
    if (e.time > now) await page.clock.runFor(e.time - now);
    now = e.time;
    await recordedDOMInput(page, e);
  }
  await page.clock.runFor(entry.at - now);
  await until(
    (s) => s.scene === "investments" && s.investments.remaining === 7,
  );
  await note("final-wait");
  await page.keyboard.press("p");
  await page.clock.runFor(16);
  assert.equal((await state()).systemOverlay, null);
  await note("queued");
  await until((s) => s.scene === "office");
  await note("office-entry");
  await until((s) => s.systemOverlay?.kind === "pause" || s.officeMenu.ready);
  await note("first-office-read");
  if (after) {
    assert.equal(
      (await state()).systemOverlay?.kind,
      "pause",
      "Unread broker P was lost before office reader",
    );
    await until((s) => s.systemOverlay.phase === "waiting");
    await page.keyboard.press("p");
    await until((s) => !s.systemOverlay);
    assert.equal((await state()).scene, "office");
    await note("resumed");
  }
  await saveRecordedRoute({
    page,
    root,
    observations: points,
    difficulty: 0,
    physical: true,
    scope:
      "Broker final-wait P to office first reader;port capture,not native presentation timing",
  });
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  return {
    completed: true,
    accepted: false,
    after,
    checkpoints: points.length,
    events: points.at(-1).eventCount,
    observed: points[3].state.systemOverlay,
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
console.log(JSON.stringify(result));
