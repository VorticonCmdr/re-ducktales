import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { nextRandom } from "../../src/game/integer.js";

test("photography keyboard target shot, results, campaign return and collected notice", async ({
  page,
}) => {
  test.setTimeout(120000);
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
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 4000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `unfinished photography browser wait: ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  await press("Enter");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await page.locator("#map").click();
  await page.clock.runFor(100);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 46) / 320, y: (bounds.height * 56) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  const arrived = await until(
    (s) => s.scene === "photography" && s.photography.phase === "playing",
  );
  // This observed Yellerstone route crashes, then completes the original
  // repair/arrival path. Landing is covered separately by the cave route.
  expect(arrived.flight.outcome.code).toBe(0);
  expect(arrived.flight.phase).toBe("complete");
  const day = arrived.campaign.day,
    location = arrived.campaign.location,
    money = arrived.money;
  // A real player chooses a visible target, aims, then fires. This adaptive UI
  // acceptance path is separate from fixed-stream deterministic regressions.
  let targetShot = false,
    shots = 0;
  while (shots < 8 && !targetShot) {
    const ready = await until(
      (s) =>
        s.scene !== "photography" ||
        s.photography.phase !== "playing" ||
        s.photography.animals.some(
          (a) => a.place && a.animal === s.photography.target && a.frame === 0,
        ),
    );
    expect(ready.scene).toBe("photography");
    expect(ready.photography.phase).toBe("playing");
    const column = ready.photography.animals.findIndex(
        (a) =>
          a.place && a.animal === ready.photography.target && a.frame === 0,
      ),
      key = ["ArrowLeft", "ArrowUp", "ArrowRight"][column];
    await page.keyboard.down(key);
    await until((s) => s.photography.column === column);
    await page.keyboard.up(key);
    const before = await state(),
      count = before.photography.photoCount;
    await page.keyboard.down("Space");
    await until(
      (s) =>
        s.photography.photoCount > count || s.photography.phase !== "playing",
    );
    await page.keyboard.up("Space");
    shots++;
    targetShot = (await state()).photography.photos.includes(
      ready.photography.target,
    );
  }
  expect(targetShot).toBe(true);
  await expect
    .poll(() => page.locator("#sound").evaluate((a) => a.readyState))
    .toBeGreaterThan(0);
  const shot = await state();
  expect(shot.photography.film).toBeLessThan(12);
  await canvas.screenshot({
    path: ".local/browser-results/photography-shot.png",
  });
  // Spend the remaining film using the real input adapter, without injecting
  // game state, timer values, photos or expected outcomes.
  await page.keyboard.down("Space");
  const results = await until(
    (s) => s.scene === "photography" && s.photography.phase === "results",
    10000,
  );
  await page.keyboard.up("Space");
  const score = results.photography.photos.reduce(
    (sum, p) => sum + (p === results.photography.target ? 500 : p ? 50 : 0),
    0,
  );
  expect(score).toBeGreaterThanOrEqual(500);
  await until(
    (s) =>
      s.scene === "photography" &&
      s.photography.phase === "results" &&
      s.photography.wait?.clock === "driver",
  );
  await canvas.screenshot({
    path: ".local/browser-results/photography-results.png",
  });
  const returned = await until((s) => s.scene === "map", 6000);
  expect(returned.money).toBe(money + score);
  expect(returned.campaign.day).toBe(day + 2);
  expect(returned.campaign.playerCollected).toContain(location);
  expect(returned.photography.outcome.code).toBe(1);
  const preserved = {
    money: returned.money,
    day: returned.campaign.day,
    // The visit's two root dispatches include one normal rival claim (3 draws).
    seed: nextRandom(nextRandom(nextRandom(returned.seed))),
  };
  const afterBounds = await canvas.boundingBox();
  await canvas.click({
    position: {
      x: (afterBounds.width * 46) / 320,
      y: (afterBounds.height * 56) / 200,
    },
  });
  await page.clock.runFor(100);
  await press("Space");
  const report = await until((s) => s.scene === "rival-report", 3000);
  expect(report.rivalReport.busy).toBe(true);
  expect(report.rivalReport.phase).toBe("speech");
  // Media playback uses real time, independently of the controlled game clock.
  // Observe the current speech ending before its successor sound replaces it.
  await page.locator("#sound").evaluate((audio) => {
    audio.setAttribute("data-report-ended", "false");
    audio.addEventListener(
      "ended",
      () => audio.setAttribute("data-report-ended", "true"),
      { once: true },
    );
  });
  await page.clock.resume();
  await expect(canvas).toHaveAttribute("data-scene", "visit-notice", {
    timeout: 12000,
  });
  expect((await state()).visitNotice.reason).toBe("player");
  await expect(page.locator("#sound")).toHaveAttribute(
    "data-report-ended",
    "true",
  );
  await expect(canvas).toHaveAttribute("data-scene", "map", { timeout: 12000 });
  const repeat = await state();
  expect({
    money: repeat.money,
    day: repeat.campaign.day,
    seed: repeat.seed,
  }).toEqual(preserved);
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  expect((await state()).photography).toBeNull();
  expect((await state()).scene).toBe("title");
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
