import { waitForScene, waitForDifficulty } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";

async function tandy(page, suppliedClock = false) {
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  if (suppliedClock) await page.clock.runFor(16);
  await expect(page.locator("#game")).toHaveAttribute("data-scene", "title");
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  if (suppliedClock) {
    // The next display update precedes the next driver/input tick. A queued
    // checkbox change must retain its visible state in this interval.
    await page.clock.runFor(8);
    await expect(
      page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
    ).toBeChecked();
  }
  await expect(page.locator("#sound")).toHaveAttribute(
    "data-context-state",
    "running",
  );
}

test("in-game Tandy stays alive across cues, resets on mute and closes on device change", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await tandy(page);
  const c = page.locator("#game"),
    device = page.locator("#sound");
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "difficulty");
  await waitForDifficulty(c);
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-scene", "office");
  await page
    .getByRole("button", { name: "Enter money bin", exact: true })
    .click();
  await expect(c).toHaveAttribute("data-scene", "money-bin");
  await expect
    .poll(async () => Number(await device.getAttribute("data-signal-samples")))
    .toBeGreaterThan(1024);
  const start = await device.evaluate((a) => ({ ...a.dataset }));
  expect(start.device).toBe("tandy");
  await expect(page.getByLabel("Sound device", { exact: true })).toBeDisabled();
  await expect
    .poll(async () => JSON.parse(await c.getAttribute("data-state")).bin.phase)
    .toBe("idle");
  await c.focus();
  // S is consumed by the original idle input poll; it must mute using the
  // model's flag before the checkbox is repainted at the end of the frame.
  await page.keyboard.press("s");
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).not.toBeChecked();
  await expect(device).toHaveAttribute("data-last-argument", "0");
  await expect(device).toHaveAttribute("data-playback-status", "0");
  await page.keyboard.press("s");
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).toBeChecked();
  await page.keyboard.press("Space");
  await expect
    .poll(async () => JSON.parse(await c.getAttribute("data-state")).bin.phase)
    .toBe("dive");
  await expect
    .poll(async () =>
      Number(await device.getAttribute("data-last-acknowledged")),
    )
    .toBeGreaterThan(Number(start.lastAcknowledged));
  await expect
    .poll(async () => Number(await device.getAttribute("data-frame")))
    .toBeGreaterThan(Number(start.frame));
  await expect(device).toHaveAttribute("data-context-state", "running");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).uncheck();
  await expect(device).toHaveAttribute("data-last-argument", "0");
  await expect(device).toHaveAttribute("data-playback-status", "0");
  await expect(page.getByLabel("Sound device", { exact: true })).toBeEnabled();
  await page
    .getByLabel("Sound device", { exact: true })
    .selectOption("speaker");
  await expect(device).toHaveAttribute("data-context-state", "closed");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(c).toHaveAttribute("data-scene", "title");
  await c.focus();
  await page.keyboard.press("Space");
  await expect(c).toHaveAttribute("data-scene", "difficulty");
  await waitForDifficulty(c);
  await page.keyboard.press("Enter");
  await expect(c).toHaveAttribute("data-scene", "office");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await page
    .getByRole("button", { name: "Enter money bin", exact: true })
    .click();
  await expect
    .poll(() => device.evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
});

