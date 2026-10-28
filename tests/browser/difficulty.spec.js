import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

test("original difficulty pictures, reveal flush, wrapping and Fire priority use real browser controls", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 8);
    cancelAnimationFrame = clearTimeout;
    window.difficultyInitialFrame = null;
    document.addEventListener(
      "gamepresent",
      (e) => {
        const menu = e.detail.difficultyMenu;
        if (
          menu?.ready &&
          menu.inputReads === 0 &&
          menu.wait?.clock === "retrace" &&
          !window.difficultyInitialFrame
        )
          window.difficultyInitialFrame = document
            .getElementById("game")
            .toDataURL();
      },
      true,
    );
  });
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game");
  const state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate, label) {
    for (let i = 0; i < 150; i++) {
      const s = await state();
      if (s) {
        expect(s.diagnostic).toBeNull();
        if (predicate(s)) return s;
      }
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished ${label}: ${await canvas.getAttribute("data-state")}`,
    );
  }
  async function picture(name, url = null) {
    const original = PNG.sync.read(
      await readFile(`.local/difficulty-native-20261028/${name}.png`),
    );
    const actual = PNG.sync.read(
      Buffer.from(
        (url ?? (await canvas.evaluate((c) => c.toDataURL()))).split(",")[1],
        "base64",
      ),
    );
    expect([actual.width, actual.height]).toEqual([320, 200]);
    expect(actual.data.equals(original.data), `Native ${name} pixels`).toBe(
      true,
    );
  }
  const selected = (value) =>
    until(
      (s) =>
        s.difficulty === value &&
        s.difficultyMenu?.ready &&
        s.difficultyMenu.wait?.clock === "driver",
      `selected${value}`,
    );
  await until((s) => s.scene === "title", "first game presentation");
  await canvas.focus();
  await page.keyboard.press("Space");
  await until((s) => s.scene === "difficulty", "difficulty entry");
  // This tap occurs during the source reveal and must be flushed before polling.
  await page.keyboard.press("ArrowDown");
  await selected(0);
  const initial = await page.evaluate(() => window.difficultyInitialFrame);
  expect(initial, "Required initial-page presentation").not.toBeNull();
  await picture("menu-0", initial);
  await picture("selected0");
  if (process.env.DUCKTALES_DIFFICULTY_NEGATIVE !== "omit-up")
    await page.getByRole("button", { name: "Up", exact: true }).click();
  await selected(2);
  await picture("selected2");
  await canvas.screenshot({ path: info.outputPath("difficulty-hard.png") });
  await page.keyboard.press("ArrowDown");
  await selected(0);
  await picture("selected0");
  await page.keyboard.press("ArrowDown");
  await selected(1);
  await picture("selected1");
  await page.keyboard.press("ArrowUp");
  await selected(0);
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.keyboard.down("Space");
  await until((s) => s.difficultyMenu?.phase === "exit", "confirmation wipe");
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowUp");
  expect((await state()).difficulty).toBe(0);
  await page.clock.runFor(100);
  expect((await state()).scene).toBe("difficulty");
  const office = await until((s) => s.scene === "office", "office after wipe");
  expect(office.seed).toBe(1960);
  expect(office.difficulty).toBe(0);
  expect(office.campaign.day).toBe(1);
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
  await canvas.screenshot({ path: info.outputPath("difficulty-office.png") });
});

test("difficulty input polls pause, flush resumed controls and deliver Tandy menu cues", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 8);
    cancelAnimationFrame = clearTimeout;
    window.menuAudioEvents = [];
    document.addEventListener("gameaudio", (e) =>
      window.menuAudioEvents.push(e.detail),
    );
  });
  await page.goto("/");
  await expect(page.locator("#actions")).toBeVisible();
  const canvas = page.locator("#game"),
    device = page.locator("#sound");
  const state = async () => JSON.parse(await canvas.getAttribute("data-state"));
  async function until(predicate, label) {
    for (let i = 0; i < 150; i++) {
      const s = await state();
      if (s) {
        expect(s.diagnostic).toBeNull();
        if (predicate(s)) return s;
      }
      await page.clock.runFor(8);
    }
    throw Error(
      `Unfinished ${label}: ${await canvas.getAttribute("data-state")}`,
    );
  }
  const acknowledgements = () =>
    page.evaluate(() =>
      window.menuAudioEvents
        .filter((e) => e.type === "ack")
        .map((e) => e.argument),
    );
  await until((s) => s.scene === "title", "first presentation");
  await canvas.focus();
  await page.keyboard.press("Space");
  await until(
    (s) => s.difficultyMenu?.ready && s.difficultyMenu.wait?.clock === "driver",
    "menu ready",
  );
  await page.getByLabel("Sound device", { exact: true }).selectOption("tandy");
  await page.getByRole("checkbox", { name: "Sound (reconstructed)" }).check();
  await page.clock.runFor(16);
  await page.getByRole("button", { name: "Up", exact: true }).click();
  await until((s) => s.difficulty === 2, "Hard selection");
  await expect.poll(acknowledgements).toEqual([36]);
  await expect
    .poll(async () => Number(await device.getAttribute("data-signal-samples")))
    .toBeGreaterThan(0);
  await canvas.focus();
  await page.keyboard.press("p");
  const paused = await until(
    (s) => s.systemOverlay?.phase === "waiting",
    "menu pause",
  );
  await page.keyboard.press("ArrowDown");
  await page.clock.runFor(100);
  expect((await state()).difficultyMenu.inputReads).toBe(
    paused.difficultyMenu.inputReads,
  );
  expect((await state()).difficulty).toBe(2);
  await page.keyboard.press("p");
  await until((s) => !s.systemOverlay, "menu resume");
  await page.clock.runFor(150);
  expect((await state()).difficulty).toBe(2);
  await page.keyboard.press("ArrowDown");
  await until((s) => s.difficulty === 0, "fresh direction after resume");
  await expect
    .poll(async () => (await acknowledgements()).length)
    .toBe(Number(await device.getAttribute("data-requests")));
  const before = (await acknowledgements()).length;
  await page.keyboard.press("Enter");
  await until((s) => s.difficultyMenu?.phase === "exit", "confirmation cue");
  await expect.poll(acknowledgements).toHaveLength(before + 1);
  expect((await acknowledgements()).at(-1)).toBe(36);
  await until((s) => s.scene === "office", "office after confirmation");
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
