import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";

test("native map chords accelerate, retain the remaining arrow, reset on neutral and select a destination", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (cb) =>
      setTimeout(() => cb(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  const c = page.locator("#game"),
    state = async () => JSON.parse(await c.getAttribute("data-state"));
  async function until(p) {
    for (let i = 0; i < 2000; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && p(s)) return s;
      await page.clock.runFor(2);
    }
    throw Error(`unfinished map scenario ${JSON.stringify(await state())}`);
  }
  await until((s) => s.scene === "title");
  await c.focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(100);
  await waitForScene(page, c, "difficulty");
  await page.keyboard.press("Enter");
  await page.clock.runFor(100);
  await page.locator("#map").click();
  await until((s) => s.scene === "map");
  async function point(x, y) {
    const b = await c.boundingBox();
    await c.click({
      // Click the logical pixel's center so browser coordinate rounding cannot
      // place the click in the preceding pixel before the adapter truncates.
      position: {
        x: ((x + 0.5) * b.width) / 320,
        y: ((y + 0.5) * b.height) / 200,
      },
    });
    await page.clock.runFor(32);
  }
  await point(100, 100);
  expect((await state()).campaign.cursor).toEqual({ x: 100, y: 100 });
  await page.keyboard.down("ArrowRight");
  let s = await until((s) => s.campaign.pointerMotion.acceleration === 4);
  expect(s.campaign.cursor).toEqual({ x: 110, y: 100 });
  await page.keyboard.down("ArrowUp");
  s = await until((s) => s.campaign.pointerMotion.acceleration === 5);
  expect(s.campaign.cursor).toEqual({ x: 120, y: 95 });
  await page.keyboard.up("ArrowRight");
  s = await until((s) => s.campaign.pointerMotion.acceleration === 6);
  expect(s.campaign.cursor).toEqual({ x: 120, y: 89 });
  await page.keyboard.up("ArrowUp");
  await until((s) => s.campaign.pointerMotion.acceleration === 0);
  await page.keyboard.down("ArrowDown");
  await page.keyboard.down("ArrowRight");
  s = await until((s) => s.campaign.pointerMotion.acceleration === 2);
  expect(s.campaign.cursor).toEqual({ x: 126, y: 92 });
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("ArrowRight");
  await until((s) => s.campaign.pointerMotion.acceleration === 0);
  await c.screenshot({ path: ".local/browser-results/map-pointer.png" });
  await page.keyboard.press("Space");
  await until((s) => s.campaign.info);
  expect((await state()).campaign.day).toBe(1);
  await page.locator("#back").click();
  await until((s) => !s.campaign.info);
  await point(46, 139);
  await page.keyboard.press("Space");
  await until((s) => s.scene === "office");
  expect((await state()).diagnostic).toBeNull();
  expect(errors).toEqual([]);
});
