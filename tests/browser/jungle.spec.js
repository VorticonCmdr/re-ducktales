import { test, expect } from "@playwright/test";

test("jungle departure, keyboard jump/walk/drop, life loss, campaign return and direct retry", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  await expect(canvas).toHaveAttribute("data-scene", "title");
  await canvas.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(canvas).toHaveAttribute("data-scene", "office");
  await page.locator("#map").click();
  await expect(canvas).toHaveAttribute("data-scene", "map");
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 64) / 320, y: (bounds.height * 73) / 200 },
  });
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state()).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state()).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "departure");
  await page.keyboard.down("Space");
  await expect(canvas).toHaveAttribute("data-scene", "flight");
  await expect
    .poll(async () => (await state()).flight.speed)
    .toBeGreaterThan(4);
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => (await state()).flight.heading)
    .toBeGreaterThan(0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await expect(canvas).toHaveAttribute("data-scene", "jungle", {
    timeout: 30000,
  });
  await expect
    .poll(async () => (await state()).jungle.frames)
    .toBeGreaterThan(2);
  await expect(page.locator("#status")).toContainText("Jungle");
  expect((await state()).jungle.lives).toBe(3);
  await page.keyboard.down("Space");
  await expect.poll(async () => (await state()).jungle.action).toBe(18);
  await page.keyboard.up("Space");
  await expect.poll(async () => (await state()).jungle.action).toBe(5);
  const start = (await state()).jungle;
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(async () => (await state()).jungle.x)
    .toBeGreaterThan(start.x);
  await page.keyboard.up("ArrowRight");
  await canvas.screenshot({
    path: ".local/browser-results/jungle-movement.png",
  });
  await page.keyboard.down("ArrowDown");
  await expect
    .poll(async () => (await state()).jungle.lives, { timeout: 20000 })
    .toBeLessThan(3);
  await expect(canvas).toHaveAttribute("data-scene", "map", { timeout: 90000 });
  await page.keyboard.up("ArrowDown");
  const returned = await state();
  expect(returned.jungle.outcome.code).toBe(0);
  expect(returned.jungle.lives).toBe(0);
  expect(returned.campaign.day).toBeGreaterThan(1);
  expect(returned.campaign.location).toBe(25);
  expect(returned.money).toBe(returned.jungle.money);
  await page.keyboard.press("Space");
  await expect(canvas).toHaveAttribute("data-scene", "jungle", {
    timeout: 10000,
  });
  const retry = await state();
  expect(retry.jungle.lives).toBe(3);
  expect(retry.campaign.day).toBe(returned.campaign.day);
  expect(retry.money).toBe(returned.money);
  expect(retry.flight).toBeNull();
  expect(retry.diagnostic).toBeNull();
  await page.locator("#restart").click();
  await expect(canvas).toHaveAttribute("data-scene", "title");
  expect((await state()).jungle).toBeNull();
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
});
