import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { finishSecurityEntry } from "./helpers/security.js";
import { exploreFlight } from "./helpers/flight-policy.js";
import { openRecordedApplication } from "./helpers/clock.js";

test("photography defers keys through entry and shutter, freezes pause pixels and resumes quit", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.DUCKTALES_PHOTOGRAPHY_TIMING_BROWSER_NEGATIVE) {
    expect(process.env.DUCKTALES_PHOTOGRAPHY_TIMING_BROWSER_NEGATIVE).toBe(
      "skip-work",
    );
    await page.route("**/src/game/photography.js*", async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const wait =
        /yield\s*\{\s*clock: "graphics",\s*remaining: 1,\s*until: this.now\(\) \+ work.milliseconds,?\s*\};/g;
      expect(body.match(wait)?.length, "SETUP: photography graphics hook").toBe(
        1,
      );
      await route.fulfill({
        response,
        body: body.replace(wait, "/* isolated source drawing-time bypass */"),
      });
    });
  }
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 4000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `unfinished photography browser wait: ${JSON.stringify(await state())}`,
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
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 46) / 320, y: (bounds.height * 56) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await until((s) => s.campaign.destination?.ready);
  await press("ArrowRight");
  await until((s) => s.campaign.choice === 1 && s.campaign.destination?.ready);
  await press("Space");
  await exploreFlight({ page, state, until });
  const arrived = await until((s) => s.scene === "photography");
  // The first security-aware departure races on Easy. Require the actual
  // landing, rather than substituting an expedition after a lost race.
  expect(arrived.flight.outcome.code).toBe(1);
  expect(arrived.flight.phase).toBe("complete");
  await page.keyboard.press("p");
  await page.keyboard.press("s");
  await until((s) => s.photography.phase === "playing");
  expect((await state()).systemOverlay).toBeNull();
  await expect(page.locator("#audio")).not.toBeChecked();
  const before = await state();
  await page.keyboard.down("Space");
  const shutter = await until(
    (s) => s.photography.photoCount > before.photography.photoCount,
  );
  await page.keyboard.up("Space");
  const shutterAt = await page.evaluate(() => performance.now());
  await page.keyboard.press("p");
  await page.clock.runFor(8);
  expect((await state()).systemOverlay).toBeNull();
  const paused = await until((s) => s.systemOverlay?.kind === "pause");
  expect(paused.photography.wait.clock).toBe("input");
  const duration = (await page.evaluate(() => performance.now())) - shutterAt;
  const sourceMilliseconds =
    paused.photography.drawingMilliseconds -
    shutter.photography.drawingMilliseconds;
  expect(sourceMilliseconds).toBeGreaterThan(100);
  expect(duration, "Photography source drawing cadence").toBeGreaterThanOrEqual(
    sourceMilliseconds - 8,
  );
  // Four shutter flips, a following input observation, and at most the original
  // seven-count deadline. The8ms observer can enter one partial drawing group.
  expect(duration, "Photography source drawing cadence").toBeLessThanOrEqual(
    sourceMilliseconds + (5 * 1000) / 70.086 + (7 * 16380 * 1000) / 1193182 + 8,
  );
  expect(paused.photography.frames).toBe(shutter.photography.frames);
  // At the8ms observation cadence, at most one of four shutter retraces may
  // already have been presented when photoCount first becomes visible.
  expect(
    paused.photography.presentations - shutter.photography.presentations,
  ).toBeGreaterThanOrEqual(3);
  expect(
    paused.photography.presentations - shutter.photography.presentations,
  ).toBeLessThanOrEqual(4);
  const frozenPixels = await canvas.screenshot();
  await page.keyboard.press("s");
  await page.clock.runFor(800);
  const waiting = await state();
  expect(waiting.systemOverlay.phase).toBe("waiting");
  for (const key of Object.keys(paused.photography))
    if (!["tick", "retrace"].includes(key))
      expect(waiting.photography[key], key).toEqual(paused.photography[key]);
  expect(waiting.photography.tick).toBeGreaterThan(paused.photography.tick);
  expect(waiting.photography.retrace).toBeGreaterThan(
    paused.photography.retrace,
  );
  expect(await canvas.screenshot()).toEqual(frozenPixels);
  await expect(page.locator("#audio")).not.toBeChecked();
  await canvas.screenshot({
    path: ".local/browser-results/photography-input.png",
  });
  await page.keyboard.press("p");
  await until((s) => !s.systemOverlay);
  await page.keyboard.press("q");
  await until((s) => s.systemOverlay?.kind === "quit");
  await page.keyboard.press("n");
  const resumed = await until((s) => !s.systemOverlay);
  expect(resumed.scene).toBe("photography");
  expect(resumed.photography.photoCount).toBe(shutter.photography.photoCount);
  await page.keyboard.press("s");
  await page.clock.runFor(200);
  await expect(page.locator("#audio")).toBeChecked();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
