import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
import { openRecordedApplication } from "./helpers/clock.js";

test("cave input polls pause actors while clocks run and room entry flushes unread keys", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.DUCKTALES_CAVE_TIMING_BROWSER_NEGATIVE) {
    expect(process.env.DUCKTALES_CAVE_TIMING_BROWSER_NEGATIVE).toBe(
      "skip-work",
    );
    await page.route("**/src/game/cave.js*", async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const wait =
        /yield\s*\{\s*clock: "graphics",\s*remaining: 1,\s*until: this.now\(\) \+ work.milliseconds,?\s*\};/g;
      expect(body.match(wait)?.length, "SETUP: cave graphics hooks").toBe(2);
      await route.fulfill({
        response,
        body: body.replace(wait, "/* isolated browser graphics-work bypass */"),
      });
    });
  }
  await openRecordedApplication(page, 1);
  await expect(page.locator("#actions")).toBeVisible();
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
  await waitForScene(page, c, "difficulty");
  await press("Enter");
  await waitForScene(page, c, "office");
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until, state });
  await until((s) => s.scene === "map");
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
  await until((s) => s.campaign.destination?.ready);
  await press("ArrowRight");
  await until((s) => s.campaign.choice === 1 && s.campaign.destination?.ready);
  await press("Space");
  await until((s) => s.scene === "departure");
  expect((await state()).departure.racing).toBe(false);
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
  const first = await until((s) => s.cave.inputReads >= 1);
  expect(first.cave.inputReads).toBe(1);
  const beginning = await page.evaluate(() => performance.now());
  let sourceMilliseconds = first.cave.partyWork.milliseconds;
  expect(first.cave.partyWork.milliseconds).toBeGreaterThan(120);
  for (let input = 2; input <= 5; input++) {
    const next = await until((s) => s.cave.inputReads >= input);
    expect(next.cave.inputReads, "Skipped cave input observation").toBe(input);
    if (input < 5) sourceMilliseconds += next.cave.partyWork.milliseconds;
  }
  const duration = (await page.evaluate(() => performance.now())) - beginning;
  expect(duration, "Cave source drawing cadence").toBeGreaterThanOrEqual(
    sourceMilliseconds - 8,
  );
  // Four retrace alignments, bounded small idle-pose overlays, and the8ms observer.
  expect(duration, "Cave source drawing cadence").toBeLessThanOrEqual(
    sourceMilliseconds + (4 * 1000) / 70.086 + 28,
  );
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
