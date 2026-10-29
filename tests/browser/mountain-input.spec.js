import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";
import { openRecordedApplication } from "./helpers/clock.js";

test("mountain polls system keys after opening pages, pauses clocks correctly and clears held keys on life reset", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.DUCKTALES_MOUNTAIN_TIMING_BROWSER_NEGATIVE) {
    expect(process.env.DUCKTALES_MOUNTAIN_TIMING_BROWSER_NEGATIVE).toBe(
      "one-retrace",
    );
    await page.route("**/src/game/mountain.js*", async (route) => {
      const response = await route.fetch(),
        body = await response.text();
      const source = 'yield { clock: "retrace", remaining: retraces };';
      expect(body, "SETUP: missing mountain timing negative hook").toContain(
        source,
      );
      await route.fulfill({
        response,
        body: body.replace(source, 'yield { clock: "retrace", remaining: 1 };'),
      });
    });
  }
  await openRecordedApplication(page, 1);
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
  await finishSecurityEntry({ page, until, state });
  await until((s) => s.scene === "map");
  expect(
    await bankTrips({ page, canvas: c, state, until, press, count: 2 }),
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
  expect((await state()).departure.racing).toBe(false);
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  // Observe the first completed opening page, independently of arrival phase.
  const entered = await until(
    (s) => s.scene === "mountain" && s.mountain.presentations === 1,
  );
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
  const start = await state();
  await page.clock.runFor(600);
  const paced = await state(),
    frames = paced.mountain.frames - start.mountain.frames;
  // Independent fixed-duration DOM input, not an expected-state-timed release.
  expect(frames, "Mountain timed DOM movement").toBeGreaterThanOrEqual(13);
  expect(frames, "Mountain timed DOM movement").toBeLessThanOrEqual(15);
  expect(
    paced.tick - start.tick,
    "Driver clock remains independent",
  ).toBeGreaterThanOrEqual(43);
  expect(
    paced.tick - start.tick,
    "Driver clock remains independent",
  ).toBeLessThanOrEqual(45);
  expect(paced.mountain.spriteWork.calls).toBe(7);
  expect(paced.mountain.spriteWork.retraces).toBe(3);
  await c.screenshot({
    path: ".local/browser-results/mountain-sprite-pacing.png",
  });
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
