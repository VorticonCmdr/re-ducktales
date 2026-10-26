import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
const state = (canvas) => canvas.getAttribute("data-state").then(JSON.parse);
async function office(page) {
  await page.goto("/");
  const c = page.locator("#game");
  await expect(c).toHaveAttribute("data-scene", "title");
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "difficulty");
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-scene", "office");
  return c;
}
async function point(canvas, x, y) {
  const r = await canvas.boundingBox();
  await canvas.click({
    position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
  });
}
test("original map pixels and keyboard bank round trip", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await office(page);
  await page.keyboard.down("ArrowRight");
  await page.keyboard.press("Space");
  await page.keyboard.up("ArrowRight");
  await expect(c).toHaveAttribute("data-scene", "map");
  const expected = PNG.sync.read(await readFile(".local/original-map.png"));
  const actual = PNG.sync.read(
    Buffer.from(
      (await c.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  expect([actual.width, actual.height]).toEqual([320, 200]);
  expect(actual.data).toEqual(expected.data);
  await page.keyboard.down("ArrowUp");
  await expect
    .poll(async () => (await state(c)).campaign.cursor.y)
    .toBeLessThan(139);
  await page.keyboard.up("ArrowUp");
  await point(c, 212, 131);
  await expect.poll(async () => (await state(c)).campaign.asset).toBe(0);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  expect((await state(c)).campaign.travelDays).toBe(3);
  // Default is Map: inspecting and cancelling never advances the calendar.
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(false);
  expect((await state(c)).campaign.day).toBe(1);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.day).toBe(4);
  expect((await state(c)).campaign.location).toBe(0);
  expect((await state(c)).campaign.banked).toBe(0);
  await point(c, 46, 139);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "office");
  expect((await state(c)).campaign.day).toBe(7);
  expect((await state(c)).campaign.location).toBe(35);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.locator("#restart").click();
  await expect(c).toHaveAttribute("data-scene", "title");
  expect((await state(c)).campaign.day).toBe(1);
});
test("expedition boundary rejects unsupported departure without changing campaign", async ({
  page,
}) => {
  const c = await office(page);
  await page.locator("#map").click();
  await expect(c).toHaveAttribute("data-scene", "map");
  await point(c, 37, 33);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect(page.locator("#diagnostic")).toContainText(
    "Untranslated expedition: Klondike Mines",
  );
  expect((await state(c)).campaign.day).toBe(1);
  expect((await state(c)).campaign.location).toBe(35);
});
