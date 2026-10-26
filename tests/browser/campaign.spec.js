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
test("expedition briefing, keyboard takeoff, crash, rival claim and campaign return", async ({
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
  await expect(c).toHaveAttribute("data-scene", "departure");
  await expect(page.locator("#diagnostic")).toBeHidden();
  await expect(page.locator("#status")).toContainText("Departure confirmed");
  const prepared = await state(c);
  expect(prepared.departure.flightRequest).toEqual({ days: 1, racing: 1 });
  expect(prepared.departure.activity).toBe("cave");
  expect(prepared.seed).toBe(32100);
  const expected = PNG.sync.read(
    await readFile(".local/original-departure.png"),
  );
  const actual = PNG.sync.read(
    Buffer.from(
      (await c.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  expect(actual.data).toEqual(expected.data);
  await c.evaluate((canvas) => {
    canvas.addEventListener("gamepresent", (event) => {
      if (event.detail.flight?.phase === "crash")
        canvas.dataset.sawCrash = "true";
    });
  });
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
  await expect.poll(async () => (await state(c)).flight.y).toBeLessThan(139);
  await page.screenshot({ path: ".local/browser-results/flight-takeoff.png" });
  await expect(c).toHaveAttribute("data-saw-crash", "true", { timeout: 20000 });
  await expect(c).toHaveAttribute("data-scene", "map", { timeout: 10000 });
  const result = await state(c);
  expect(result.flight.outcome.status).toBe("crashed");
  expect(result.campaign.day).toBe(2);
  expect(result.campaign.location).toBe(1);
  expect(result.campaign.rival.money).toBe(4500);
  expect(result.campaign.rival.location).toBe(1);
  expect(result.money).toBe(0);
  await expect(page.locator("#diagnostic")).toBeHidden();
  await page.locator("#restart").click();
  await expect(c).toHaveAttribute("data-scene", "title");
  expect((await state(c)).flight).toBeNull();
});

// Other activity families share the flight dispatcher; the terrain games remain separate.
for (const [name, x, y, activity] of [
  ["El Capitan", 36, 61, "mountain"],
  ["Okeefadokie Swamp", 64, 73, "jungle"],
  ["Yellerstone Park", 46, 56, "photography"],
]) {
  test(`departure dispatch classifies ${name}`, async ({ page }) => {
    const c = await office(page);
    await page.locator("#map").click();
    await expect(c).toHaveAttribute("data-scene", "map");
    await point(c, x, y);
    await page.keyboard.press("Space");
    await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
    await page.keyboard.press("Space");
    await expect(c).toHaveAttribute("data-scene", "departure");
    expect((await state(c)).departure.activity).toBe(activity);
    expect((await state(c)).campaign.location).toBe(35);
    await expect(page.locator("#diagnostic")).toBeHidden();
    await page.locator("#restart").click();
    await expect(c).toHaveAttribute("data-scene", "title");
    expect((await state(c)).departure).toBeNull();
  });
}

test("keyboard flight reaches the airport and stops at the explicit expedition boundary", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await office(page);
  await page.locator("#map").click();
  await expect(c).toHaveAttribute("data-scene", "map");
  await point(c, 37, 33);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await state(c)).campaign.info).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await state(c)).campaign.choice).toBe(1);
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "departure");
  await page.keyboard.down("Space");
  await expect(c).toHaveAttribute("data-scene", "flight");
  let lastFrame = -1,
    heldDirection = null,
    steps = 0,
    landingSeen = false;
  // External feedback pilot using the same keyboard adapter as a player.
  // This is browser acceptance, not an original-game input replay.
  while (steps++ < 400) {
    const current = await state(c);
    if (current.diagnostic || current.flight.phase === "complete") break;
    if (current.flight.phase === "landing") {
      landingSeen = true;
      await page.screenshot({
        path: ".local/browser-results/flight-landing.png",
      });
      await expect(page.locator("#diagnostic")).toBeVisible({ timeout: 10000 });
      break;
    }
    const f = current.flight;
    const desired =
      f.tile > 37 ? (f.y < 135 ? 15 : 0) : f.y > 90 ? 1 : f.y < 75 ? 15 : 0;
    const delta = (desired - f.heading + 16) % 16;
    const direction =
      f.speed < 4 || !delta ? null : delta < 8 ? "ArrowDown" : "ArrowUp";
    if (direction !== heldDirection) {
      if (heldDirection) await page.keyboard.up(heldDirection);
      if (direction) await page.keyboard.down(direction);
      heldDirection = direction;
    }
    lastFrame = f.frames;
    await page.waitForFunction(
      (frame) => {
        const s = JSON.parse(document.querySelector("#game").dataset.state);
        return (
          s.diagnostic || s.flight.frames > frame || s.flight.phase !== "flying"
        );
      },
      lastFrame,
      { timeout: 3000 },
    );
  }
  if (heldDirection) await page.keyboard.up(heldDirection);
  await page.keyboard.up("Space");
  expect(steps).toBeLessThan(400);
  expect(landingSeen).toBe(true);
  await expect(page.locator("#diagnostic")).toContainText(
    "Untranslated expedition arrival: Klondike Mines",
  );
  const result = await state(c);
  expect(result.flight.outcome.status).toBe("arrived");
  expect(result.flight.outcome.code).toBe(1);
  expect(result.campaign.location).toBe(1);
  expect(result.campaign.day).toBe(1);
  expect(errors).toEqual([]);
});
