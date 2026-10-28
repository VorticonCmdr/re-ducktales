import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
import { openRecordedApplication } from "./helpers/clock.js";
import {
  installEntryRecording,
  saveEntryRecording,
  canonical,
  digest,
} from "./helpers/entry-recording.js";
import entry from "../../reference/security-jungle-entry.json" with { type: "json" };
import { PNG } from "pngjs";

test("jungle defers global keys, pauses actors and resumes cancelled quit", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until, state });
  expect(
    await bankTrips({ page, canvas, state, until, press, count: 2 }),
  ).toEqual([
    { day: 7, seed: 62042 },
    { day: 13, seed: 19313 },
  ]);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 64) / 320, y: (bounds.height * 73) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).departure.racing).toBe(false);
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  const entered = await until((s) => s.scene === "jungle");
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
  await page.keyboard.press("p");
  await page.keyboard.press("s");
  await page.clock.runFor(1200);
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
