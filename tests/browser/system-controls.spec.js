import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

test("P pauses actual activity, S controls sound, and Escape/F1 quit with No and Yes", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const canvas = page.locator("#game"),
    state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 2000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(16);
    }
    throw Error(
      `unfinished system-controls scenario ${JSON.stringify(await state())}`,
    );
  }
  async function press(key) {
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function pixels() {
    return PNG.sync.read(
      Buffer.from(
        (await canvas.evaluate((c) => c.toDataURL())).split(",")[1],
        "base64",
      ),
    );
  }
  async function popup(kind, png) {
    const expected = PNG.sync.read(await readFile(`.local/system-${kind}.png`));
    const [x, y, w, h] =
      kind === "pause" ? [104, 80, 104, 24] : [39, 87, 234, 18];
    for (let row = y; row < y + h; row++)
      expect(
        Buffer.compare(
          png.data.subarray((row * 320 + x) * 4, (row * 320 + x + w) * 4),
          expected.data.subarray((row * 320 + x) * 4, (row * 320 + x + w) * 4),
        ),
      ).toBe(0);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await press("Enter");
  await page.locator("#money-bin").click();
  await page.clock.runFor(200);
  const moving = await state(),
    image = await pixels();
  expect(moving.scene).toBe("money-bin");
  await press("p");
  await until((s) => s.systemOverlay?.phase === "waiting");
  const frozen = await state(),
    pausedImage = await pixels();
  expect(frozen.bin).toEqual(moving.bin);
  await popup("pause", pausedImage);
  // Exact preservation outside the popup,using independently captured pre-input pixels.
  for (let y = 0; y < 200; y++) {
    const spans =
      y >= 80 && y < 104
        ? [
            [0, 104],
            [208, 320],
          ]
        : [[0, 320]];
    for (const [left, right] of spans) {
      const start = (y * 320 + left) * 4,
        end = (y * 320 + right) * 4;
      expect(
        Buffer.compare(
          pausedImage.data.subarray(start, end),
          image.data.subarray(start, end),
        ),
      ).toBe(0);
    }
  }
  await page.clock.runFor(5000);
  await press("Space");
  await press("ArrowUp");
  expect((await state()).bin).toEqual(frozen.bin);
  expect((await state()).seed).toBe(frozen.seed);
  await press("s");
  await expect(page.locator("#audio")).toBeChecked();
  await canvas.screenshot({ path: ".local/browser-results/system-pause.png" });
  await press("p");
  await until((s) => s.systemOverlay === null);
  await expect
    .poll(() => page.locator("#sound").evaluate((a) => a.readyState))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.locator("#sound").evaluate((a) => a.currentTime))
    .toBeGreaterThan(0);
  await press("s");
  await expect(page.locator("#audio")).not.toBeChecked();
  await until(
    (s) =>
      s.bin.phase === "idle" && s.bin.nextPose === 3 && s.bin.remaining >= 10,
  );
  await press("Space");
  await until((s) => s.scene === "office");
  expect((await state()).money).toBe(1000);
  await page.locator("#map").click();
  await until((s) => s.scene === "map");
  const map = await state();
  await press("Escape");
  expect((await state()).systemOverlay.kind).toBe("quit");
  await popup("quit", await pixels());
  await page.clock.runFor(5000);
  await press("Space");
  expect((await state()).campaign).toEqual(map.campaign);
  expect((await state()).seed).toBe(map.seed);
  await canvas.screenshot({ path: ".local/browser-results/system-quit.png" });
  await press("n");
  expect((await state()).scene).toBe("map");
  expect((await state()).systemOverlay).toBeNull();
  await page.locator("#back").click();
  await until((s) => s.scene === "office");
  await press("F1");
  expect((await state()).systemOverlay.kind).toBe("quit");
  await press("y");
  const quit = await until((s) => s.scene === "ending");
  expect(quit.ending.phase).toBe("credits");
  expect(quit.money).toBe(1000);
  expect(quit.campaign.banked).toBe(0);
  expect(quit.exiting).toBe(true);
  await press("Space");
  await until((s) => s.ending.phase === "farewell");
  await press("Space");
  await until((s) => s.ending.phase === "closed");
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  const restarted = await state();
  expect(restarted.scene).toBe("title");
  expect(restarted.systemOverlay).toBeNull();
  expect(restarted.exiting).toBe(false);
  expect(errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
