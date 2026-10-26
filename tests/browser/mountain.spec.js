import { test, expect } from "@playwright/test";
const state = (c) => c.getAttribute("data-state").then(JSON.parse);

test("mountain arrival, keyboard movement, hook throw, life loss and direct retry", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const c = page.locator("#game");
  await expect(c).toHaveAttribute("data-scene", "title");
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-scene", "office");
  await page.locator("#map").click();
  await expect(c).toHaveAttribute("data-scene", "map");
  const r = await c.boundingBox();
  await c.click({
    position: { x: (r.width * 36) / 320, y: (r.height * 61) / 200 },
  });
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "departure");
  await page.keyboard.down("Space");
  await expect(c).toHaveAttribute("data-scene", "flight");
  await expect
    .poll(async () => (await state(c)).flight.speed)
    .toBeGreaterThan(4);
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => (await state(c)).flight.heading)
    .toBeGreaterThan(0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await expect(c).toHaveAttribute("data-scene", "mountain", { timeout: 30000 });
  await expect(page.locator("#status")).toContainText("Mountain");
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
  await page.waitForFunction(
    () => {
      const s = JSON.parse(document.querySelector("#game").dataset.state);
      return s.diagnostic || s.scene !== "mountain" || s.mountain.x >= 96;
    },
    undefined,
    { timeout: 3000, polling: "raf" },
  );
  await page.keyboard.up("ArrowRight");
  expect((await state(c)).scene).toBe("mountain");
  expect((await state(c)).mountain.x).toBeGreaterThanOrEqual(96);
  await page.keyboard.down("Space");
  await expect(c).toHaveAttribute("data-hook-swing", "true");
  await page.keyboard.up("Space");
  await expect(c).toHaveAttribute("data-hook-throw", "true");
  await page.screenshot({ path: ".local/browser-results/mountain-hook.png" });
  await expect(page.locator("#diagnostic")).toBeHidden();
  await expect(c).toHaveAttribute("data-scene", "map", { timeout: 15000 });
  const returned = await state(c);
  expect(returned.mountain.outcome.code).toBe(0);
  expect(returned.mountain.lives).toBe(0);
  expect(returned.campaign.day).toBe(entered.campaign.day + 1);
  expect(returned.campaign.location).toBe(entered.campaign.location);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "expedition-briefing");
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "mountain");
  const retried = await state(c);
  expect(retried.mountain.lives).toBe(3);
  expect(retried.campaign.day).toBe(returned.campaign.day);
  expect(retried.flight).toBeNull();
  await page.locator("#restart").click();
  await expect(c).toHaveAttribute("data-scene", "title");
  expect((await state(c)).mountain).toBeNull();
  expect(errors).toEqual([]);
});
