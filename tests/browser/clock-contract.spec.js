import { test, expect } from "@playwright/test";
import {
  installRecordedClock,
  openRecordedApplication,
} from "./helpers/clock.js";

test("recorded browser clock starts at its declared origin and stays paused across host latency", async ({
  browser,
}) => {
  const wall = Date.parse("2026-01-01T00:00:01Z");
  for (const origin of [0, 1]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await installRecordedClock(page, origin);
      await new Promise((resolve) => setTimeout(resolve, 30)); // Deliberate host latency, not game time.
      await page.goto("data:text/html,<title>Clock contract</title>");
      expect(
        await page.evaluate(() => [performance.now(), Date.now()]),
      ).toEqual([origin, wall]);
      await page.clock.runFor(8);
      expect(
        await page.evaluate(() => [performance.now(), Date.now()]),
      ).toEqual([origin + 8, wall + 8]);
    } finally {
      await context.close();
    }
  }
  // Negative control for the actual1.64.1 setup error: install/pause logs retain
  // their intervening host time in a newly navigated document's performance clock.
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await page.clock.pauseAt(new Date(wall));
    await page.goto("data:text/html,<title>Old clock negative control</title>");
    expect(await page.evaluate(() => performance.now())).not.toBe(1);
  } finally {
    await context.close();
  }
});

test("application receives the declared clock before original assets initialize", async ({
  browser,
}) => {
  for (let run = 0; run < 2; run++) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openRecordedApplication(page, 1);
      await expect(page.locator("#actions")).toBeVisible();
      await new Promise((resolve) => setTimeout(resolve, 30));
      await page.locator("#game").focus();
      expect(
        await page.evaluate(() => [performance.now(), Date.now()]),
      ).toEqual([1, Date.parse("2026-01-01T00:00:01Z")]);
      await page.clock.runFor(8);
      expect(await page.evaluate(() => performance.now())).toBe(9);
      expect(errors).toEqual([]);
      await expect(page.locator("#diagnostic")).toBeHidden();
    } finally {
      await context.close();
    }
  }
});
