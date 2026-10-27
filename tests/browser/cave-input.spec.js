import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

test("cave input polls pause actors while clocks run and room entry flushes unread keys", async ({
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
  async function until(predicate, max = 10000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      // Observe at the supplied8ms display cadence; shorter polls cannot
      // expose another rendered state. Simulation remains at its own70Hz.
      await page.clock.runFor(8);
    }
    throw Error(
      "Unfinished cave-input browser sequence " + JSON.stringify(await state()),
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await c.focus();
  await press("Space");
  await press("Enter");
  await page.locator("#map").click();
  await until((s) => s.scene === "map");
  const bounds = await c.boundingBox();
  await c.click({
    position: { x: (bounds.width * 37) / 320, y: (bounds.height * 33) / 200 },
  });
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  await until((s) => s.scene === "departure");
  await press("Space");
  await until((s) => s.scene === "flight");
  // Authored keyboard takeoff/stall through the actual flight and repair route.
  await page.keyboard.down("Space");
  await page.clock.runFor(1200);
  await page.keyboard.down("ArrowDown");
  await page.clock.runFor(300);
  await page.keyboard.up("ArrowDown");
  await page.clock.runFor(800);
  await page.keyboard.up("Space");
  const entered = await until((s) => s.scene === "cave");
  expect(entered.flight.outcome.status).toBe("crashed");
  expect(entered.cave.phase).toBe("entering");
  await page.keyboard.press("p");
  await page.keyboard.press("s");
  await page.clock.runFor(16);
  expect((await state()).pendingCaveSystemKeys).toHaveLength(2);
  await until((s) => s.cave.phase === "exploring");
  expect((await state()).pendingCaveSystemKeys).toBeUndefined();
  expect((await state()).systemOverlay).toBeNull();
  await expect(page.locator("#audio")).not.toBeChecked();
  await press("p");
  const paused = await until((s) => s.systemOverlay?.phase === "waiting");
  expect(paused.cave.waitingForInputPoll).toBe(true);
  const actors = ({ tick, ...s }) => s;
  await page.clock.runFor(1000);
  const held = await state();
  expect(actors(held.cave)).toEqual(actors(paused.cave));
  expect(held.cave.tick - paused.cave.tick).toBe(held.tick - paused.tick);
  expect(held.cave.tick - paused.cave.tick).toBeGreaterThan(60);
  const pixels = PNG.sync.read(
      Buffer.from(
        (await c.evaluate((el) => el.toDataURL())).split(",")[1],
        "base64",
      ),
    ),
    original = PNG.sync.read(await readFile(".local/cave-input-pause.png"));
  for (let y = 80; y < 104; y++)
    expect(
      Buffer.compare(
        pixels.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
        original.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
      ),
    ).toBe(0);
  await c.screenshot({ path: ".local/browser-results/cave-pause.png" });
  await press("p");
  await until((s) => s.systemOverlay === null);
  await press("q");
  await until((s) => s.systemOverlay?.kind === "quit");
  await press("n");
  await until((s) => s.systemOverlay === null);
  expect((await state()).cave.room).toBe(17);
  const cash = (await state()).money;
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await until((s) => s.cave.room === 18);
  expect((await state()).cave.phase).toBe("entering");
  await page.keyboard.press("p");
  await page.keyboard.press("s");
  await page.clock.runFor(16);
  expect((await state()).pendingCaveSystemKeys).toHaveLength(2);
  expect((await state()).systemOverlay).toBeNull();
  const next = await until((s) => s.cave.phase === "exploring");
  expect(next.pendingCaveSystemKeys).toBeUndefined();
  expect(next.systemOverlay).toBeNull();
  expect(next.cave.room).toBe(18);
  expect(next.money).toBe(cash + 50);
  // Keep both physical keys down across19a5. The next room must still await a
  // fresh make event; browser rendering/input adapters are exercised here.
  await page.clock.runFor(200);
  expect((await state()).cave.room).toBe(18);
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowRight");
  await expect(page.locator("#audio")).not.toBeChecked();
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.locator("#restart").click();
  await until((s) => s.scene === "title");
  expect((await state()).cave).toBeNull();
});
