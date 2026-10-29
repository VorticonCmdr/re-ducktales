import { test, expect } from "@playwright/test";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
const state = (c) => c.getAttribute("data-state").then(JSON.parse);

test("mountain arrival, keyboard movement, hook throw, life loss and direct retry", async ({
  page,
}) => {
  test.setTimeout(60000);
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
  const c = page.locator("#game");
  async function until(predicate, max = 1250) {
    for (let i = 0; i < max; i++) {
      const s = await state(c);
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && (await predicate(s))) return s;
      // Four display callbacks per observation; gamepresent still samples each
      // simulation presentation,including the standing life-reset poses.
      await page.clock.runFor(32);
    }
    throw Error(
      "Unfinished mountain browser sequence " +
        JSON.stringify({
          state: await state(c),
          palettes: await c.getAttribute("data-life-palettes"),
          observations: await c.getAttribute("data-palette-observations"),
        }),
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }

  await until((s) => s.scene === "title");
  await c.focus();
  await press("Space");
  await until((s) => s.scene === "difficulty" && s.difficultyMenu?.ready);
  await press("Enter");
  await until((s) => s.scene === "office");
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until, state: () => state(c) });
  await until((s) => s.scene === "map");
  expect(
    await bankTrips({
      page,
      canvas: c,
      state: () => state(c),
      until,
      press,
      count: 2,
    }),
  ).toEqual([
    { day: 7, seed: 62042 },
    { day: 13, seed: 19313 },
  ]);
  const r = await c.boundingBox();
  await c.click({
    position: { x: (r.width * 36) / 320, y: (r.height * 61) / 200 },
  });
  await press("Space");
  await until((s) => s.campaign.destination?.ready);
  await press("ArrowRight");
  await until((s) => s.campaign.choice === 1 && s.campaign.destination?.ready);
  await press("Space");
  await until((s) => s.scene === "departure");
  expect((await state(c)).departure.racing).toBe(false);
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight");
  await until((s) => s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await until((s) => s.scene === "mountain");
  await expect(page.locator("#status")).toContainText("Mountain");
  // Observe actual rendered standing poses after each natural life reset.
  // Palette expectations come from overlay5:022f..0274,not the port renderer.
  await c.evaluate((canvas) => {
    const checked = {},
      observations = [];
    const sample = (s) => {
      if (s.scene === "mountain" && observations.length < 20) {
        const { phase, action, frame, row, lives } = s.mountain;
        observations.push({ phase, action, frame, row, lives });
        canvas.dataset.paletteObservations = JSON.stringify(observations);
      }
      if (
        s.scene !== "mountain" ||
        s.mountain.phase !== "playing" ||
        s.mountain.action !== 0 ||
        s.mountain.frame !== 20 ||
        s.mountain.row !== 0
      )
        return;
      const { lives, x, y } = s.mountain;
      if (checked[lives] || ![1, 2, 3].includes(lives)) return;
      const pixels = canvas.getContext("2d").getImageData(x, y, 32, 32).data;
      const target = { 3: [170, 0, 0], 2: [0, 0, 170], 1: [0, 170, 0] }[lives];
      let purple = 0,
        color = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (
          (pixels[i] === 170 && pixels[i + 1] === 0 && pixels[i + 2] === 170) ||
          (pixels[i] === 255 && pixels[i + 1] === 85 && pixels[i + 2] === 255)
        )
          purple++;
        if (target.every((v, j) => pixels[i + j] === v)) color++;
      }
      checked[lives] = { purple, color };
      canvas.dataset.lifePalettes = JSON.stringify(checked);
    };
    canvas.addEventListener("gamepresent", (event) => sample(event.detail));
    sample(JSON.parse(canvas.dataset.state));
  });
  await until(
    async () =>
      !!JSON.parse((await c.getAttribute("data-life-palettes")) ?? "{}")[3],
    250,
  );
  const entered = await state(c);
  expect(entered.diagnostic).toBeNull();
  expect(entered.mountain.lives).toBe(3);
  expect(entered.flight.outcome.status).toBe("crashed");
  await c.evaluate((canvas) => {
    canvas.addEventListener("gamepresent", (event) => {
      const s = event.detail;
      if (s.scene !== "mountain") return;
      if (s.mountain.action === 4) canvas.dataset.hookSwing = "true";
      if (s.mountain.action === 5) canvas.dataset.hookThrow = "true";
    });
  });
  await page.keyboard.down("ArrowRight");
  await until((s) => s.scene !== "mountain" || s.mountain.x >= 96);
  await page.keyboard.up("ArrowRight");
  expect((await state(c)).scene).toBe("mountain");
  expect((await state(c)).mountain.x).toBeGreaterThanOrEqual(96);
  await page.keyboard.down("Space");
  await until(async () => (await c.getAttribute("data-hook-swing")) === "true");
  await page.keyboard.up("Space");
  await until(async () => (await c.getAttribute("data-hook-throw")) === "true");
  await page.screenshot({ path: ".local/browser-results/mountain-hook.png" });
  await expect(page.locator("#diagnostic")).toBeHidden();
  // Walk off the ledge through each life. Release at the life boundary so the
  // unmodified input adapter exposes the reset standing pose before moving on.
  await page.keyboard.down("ArrowRight");
  for (const lives of [2, 1, 0]) {
    await until((s) => s.scene !== "mountain" || s.mountain.lives <= lives);
    await page.keyboard.up("ArrowRight");
    if (lives) {
      await until(
        async () =>
          !!JSON.parse((await c.getAttribute("data-life-palettes")) ?? "{}")[
            lives
          ],
      );
      if (lives === 2)
        await c.screenshot({
          path: ".local/browser-results/mountain-life2-palette.png",
        });
      await page.keyboard.down("ArrowRight");
    }
  }
  await until((s) => s.scene === "map");
  const palettes = JSON.parse(await c.getAttribute("data-life-palettes"));
  expect(Object.keys(palettes).sort()).toEqual(["1", "2", "3"]);
  for (const check of Object.values(palettes)) {
    expect(check.purple).toBe(0);
    expect(check.color).toBeGreaterThanOrEqual(80);
  }
  const returned = await state(c);
  expect(returned.mountain.outcome.code).toBe(0);
  expect(returned.mountain.lives).toBe(0);
  expect(returned.campaign.day).toBe(entered.campaign.day + 1);
  expect(returned.campaign.location).toBe(entered.campaign.location);
  await press("Space");
  await until((s) => s.scene === "expedition-briefing");
  await press("Space");
  await until((s) => s.scene === "mountain");
  const retried = await state(c);
  expect(retried.mountain.lives).toBe(3);
  expect(retried.campaign.day).toBe(returned.campaign.day);
  expect(retried.flight).toBeNull();
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  expect((await state(c)).mountain).toBeNull();
  expect(errors).toEqual([]);
});
