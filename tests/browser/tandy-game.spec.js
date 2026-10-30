import { waitForDifficulty } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { finishSecurityEntry } from "./helpers/security.js";
import { bankTrips } from "./helpers/bank-trips.js";

async function openAudio(page, deviceName = "tandy") {
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  await expect(page.locator("#game")).toHaveAttribute("data-scene", "title");
  await page
    .getByLabel("Sound device", { exact: true })
    .selectOption(deviceName);
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
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
  await openAudio(page);
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
    .poll(async () => Number(await device.getAttribute("data-signal-samples")))
    .toBeGreaterThan(1024);
  await expect(device).toHaveAttribute("data-device", "speaker");
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(errors).toEqual([]);
});

for (const deviceName of ["tandy", "speaker"]) {
  test(`${deviceName} flight speed words and cave completion use the real persistent processor`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.audioEvents = [];
      document.addEventListener("gameaudio", (event) =>
        window.audioEvents.push(event.detail),
      );
    });
    await openAudio(page, deviceName);
    const c = page.locator("#game"),
      device = page.locator("#sound");
    await expect
      .poll(async () => Number(await device.getAttribute("data-frame")))
      .toBeGreaterThan(1024);
    const state = () => c.getAttribute("data-state").then(JSON.parse);
    async function until(predicate, limit = 10000) {
      for (let i = 0; i < limit; i++) {
        const s = await state();
        if (s?.diagnostic) throw Error(s.diagnostic);
        if (s && predicate(s)) return s;
        await page.waitForTimeout(8);
      }
      throw Error(
        `Unfinished Tandy game route: ${JSON.stringify(await state())}`,
      );
    }
    // Browser acceptance uses visible-state menu choices, not a deterministic
    // replay. Original footer redraws flush brief keys. Each bounded repeated
    // make is recorded explicitly; no game state or audio result is injected.
    const menuInputs = [];
    async function press(key) {
      const before = await state();
      const selectingTravel =
        key === "ArrowRight" && before.scene === "map" && before.campaign.info;
      const confirmingTravel =
        key === "Space" &&
        before.scene === "map" &&
        before.campaign.info &&
        before.campaign.choice === 1;
      for (let attempt = 0; attempt < 12; attempt++) {
        menuInputs.push({ key, attempt });
        await page.keyboard.press(key);
        await page.waitForTimeout(100);
        const after = await state();
        if (
          selectingTravel &&
          after.scene === "map" &&
          after.campaign.choice !== 1
        )
          continue;
        if (
          confirmingTravel &&
          after.scene === "map" &&
          !after.campaign.destination?.confirming
        )
          continue;
        return;
      }
      throw Error(`Menu choice was not consumed: ${key}`);
    }
    await c.focus();
    await press("Space");
    await waitForDifficulty(c);
    await press("Enter");
    await until((s) => s.scene === "office" && s.officeMenu?.ready);
    await until((s) => s.scene === "office");
    await page.locator("#map").click();
    await finishSecurityEntry({ page, until, state });
    await until((s) => s.scene === "map");
    // Real-clock startup may consume a different number of opening RNG polls.
    // Days/actions are checked here; exact seeds belong to fixed-input replays.
    const deposits = await bankTrips({
      page,
      canvas: c,
      state,
      until,
      press,
      count: 2,
    });
    expect(deposits.map((v) => v.day)).toEqual([7, 13]);
    const bounds = await c.boundingBox();
    await c.click({
      position: { x: (bounds.width * 37) / 320, y: (bounds.height * 33) / 200 },
    });
    await press("Space");
    await until((s) => s.campaign.destination?.ready);
    await press("ArrowRight");
    await until(
      (s) => s.campaign.choice === 1 && s.campaign.destination?.ready,
    );
    await press("Space");
    await until((s) => s.scene === "departure");
    expect((await state()).departure.racing).toBe(false);
    await press("Space");
    await until((s) => s.scene === "flight");
    await page.keyboard.down("Space");
    await page.waitForTimeout(1200);
    // A delayed browser frame may contain both the S poll and later physics
    // requests. Mute must use the model's flag, not last frame's checkbox value.
    await page.keyboard.press("s");
    await page.waitForTimeout(250);
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
    await page.waitForTimeout(250);
    await expect(
      page.getByRole("checkbox", { name: "Sound (reconstructed)" }),
    ).toBeChecked();
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(800);
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
    if (deviceName === "speaker")
      expect(engine.some((e) => e.accepted)).toBe(true);
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
    await info.attach("audio-boundary", {
      body: JSON.stringify({ deviceName, menuInputs, events, stats }),
      contentType: "application/json",
    });
    expect(Number(stats.signalSamples)).toBeGreaterThan(1024);
    expect(Number(stats.acknowledgements) + Number(stats.chains)).toBe(
      Number(stats.interrupts),
    );
    expect(stats.contextState).toBe("running");
    await expect(page.locator("#diagnostic")).toBeHidden();
    expect(errors).toEqual([]);
    await page.screenshot({
      path: ".local/browser-results/tandy-game-cave.png",
    });
  });
}

for (const deviceName of ["tandy", "speaker"]) {
  test(`in-game ${deviceName} module failure stops with a visible diagnostic`, async ({
    page,
  }) => {
    let blocked = 0;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(
      (url) =>
        url.pathname.endsWith(`/src/${deviceName}-game-worklet.js`) &&
        url.searchParams.has("worker") &&
        url.searchParams.has("url"),
      (route) => {
        blocked++;
        return route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: `export default "/src/__missing_${deviceName}_game_worklet__.js";`,
        });
      },
    );
    await page.goto("/");
    await expect(page.locator("#game")).toHaveAttribute("data-scene", "title");
    await page
      .getByLabel("Sound device", { exact: true })
      .selectOption(deviceName);
    await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
    await expect.poll(() => blocked).toBe(1);
    await expect(page.locator("#diagnostic")).toContainText(
      deviceName === "tandy" ? "Tandy game audio:" : "PC speaker game audio:",
    );
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
}
