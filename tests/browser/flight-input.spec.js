import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";

test("flight P/N dialogs preserve actors, clocks continue, and crash keys flush before natural return", async ({
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
  async function until(predicate, max = 10000, step = 4) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(step);
    }
    throw Error(
      `unfinished flight-input browser scenario ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  const actors = (f) =>
    Object.fromEntries(
      [
        "x",
        "y",
        "speed",
        "heading",
        "tile",
        "frames",
        "presentations",
        "day",
        "seed",
      ].map((k) => [k, f[k]]),
    );
  await until((s) => s.scene === "title");
  await c.focus();
  await press("Space");
  await waitForScene(page, c, "difficulty");
  await press("Enter");
  await waitForScene(page, c, "office");
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until, state });
  await until((s) => s.scene === "map");
  // Two real bank/office detours make this a non-racing departure. The fresh
  // security-aware route races on Easy; its crash correctly enters rival-claim
  // instead of the crash-repair boundary this case is intended to exercise.
  expect(
    await bankTrips({ page, canvas: c, state, until, press, count: 2 }),
  ).toEqual([
    { day: 7, seed: 62042 },
    { day: 13, seed: 19313 },
  ]);
  const bounds = await c.boundingBox();
  await c.click({
    position: { x: (bounds.width * 37) / 320, y: (bounds.height * 33) / 200 },
  });
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  await until((s) => s.scene === "departure");
  expect((await state()).departure.racing).toBe(false);
  await press("Space");
  await until((s) => s.scene === "flight");
  await press("p");
  expect((await state()).systemOverlay.phase).toBe("lock");
  await press("s");
  await expect(page.locator("#audio")).not.toBeChecked();
  const paused = await until((s) => s.systemOverlay?.phase === "waiting");
  expect(paused.flight.waitingForInputPoll).toBe(true);
  const pixels = PNG.sync.read(
    Buffer.from(
      (await c.evaluate((el) => el.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  const original = PNG.sync.read(await readFile(".local/flight-pause.png"));
  for (let y = 80; y < 104; y++)
    expect(
      Buffer.compare(
        pixels.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
        original.data.subarray((y * 320 + 104) * 4, (y * 320 + 208) * 4),
      ),
    ).toBe(0);
  await page.clock.runFor(2000);
  const held = await state();
  expect(actors(held.flight)).toEqual(actors(paused.flight));
  expect(held.flight.tick - paused.flight.tick).toBe(held.tick - paused.tick);
  expect(held.flight.tick - paused.flight.tick).toBeGreaterThan(140);
  await c.screenshot({ path: ".local/browser-results/flight-pause.png" });
  await page.keyboard.press("p");
  const resumed = await until((s) => s.systemOverlay === null, 1000, 1);
  expect(resumed.flight.frames).toBe(held.flight.frames + 1);
  expect(resumed.flight.waitingForInputPoll).toBeUndefined();
  await press("q");
  const question = await until((s) => s.systemOverlay?.kind === "quit");
  await page.clock.runFor(500);
  expect(actors((await state()).flight)).toEqual(actors(question.flight));
  await press("n");
  await until((s) => s.systemOverlay === null);
  // Authored keyboard-only takeoff and stall. No flight outcome is injected.
  await page.keyboard.down("Space");
  await page.clock.runFor(1200);
  await page.keyboard.down("ArrowDown");
  await page.clock.runFor(300);
  await page.keyboard.up("ArrowDown");
  await page.clock.runFor(800);
  await page.keyboard.up("Space");
  await until((s) => s.flight.phase === "crash");
  for (const key of ["q", "p", "s"]) {
    await press(key);
    expect((await state()).systemOverlay).toBeNull();
  }
  const waiting = await until((s) => s.flight.phase === "return-wait");
  expect(waiting.pendingFlightSystemKeys).toBeUndefined();
  await expect(page.locator("#audio")).not.toBeChecked();
  await expect(page.locator("#status")).toContainText("Flight complete");
  await page.clock.runFor(1000);
  expect((await state()).scene).toBe("flight");
  const returned = await until((s) => s.scene !== "flight");
  expect(returned.scene).toBe("crash-repairs");
  expect(returned.flight.outcome.status).toBe("crashed");
  expect(returned.flight.tick - waiting.flight.returnWaitTick).toBe(140);
  expect(returned.systemOverlay).toBeNull();
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
