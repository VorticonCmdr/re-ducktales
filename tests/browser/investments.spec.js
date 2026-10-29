import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { finishSecurityEntry } from "./helpers/security.js";
import marketRoute from "../../reference/security-market-route.json" with { type: "json" };

test("calendar travel produces company news and acknowledged bulletins stay consumed", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate) {
    for (let i = 0; i < 2000; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(16);
    }
    throw Error(
      `unfinished investment travel ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    if (key === "Escape") await page.locator("#back").click();
    else await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  for (
    let i = 0;
    i < 100 && (await canvas.getAttribute("data-scene")) !== "title";
    i++
  )
    await page.clock.runFor(20);
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  for (let trip = 0; trip < 4; trip++) {
    await page.locator("#map").click();
    await finishSecurityEntry({ page, until, state });
    await until((s) => s.scene === "map");
    const bounds = await canvas.boundingBox();
    await canvas.click({
      position: {
        x: (bounds.width * 212) / 320,
        y: (bounds.height * 131) / 200,
      },
    });
    await page.clock.runFor(100);
    await press("Space");
    await press("ArrowRight");
    await press("Space");
    expect((await state()).scene).toBe("bank");
    await page.keyboard.down("Space");
    for (let step = 0; step < 1000 && (await state()).scene === "bank"; step++)
      await page.clock.runFor(16);
    await page.keyboard.up("Space");
    await page.clock.runFor(16);
    expect((await state()).scene).toBe("map");
    await press("Escape");
    expect((await state()).scene).toBe("office");
    expect((await state()).campaign.day).toBe(7 + trip * 6);
    expect((await state()).seed).toBe(marketRoute.checkpoints[trip].seed);
  }
  await page.locator("#investments").click();
  await until((s) => s.scene === "investments");
  await canvas.focus();
  expect((await state()).investments.phase).toBe("news");
  await page.screenshot({ path: ".local/browser-results/investment-news.png" });
  // Security consumes shared RNG before travel. This separately reproduced
  // route has three bulletins; the historical pre-security route had two.
  for (const news of marketRoute.news) {
    expect((await state()).investments.phase).toBe("news");
    expect((await state()).investments.company).toBe(news.company);
    expect((await state()).investments.newsStatus).toBe(news.status);
    await press("Space");
  }
  expect((await state()).investments.phase).toBe("portfolio");
  await press("Escape");
  expect((await state()).scene).toBe("office");
  await page.locator("#investments").click();
  await until((s) => s.scene === "investments");
  expect((await state()).investments.phase).toBe("portfolio");
  expect((await state()).campaign.day).toBe(25);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
});

test("original assets, earned cash, stock transactions, held Fire limit, office return and restart", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 1500) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(16);
    }
    throw Error(
      `unfinished investments browser wait ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    if (key === "Escape") await page.locator("#back").click();
    else await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function openInvestments() {
    await page.keyboard.down("ArrowLeft");
    await press("Space");
    await page.keyboard.up("ArrowLeft");
    await until((s) => s.scene === "investments");
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  await until((s) => s.scene === "office");
  expect((await state()).seed).toBe(1960);
  await openInvestments();
  expect((await state()).investments.phase).toBe("portfolio");
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).money).toBe(0);
  expect((await state()).investments.shares[10]).toBe(0);
  await press("Escape");
  await press("Escape");
  await until((s) => s.scene === "office");
  expect((await state()).campaign.day).toBe(1);
  await page.keyboard.down("ArrowUp");
  await press("Space");
  await page.keyboard.up("ArrowUp");
  await until(
    (s) =>
      s.bin?.phase === "idle" && s.bin.nextPose === 3 && s.bin.remaining >= 10,
  );
  await press("Space");
  await until((s) => s.scene === "office");
  expect((await state()).money).toBe(1000);
  await openInvestments();
  await press("Space");
  await press("ArrowRight");
  const price = (await state()).investments.prices[10];
  expect(price).toBe(22);
  await press("Space");
  expect((await state()).money).toBe(1000 - price);
  expect((await state()).investments.shares[10]).toBe(1);
  await press("ArrowRight");
  await press("Space");
  expect((await state()).money).toBe(1000);
  expect((await state()).investments.shares[10]).toBe(0);
  await press("ArrowRight");
  await press("Space");
  for (let i = 0; i < 6; i++) await press("ArrowDown");
  expect((await state()).investments.selected).toBe(0);
  expect((await state()).investments.prices[0]).toBe(1);
  await press("Space");
  await press("ArrowRight");
  await page.keyboard.down("Space");
  await page.clock.runFor(2000);
  await page.keyboard.up("Space");
  await page.clock.runFor(100);
  expect((await state()).investments.shares[0]).toBe(99);
  expect((await state()).money).toBe(901);
  await press("Space");
  expect((await state()).investments.shares[0]).toBe(99);
  expect((await state()).money).toBe(901);
  await press("Escape");
  await press("Escape");
  await until((s) => s.investments.phase === "broker");
  await press("Space");
  await until((s) => s.scene === "office");
  expect((await state()).money).toBe(901);
  expect((await state()).campaign.day).toBe(1);
  expect((await state()).rareCoinTaken).toBe(true);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await page.clock.runFor(100);
  expect((await state()).scene).toBe("title");
  expect((await state()).money).toBe(0);
  expect((await state()).investments).toBeNull();
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await waitForScene(page, canvas, "office");
  await openInvestments();
  expect((await state()).investments.shares).toEqual(Array(15).fill(0));
  expect((await state()).seed).toBe(1960);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.screenshot({ path: ".local/browser-results/investments.png" });
});