test("Tandy flight speed words and cave completion use the real persistent processor", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
    window.audioEvents = [];
    document.addEventListener("gameaudio", (event) =>
      window.audioEvents.push(event.detail),
    );
  });
  await tandy(page, true);
  const c = page.locator("#game"),
    device = page.locator("#sound");
  const state = () => c.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, limit = 10000) {
    for (let i = 0; i < limit; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished Tandy game route: ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  await c.focus();
  await press("Space");
  await waitForScene(page, c, "difficulty");
  await press("Enter");
  await waitForScene(page, c, "office");
  await until((s) => s.scene === "office");
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
  await page.keyboard.down("Space");
  await page.clock.runFor(1200);
  // A delayed browser frame may contain both the S poll and later physics
  // requests. Mute must use the model's flag, not last frame's checkbox value.
  await page.keyboard.press("s");
  await page.clock.fastForward(250);
  await expect
    .poll(async () => {
      const stats = await device.evaluate((a) => ({ ...a.dataset }));
      return stats.requests === stats.lastAcknowledged;
    })
    .toBe(true);
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).not.toBeChecked();
  await expect(device).toHaveAttribute("data-last-argument", "0");
  await expect(device).toHaveAttribute("data-playback-status", "0");
  await page.keyboard.press("s");
  await page.clock.fastForward(250);
  await expect(
    page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
  ).toBeChecked();
  await page.keyboard.down("ArrowDown");
  await page.clock.runFor(300);
  await page.keyboard.up("ArrowDown");
  await page.clock.runFor(800);
  await page.keyboard.up("Space");
  await until((s) => s.scene === "cave");
  await until((s) => s.cave.phase === "exploring");
  for (const target of [9, 1]) {
    await until((s) => s.scene === "cave" && s.cave.phase === "exploring");
    await page.keyboard.down("ArrowUp");
    await page.keyboard.down("Space");
    await until((s) => s.scene === "cave" && s.cave.room === target);
    await page.keyboard.up("Space");
    await page.keyboard.up("ArrowUp");
  }
  const result = await until((s) => s.scene === "expedition-result");
  expect(result.cave.outcome.status).toBe("pit");
  await expect
    .poll(async () => {
      const stats = await device.evaluate((a) => ({ ...a.dataset }));
      return stats.requests === stats.lastAcknowledged;
    })
    .toBe(true);
  const events = await page.evaluate(() => window.audioEvents);
  const acks = events.filter((e) => e.type === "ack");
  expect(acks.some((e) => e.argument === 9)).toBe(true);
  const engine = acks.filter((e) => (e.argument & 255) === 8);
  expect(engine.length).toBeGreaterThan(5);
  expect(new Set(engine.map((e) => e.argument)).size).toBeGreaterThan(1);
  for (const e of engine) expect(e.argument & 2047).toBe(8);
  expect(acks.map((e) => e.sequence)).toEqual(acks.map((_, i) => i + 1));
  const entering = acks.find((e) => e.argument === 71 && e.token !== null);
  expect(entering).toBeDefined();
  expect(entering.busy).toBe(true);
  const completion = events.find(
    (e) => e.type === "complete" && e.token === entering.token,
  );
  expect(completion).toBeDefined();
  expect(completion.busy).toBe(false);
  expect(completion.playbackStatus).toBe(0);
  expect(completion.frame).toBeGreaterThan(entering.frame);
  const stats = await device.evaluate((a) => ({ ...a.dataset }));
  expect(Number(stats.signalSamples)).toBeGreaterThan(1024);
  expect(Number(stats.acknowledgements) + Number(stats.chains)).toBe(
    Number(stats.interrupts),
  );
  expect(stats.contextState).toBe("running");
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
  await page.screenshot({ path: ".local/browser-results/tandy-game-cave.png" });
});

test("in-game Tandy module failure is visible and does not substitute speaker audio", async ({
  page,
}) => {
  let blocked = 0;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    (url) =>
      url.pathname.endsWith("/src/tandy-game-worklet.js") &&
      url.searchParams.has("worker") &&
      url.searchParams.has("url"),
    (route) => {
      blocked++;
      return route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: 'export default "/src/__missing_tandy_game_worklet__.js";',
      });
    },
  );
  await page.goto("/");
  await expect(page.locator("#game")).toHaveAttribute("data-scene", "title");
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await expect.poll(() => blocked).toBe(1);
  await expect(page.locator("#diagnostic")).toContainText("Tandy game audio:");
  await expect(page.locator("#sound")).toHaveAttribute(
    "data-context-state",
    "closed",
  );
  expect(
    await page
      .locator("#sound")
      .evaluate((a) => a.paused && !a.getAttribute("src")),
  ).toBe(true);
  expect(errors).toEqual([]);
});
