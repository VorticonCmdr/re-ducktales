import { test, expect } from "@playwright/test";
import { replayFlightInputs } from "./helpers/flight-inputs.js";
import { waitForScene } from "./helpers/scene.js";
import { openRecordedApplication } from "./helpers/clock.js";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
import {
  installEntryRecording,
  observeRecordedRoute,
  saveRecordedRoute,
} from "./helpers/entry-recording.js";
import profile from "../../reference/security-lightning-inputs.json" with { type: "json" };
import accepted from "../../reference/office-lightning.json" with { type: "json" };

test("natural lightning clears held flight controls and fresh keyboard input recovers", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const capture = process.env.DUCKTALES_CAPTURE_LIGHTNING;
  if (!capture)
    expect(
      accepted.pending,
      "SETUP: lightning capture needs independent acceptance",
    ).toBe(false);
  const errors = [],
    observations = [];
  let checked = 0;
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
  async function observe(name) {
    const p = await observeRecordedRoute({ page, state: await state(), name });
    observations.push(p);
    if (!capture) {
      const expected = accepted.checkpoints[checked++];
      expect(expected, "Unexpected lightning checkpoint").toBeDefined();
      for (const k of [
        "name",
        "at",
        "eventCount",
        "stateSha256",
        "pixelsSha256",
      ])
        expect(p[k], `Lightning ${name} ${k}`).toEqual(expected[k]);
    }
    return p;
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
    await bankTrips({ page, canvas, state, until, press, count: 3 }),
  ).toEqual([
    { day: 7, seed: 62042 },
    { day: 13, seed: 19313 },
    { day: 19, seed: 6124 },
  ]);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 68) / 320, y: (bounds.height * 77) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).departure.racing).toBe(false);
  await observe("departure");
  const trace = await replayFlightInputs({
    page,
    until,
    profile,
    release: false,
  });
  expect(trace.at(-1).inputReads).toBe(35);
  expect(trace.at(-1).lastInputCode).toBe(192);
  await observe("before-strike");
  // The physical Space hold continues. Down is an external make; the following
  // neutral consumed input must be produced internally by the natural strike.
  await page.keyboard.down("ArrowDown");
  const strike = (await until((s) => s.flight.inputReads > profile.inputCount))
    .flight;
  expect(strike.inputReads).toBe(36);
  expect(strike.lastInputCode).toBe(0);
  expect(strike.phase).toBe("flying");
  expect([0, 8]).toContain(strike.heading);
  await observe("strike");
  const slowed = (await until((s) => s.flight.frames >= strike.frames + 3))
    .flight;
  expect(slowed.phase).toBe("flying");
  expect(slowed.speed).toBeLessThan(strike.speed);
  expect(slowed.lastInputCode).toBe(0);
  await observe("slowed");
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowDown");
  // This naturally generated strike faces left (heading8). Up steers towards
  // heading7 and climbs in that direction; no heading or outcome is injected.
  await page.keyboard.down("Space");
  await page.keyboard.down("ArrowUp");
  const recovery = (await until((s) => s.flight.frames >= slowed.frames + 3))
    .flight;
  expect(recovery.phase).toBe("flying");
  expect(recovery.heading).not.toBe(slowed.heading);
  expect(recovery.speed).toBeGreaterThan(slowed.speed);
  expect(recovery.y).toBeLessThan(slowed.y);
  await observe("recovery");
  await page.keyboard.up("ArrowUp");
  await page.keyboard.up("Space");
  await until(
    (s) =>
      s.flight.inputReads > recovery.inputReads && s.flight.lastInputCode === 0,
  );
  await observe("released");
  const events = await page.evaluate(() => window.entryEvents);
  const held = new Set();
  for (const e of events)
    if (e.type === "keydown") held.add(e.key);
    else if (e.type === "keyup") held.delete(e.key);
  expect([...held]).toEqual([]);
  if (capture)
    await saveRecordedRoute({
      page,
      root: capture,
      observations,
      scope:
        "Exploratory security-aware natural lightning and input recovery;not acceptance or native flight parity",
    });
  else expect(checked).toBe(accepted.expectedCheckpointCount);
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  expect((await state()).scene).toBe("title");
  expect((await state()).flight).toBeNull();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
  if (capture) throw Error("EXPLORATORY lightning route saved;not acceptance");
});
