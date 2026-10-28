import { test, expect } from "@playwright/test";

test("photography defers keys through entry and shutter, freezes pause pixels and resumes quit", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  await page.goto("/");
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
  await press("Enter");
  await page.locator("#map").click();
  await page.clock.runFor(100);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 46) / 320, y: (bounds.height * 56) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  const arrived = await until((s) => s.scene === "photography");
  // This observed Yellerstone route crashes, then completes the original
  // repair/arrival path. Landing is covered separately by the cave route.
  expect(arrived.flight.outcome.code).toBe(0);
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
  await page.keyboard.press("p");
  await page.clock.runFor(8);
  expect((await state()).systemOverlay).toBeNull();
  const paused = await until((s) => s.systemOverlay?.kind === "pause");
  expect(paused.photography.wait.clock).toBe("input");
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
