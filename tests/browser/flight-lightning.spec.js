import profile from "../../reference/lightning-flight-inputs.json" with { type: "json" };
import { replayFlightInputs } from "./helpers/flight-inputs.js";
import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { openRecordedApplication } from "./helpers/clock.js";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
import {
  installEntryRecording,
  observeRecordedRoute,
  saveRecordedRoute,
} from "./helpers/entry-recording.js";
import manifest from "../../reference/flight-lightning-input.json" with { type: "json" };

test("natural lightning clears held flight controls and fresh keyboard input recovers", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors = [],
    trace = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await installEntryRecording(page);
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game"),
    state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 10000) {
    for (let n = 0; n < max; n++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished lightning scenario: ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).not.toBeChecked();
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
  const r = await canvas.boundingBox();
  await canvas.click({
    position: { x: (r.width * 68) / 320, y: (r.height * 77) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).departure.racing).toBe(false);
  if (process.env.DUCKTALES_CAPTURE_LIGHTNING_ENTRY) {
    const point = await observeRecordedRoute({
      page,
      state: await state(),
      name: "departure",
    });
    await saveRecordedRoute({
      page,
      root: process.env.DUCKTALES_CAPTURE_LIGHTNING_ENTRY,
      observations: [point],
      scope:
        "Exploratory security-aware nonracing lightning departure;not acceptance",
    });
    throw Error("EXPLORATORY lightning departure saved;not acceptance");
  }

  const observed = await replayFlightInputs({
    page,
    until,
    profile,
    release: false,
  });
  trace.push(...observed);
  // The last physical Space+Down hold remains. No input follows until the
  // generated strike clears the translated keyboard matrix itself.
  const atStrike = await until((s) => s.flight.inputReads > profile.inputCount);
  const strike = atStrike.flight;
  expect(strike.inputReads).toBe(112);
  expect(strike.lastInputCode).toBe(0);
  expect(strike.tile).toBe(manifest.browser.expectedStrike.tile);
  expect(strike.y).toBe(manifest.browser.expectedStrike.y);
  const held = "ArrowDown";
  await writeFile(
    info.outputPath("lightning-flight.json"),
    JSON.stringify(trace, null, 2),
  );
  expect(strike, "required generated lightning strike").not.toBeNull();
  expect(strike.frames).toBe(manifest.browser.expectedStrike.frame);
  console.log("strike", JSON.stringify(strike));
  // Do not release Space or issue another key yet: the original strike's
  // keyboard clear must itself stop the previously held throttle.
  const slowed = await until((s) => s.flight.frames >= strike.frames + 3);
  expect(slowed.scene).toBe("flight");
  expect(slowed.flight.speed).toBeLessThan(strike.speed);
  await canvas.screenshot({ path: info.outputPath("lightning-strike.png") });
  await page.keyboard.up("Space");
  if (held) await page.keyboard.up(held);
  await page.keyboard.down("Space");
  await page.keyboard.down("ArrowDown");
  const recovery = await until(
    (s) => s.flight.frames >= slowed.flight.frames + 3,
  );
  expect(recovery.flight.heading).not.toBe(slowed.flight.heading);
  expect(recovery.flight.phase).toBe("flying");
  expect(recovery.flight.speed).toBeGreaterThan(slowed.flight.speed);
  expect(recovery.flight.y).toBeLessThan(slowed.flight.y);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  const events = await page.evaluate(() => window.lightningEvents);
  const heldKeys = new Set();
  for (const event of events) {
    if (event.type === "keydown") heldKeys.add(event.code);
    else heldKeys.delete(event.code);
  }
  expect(events.length).toBeGreaterThan(0);
  expect([...heldKeys]).toEqual([]);
  await writeFile(
    info.outputPath("lightning-events.json"),
    JSON.stringify(events, null, 2),
  );
  await writeFile(
    info.outputPath("lightning-recovery.json"),
    JSON.stringify(
      { strike, slowed: slowed.flight, recovery: recovery.flight },
      null,
      2,
    ),
  );
  await canvas.screenshot({ path: info.outputPath("lightning-recovery.png") });
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
