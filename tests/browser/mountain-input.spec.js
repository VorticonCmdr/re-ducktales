import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

test("mountain polls system keys after opening pages, pauses clocks correctly and clears held keys on life reset", async ({
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
  const c = page.locator("#game"),
    state = () => c.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 5000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      "Unfinished mountain input route " + JSON.stringify(await state()),
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await c.focus();
  await press("Space");
  await waitForScene(page, c, "difficulty");
  await press("Enter");
  await waitForScene(page, c, "office");
  await page.locator("#map").click();
  await until((s) => s.scene === "map");
  const r = await c.boundingBox();
  await c.click({
    position: { x: (r.width * 36) / 320, y: (r.height * 61) / 200 },
  });
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  await until((s) => s.scene === "departure");
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  const entered = await until((s) => s.scene === "mountain");
  expect(entered.flight.outcome.status).toBe("crashed");
  expect(entered.mountain.phase).toBe("entering");
  expect(entered.mountain.frames).toBe(0);
  expect(entered.mountain.presentations).toBe(1);
  await page.keyboard.press("p");
  // The next display callback completes page2 before0317 can read P.
  const paused = await until((s) => s.systemOverlay?.phase === "waiting");
  expect(paused.mountain.presentations).toBe(2);
  expect(paused.mountain.frames).toBe(0);
  expect(paused.mountain.waitingForInputPoll).toBe(true);
  const actors = ({ tick, ...s }) => s;
  await page.clock.runFor(1000);
  const held = await state();
  expect(actors(held.mountain)).toEqual(actors(paused.mountain));
  expect(held.mountain.tick - paused.mountain.tick).toBe(
    held.tick - paused.tick,
  );
  expect(held.mountain.tick - paused.mountain.tick).toBeGreaterThan(60);
  const pixels = PNG.sync.read(
      Buffer.from(
        (await c.evaluate((el) => el.toDataURL())).split(",")[1],
        "base64",
      ),
    ),
    original = PNG.sync.read(await readFile(".local/mountain-input-pause.png"));
  for (let y = 80; y < 104; y++)
    expect(
      Buffer.compare(
        pixels.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
        original.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
      ),
    ).toBe(0);
  await c.screenshot({
    path: ".local/browser-results/mountain-input-pause.png",
  });
  await press("p");
  await until((s) => s.systemOverlay === null);
  await press("q");
  await until((s) => s.systemOverlay?.kind === "quit");
  await press("n");
  await until((s) => s.systemOverlay === null);
  expect((await state()).mountain.lives).toBe(3);
  await page.keyboard.down("ArrowRight");
  await until((s) => s.mountain.lives === 2);
  const reset = await until((s) => s.mountain.phase === "playing");
  expect(reset.mountain.action).toBe(0);
  expect(reset.mountain.x).toBe(16);
  // Keep the physical key down:19a5 cleared the game's held-key table.
  await page.clock.runFor(200);
  const stopped = await state();
  expect(stopped.mountain.frames).toBeGreaterThan(reset.mountain.frames);
  expect(stopped.mountain.x).toBe(reset.mountain.x);
  expect(stopped.mountain.y).toBe(reset.mountain.y);
  expect(stopped.systemOverlay).toBeNull();
  await page.keyboard.up("ArrowRight");
  await expect(page.locator("#audio")).not.toBeChecked();
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  expect((await state()).mountain).toBeNull();
});
