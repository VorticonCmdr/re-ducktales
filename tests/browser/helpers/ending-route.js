import { waitForScene } from "./scene.js";
import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { finishSecurityEntry } from "./security.js";

export async function campaign(page, hard = false) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.goto("/");
  const canvas = page.locator("#game");
  const state = () => canvas.getAttribute("data-state").then(JSON.parse);
  async function until(predicate, max = 3000) {
    for (let i = 0; i < max; i++) {
      const s = await state();
      if (s?.diagnostic) throw Error(s.diagnostic);
      if (s && predicate(s)) return s;
      await page.clock.runFor(16);
    }
    throw Error(`unfinished ending scenario ${JSON.stringify(await state())}`);
  }
  async function press(key) {
    if (key === "Escape") await page.locator("#back").click();
    else await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function point(x, y) {
    const r = await canvas.boundingBox();
    await canvas.click({
      position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
    });
    await page.clock.runFor(100);
  }
  async function finishBank() {
    if ((await state()).scene === "bank") {
      await page.keyboard.down("Space");
      await until((s) => s.scene !== "bank");
      await page.keyboard.up("Space");
      await page.clock.runFor(16);
    }
  }
  async function enterMap() {
    await page.locator("#map").click();
    await finishSecurityEntry({ page, until, state });
    return until((s) => s.scene === "map");
  }
  async function bankRoundTrip() {
    if ((await state()).scene === "office") {
      await enterMap();
    }
    expect((await state()).scene).toBe("map");
    await point(212, 131);
    await press("Space");
    await press("ArrowRight");
    await press("Space");
    await finishBank();
    if ((await state()).scene !== "ending") await press("Escape");
    // Crossing the deadline on an office leg forces another final bank call.
    await finishBank();
  }
  async function ending({ waitForReady = true } = {}) {
    for (let trip = 0; trip < 6 && (await state()).scene !== "ending"; trip++)
      await bankRoundTrip();
    const s = await until(
      (s) => s.scene === "ending" && (!waitForReady || s.ending.ready),
    );
    expect(s.ending.phase).toBe("cover");
    return s;
  }
  async function pixels(path) {
    const expected = PNG.sync.read(await readFile(path));
    const actual = PNG.sync.read(
      Buffer.from(
        (await canvas.evaluate((c) => c.toDataURL())).split(",")[1],
        "base64",
      ),
    );
    expect([actual.width, actual.height]).toEqual([320, 200]);
    expect(Buffer.compare(actual.data, expected.data)).toBe(0);
  }
  await until((s) => s.scene === "title");
  await canvas.focus();
  await press("Space");
  await waitForScene(page, canvas, "difficulty");
  if (hard) {
    await press("ArrowUp");
    await until((s) => s.difficulty === 2);
  }
  await press("Enter");
  await until((s) => s.scene === "office");
  return {
    canvas,
    state,
    until,
    press,
    point,
    enterMap,
    ending,
    pixels,
    errors,
  };
}
