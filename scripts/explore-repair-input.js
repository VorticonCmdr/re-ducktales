// Browser exploration from startup; no restored state, invented outcomes or audio status.
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
const positive = process.argv.includes("--positive"),
  controls = process.argv.includes("--controls");
const root = await fresh(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9),
);
const source = await archiveSource(root),
  m = await json("reference/easy-cave-variants.json");
await checkArtifacts(m.artifacts);
await validateProducerArchive(m.captureRoot);
const checks = await json(m.artifacts["campaign-checkpoints.json"].path);
const events = await json(m.artifacts["captured-events.json"].path);
const entry = positive
  ? checks.at(-1)
  : checks.find((c) => c.name === "departure");
assert.ok(entry);
const result = await withCarlsbadBrowser(
  async ({ page, canvas, state, until, press }) => {
    let now = 1;
    const points = [];
    async function note(name) {
      const p = await observeRecordedRoute({
        page,
        state: await state(),
        name,
      });
      points.push(p);
      console.log(
        name,
        JSON.stringify({
          scene: p.state.scene,
          tick: p.state.tick,
          repairs: p.state.repairs,
          money: p.state.money,
          day: p.state.campaign.day,
          seed: p.state.seed,
          overlay: p.state.systemOverlay,
        }),
      );
    }
    for (const e of events.slice(0, entry.eventCount)) {
      if (e.time > now) await page.clock.runFor(e.time - now);
      now = e.time;
      await recordedDOMInput(page, e);
    }
    await page.clock.runFor(entry.at - now);
    if (positive) {
      assert.equal((await state()).scene, "map");
      assert.equal((await state()).money, 2800);
      const box = await canvas.boundingBox();
      await canvas.click({
        position: { x: (box.width * 37) / 320, y: (box.height * 33) / 200 },
      });
      // Away from the office, map Fire travels directly using the selected aircraft.
      await press("Space");
      await until((s) => s.scene === "departure");
    }
    assert.equal((await state()).scene, "departure");
    assert.equal((await state()).departure.racing, false);
    await press("Space");
    await until((s) => s.scene === "flight");
    await page.keyboard.down("Space");
    await page.clock.runFor(1200);
    await page.keyboard.down("ArrowDown");
    await page.clock.runFor(300);
    await page.keyboard.up("ArrowDown");
    await page.clock.runFor(800);
    await page.keyboard.up("Space");
    await until((s) => s.scene === "crash-repairs");
    assert.equal((await state()).repairs.phase, "repair");
    await note("entry");
    await page.keyboard.press("p");
    await page.clock.runFor(16);
    await note("after-p");
    if (controls) {
      assert.equal((await state()).systemOverlay, null);
      await until((s) => s.systemOverlay?.kind === "pause");
      await note("pause");
      await until((s) => s.systemOverlay?.phase === "waiting");
      await note("pause-waiting");
      await page.keyboard.press("p");
      await until((s) => s.systemOverlay === null);
      await note("resumed");
      await page.keyboard.press("q");
      await page.keyboard.press("Space");
      await until((s) => s.systemOverlay?.kind === "quit");
      await note("quit");
      await page.keyboard.press("n");
      await until((s) => s.systemOverlay === null);
      await note("quit-no");
      const remaining = (await state()).repairs.remaining;
      await until((s) => s.repairs.remaining <= remaining - 7);
      assert.equal((await state()).repairs.phase, "repair");
      await note("neutral");
      await page.keyboard.press("Space");
      if (positive) {
        await until((s) => s.repairs?.phase === "wreckage");
        await note("wreckage");
        const expected = (await state()).money;
        await page.clock.runFor(16);
        assert.equal((await state()).repairs.phase, "wreckage");
        await page.keyboard.press("Space");
        await until((s) => s.scene !== "crash-repairs");
        assert.equal((await state()).money, expected);
      } else await until((s) => s.scene !== "crash-repairs");
      await note("recovered");
      await until((s) =>
        ["cave", "jungle", "mountain", "photography"].includes(s.scene),
      );
      await note("expedition");
    }
    await saveRecordedRoute({
      page,
      root,
      observations: points,
      physical: true,
      scope:
        "Exploratory Easy crash/repair input and recovery;not acceptance or native presentation timing",
    });
    await page.locator("#restart").click();
    await until((s) => s.scene === "title");
    return {
      completed: true,
      accepted: false,
      positive,
      controls,
      checkpoints: points.length,
      events: points.at(-1).eventCount,
      restart: true,
      sourceCommit: source.commit,
    };
  },
);
await checkSource(
  root,
  (p) =>
    p.startsWith("src/") || p.startsWith("scripts/") || p.startsWith("tests/"),
);
await writeFile(
  root + "/capture-status.json",
  JSON.stringify(result, null, 2) + "\n",
);
