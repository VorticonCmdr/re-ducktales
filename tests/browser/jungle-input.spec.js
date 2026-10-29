import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { easyJungleEntry } from "./helpers/easy-jungle-entry.js";
import { openRecordedApplication } from "./helpers/clock.js";
import {
  installEntryRecording,
  saveEntryRecording,
  canonical,
  digest,
} from "./helpers/entry-recording.js";
import historicalEntry from "../../reference/office-jungle-entry.json" with { type: "json" };
import { readFile } from "node:fs/promises";
const entry = process.env.DUCKTALES_JUNGLE_ENTRY_MANIFEST
  ? JSON.parse(
      await readFile(process.env.DUCKTALES_JUNGLE_ENTRY_MANIFEST, "utf8"),
    )
  : historicalEntry;
import { PNG } from "pngjs";

test("jungle defers global keys, pauses actors and resumes cancelled quit", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.DUCKTALES_JUNGLE_TIMING_BROWSER_NEGATIVE) {
    expect(process.env.DUCKTALES_JUNGLE_TIMING_BROWSER_NEGATIVE).toBe(
      "zero-work",
    );
    await page.route("**/src/game/jungle.js*", async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const source = "until: this.now() + milliseconds";
      expect(body, "SETUP: missing jungle timing hook").toContain(source);
      await route.fulfill({
        response,
        body: body.replace(source, "until: this.now()"),
      });
    });
  }
  // Only the external clock and real keyboard adapter are supplied. The8ms
  // display cadence observes every input sample without changing game clocks.
  await installEntryRecording(page);
  await openRecordedApplication(page, 1);
  // Keep simulation time frozen while original resources load. Otherwise host
  // I/O latency silently changes the scheduler origin of the recorded stream.
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 3000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `unfinished jungle browser wait:${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  const entered = await easyJungleEntry({ page, canvas, state, until, press });
  if (process.env.DUCKTALES_CAPTURE_JUNGLE_ENTRY) {
    await saveEntryRecording({
      page,
      canvas,
      state: entered,
      root: process.env.DUCKTALES_CAPTURE_JUNGLE_ENTRY,
      name: "jungle-entry",
    });
    throw Error("EXPLORATORY jungle entry saved; this run is not acceptance");
  }
  expect({
    location: entered.campaign.location,
    day: entered.campaign.day,
    money: entered.money,
    briefingSeed: entered.briefing.seed,
    jungleSeed: entered.jungle.seed,
    frames: entered.jungle.frames,
  }).toEqual(entry.entry);
  expect(digest(canonical(entered))).toBe(entry.entryStateSha256);
  const pixels = PNG.sync.read(
    Buffer.from(
      (await canvas.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  expect(digest(pixels.data)).toBe(entry.entryPixelsSha256);
  expect(entered.briefing.variant).toBe(0);
  const firstDrawing = await until((s) => s.jungle.frames === 1);
  expect(firstDrawing.jungle.drawingWork.milliseconds).toBeGreaterThan(140);
  const drawingAt = await page.evaluate(() => performance.now());
  await page.keyboard.press("p");
  await page.keyboard.press("s");
  const secondDrawing = await until((s) => s.jungle.frames === 2);
  const secondAt = await page.evaluate(() => performance.now());
  // First drawing precedes two 25-retrace page sequences. Capture alignment
  // is bounded by the external 8 ms observer and one retrace/driver interval.
  expect(
    secondAt - drawingAt,
    "Jungle first redraw duration",
  ).toBeGreaterThanOrEqual(
    firstDrawing.jungle.drawingWork.milliseconds + (49 * 1000) / 70.086 - 8,
  );
  expect(
    secondAt - drawingAt,
    "Jungle first redraw duration",
  ).toBeLessThanOrEqual(
    firstDrawing.jungle.drawingWork.milliseconds + (50 * 1000) / 70.086 + 22,
  );
  await until((s) => s.jungle.frames === 3);
  const thirdAt = await page.evaluate(() => performance.now());
  expect(
    thirdAt - secondAt,
    "Jungle ordinary redraw duration",
  ).toBeGreaterThanOrEqual(secondDrawing.jungle.drawingWork.milliseconds - 8);
  expect(
    thirdAt - secondAt,
    "Jungle ordinary redraw duration",
  ).toBeLessThanOrEqual(
    secondDrawing.jungle.drawingWork.milliseconds + 1000 / 70.086 + 8,
  );
  let current = await state();
  expect(current.scene).toBe("jungle");
  expect(current.systemOverlay).toBeNull();
  await expect(page.locator("#audio")).not.toBeChecked();
  await page.keyboard.press("p");
  const paused = await until((s) => s.systemOverlay?.kind === "pause");
  expect(paused.jungle.waitingForInputPoll).toBe(true);
  const pausedPixels = await canvas.screenshot();
  const actorFields = [
    "x",
    "y",
    "action",
    "frame",
    "seed",
    "frames",
    "presentations",
  ];
  await page.keyboard.press("s");
  await page.clock.runFor(800);
  const waiting = await state();
  expect(waiting.systemOverlay.phase).toBe("waiting");
  for (const field of actorFields)
    expect(waiting.jungle[field]).toEqual(paused.jungle[field]);
  expect(waiting.jungle.tick).toBeGreaterThan(paused.jungle.tick);
  expect(waiting.jungle.retrace).toBeGreaterThan(paused.jungle.retrace);
  expect(await canvas.screenshot()).toEqual(pausedPixels);
  await expect(page.locator("#audio")).not.toBeChecked();
  await canvas.screenshot({
    path: ".local/browser-results/jungle-input-pause.png",
  });
  await page.keyboard.press("p");
  await until((s) => !s.systemOverlay);
  await page.keyboard.press("q");
  await until((s) => s.systemOverlay?.kind === "quit");
  await page.keyboard.press("n");
  current = await until((s) => !s.systemOverlay);
  expect(current.scene).toBe("jungle");
  await page.keyboard.press("s");
  await page.clock.runFor(200);
  await expect(page.locator("#audio")).toBeChecked();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
