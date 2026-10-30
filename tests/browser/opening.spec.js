import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
const root = ".local/opening-native-accepted-20261028";
async function open(page) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await page.addInitScript(() => {
    window.openingFrames = [];
    const seen = new Set();
    document.addEventListener(
      "gamepresent",
      (e) => {
        const o = e.detail.opening,
          d = o?.display;
        if (!d || !["reveal", "arrival"].includes(d.kind)) return;
        const key = JSON.stringify(d);
        if (seen.has(key)) return;
        seen.add(key);
        const c = document.getElementById("game");
        window.openingFrames.push({
          display: d,
          pixels: Array.from(
            c.getContext("2d").getImageData(0, 0, 320, 200).data,
          ),
        });
      },
      true,
    );
    window.requestAnimationFrame = (cb) =>
      setTimeout(() => cb(performance.now()), 8);
    window.cancelAnimationFrame = clearTimeout;
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?bios-seed=0");
  const canvas = page.locator("#game");
  await expect(page.locator("#actions")).toBeVisible();
  return {
    canvas,
    errors,
    state: async () => JSON.parse(await canvas.getAttribute("data-state")),
  };
}
test("original opening reveals, arrives, speaks and enters the campaign through real controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  const t = await open(page);
  await page.clock.runFor(6000);
  expect((await t.state()).opening.phase).toBe("kids");
  await t.canvas.screenshot({
    path: ".local/browser-results/opening-dialogue.png",
  });
  await page.clock.runFor(25000);
  const s = await t.state();
  expect(s.scene).toBe("difficulty");
  expect(s.opening.outcome).toEqual({
    status: "complete",
    seed: 3642,
    rngCalls: 136,
  });
  expect(s.opening.presentations).toBe(139);
  expect(s.opening.inputs).toBe(308);
  const frames = await page.evaluate(() => window.openingFrames);
  expect(frames).toHaveLength(16);
  for (let i = 0; i < frames.length; i++) {
    const name =
      i < 11
        ? `natural-${String(i + 1).padStart(2, "0")}`
        : `walk-${String(i - 10).padStart(2, "0")}`;
    const png = PNG.sync.read(await readFile(`${root}/${name}.png`));
    expect(
      Buffer.from(frames[i].pixels).equals(png.data),
      `Native pixels ${name}`,
    ).toBe(true);
  }
  await t.canvas.focus();
  await waitForScene(page, t.canvas, "difficulty");
  await page.keyboard.press("Enter");
  await waitForScene(page, t.canvas, "office");
  const office = await t.state();
  expect(office.scene).toBe("office");
  expect(office.seed).toBe(1960);
  expect(office.campaign.day).toBe(1);
  expect(office.diagnostic).toBeNull();
  expect(t.errors).toEqual([]);
  await t.canvas.screenshot({
    path: ".local/browser-results/opening-office.png",
  });
});
test("Fire during visible reveal completes all rectangles; Restart accepts an initial guard skip", async ({
  page,
}) => {
  const t = await open(page);
  await page.clock.runFor(40);
  expect((await t.state()).opening.display).toEqual({
    kind: "reveal",
    inset: 80,
  });
  await t.canvas.focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(500);
  let s = await t.state();
  expect(s.scene).toBe("difficulty");
  expect(s.opening.outcome).toEqual({
    status: "skipped",
    seed: 0,
    rngCalls: 0,
  });
  expect(s.opening.inputs).toBe(15);
  expect(s.opening.presentations).toBe(12);
  expect(
    (await page.evaluate(() => window.openingFrames)).filter(
      (f) => f.display.kind === "reveal",
    ),
  ).toHaveLength(11);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await t.canvas.focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(100);
  s = await t.state();
  expect(s.scene).toBe("difficulty");
  expect(s.opening.inputs).toBe(1);
  expect(s.opening.presentations).toBe(0);
  expect(s.opening.outcome.status).toBe("skipped");
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
