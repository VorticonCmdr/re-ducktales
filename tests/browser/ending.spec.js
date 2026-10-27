import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

async function campaign(page, hard = false) {
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
    await page.keyboard.press(key);
    await page.clock.runFor(100);
  }
  async function point(x, y) {
    const r = await canvas.boundingBox();
    await canvas.click({
      position: { x: (r.width * x) / 320, y: (r.height * y) / 200 },
    });
    await page.clock.runFor(100);
  }
  async function bankRoundTrip() {
    if ((await state()).scene === "office") {
      await page.locator("#map").click();
      await page.clock.runFor(100);
    }
    expect((await state()).scene).toBe("map");
    await point(212, 131);
    await press("Space");
    await press("ArrowRight");
    await press("Space");
    if ((await state()).scene !== "ending") await press("Escape");
  }
  async function ending() {
    for (let trip = 0; trip < 6 && (await state()).scene !== "ending"; trip++)
      await bankRoundTrip();
    const s = await until((s) => s.scene === "ending");
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
  if (hard) await press("ArrowUp");
  await press("Enter");
  await until((s) => s.scene === "office");
  return { canvas, state, until, press, point, ending, pixels, errors };
}

test("earned cash reaches the winning ending and Yes starts a fresh campaign", async ({
  page,
}) => {
  const t = await campaign(page);
  await page.keyboard.down("ArrowUp");
  await t.press("Space");
  await page.keyboard.up("ArrowUp");
  await t.until(
    (s) =>
      s.bin?.phase === "idle" && s.bin.nextPose === 3 && s.bin.remaining >= 10,
  );
  await t.press("Space");
  await t.until((s) => s.scene === "office");
  expect((await t.state()).money).toBe(1000);
  await page.locator("#investments").click();
  await page.clock.runFor(100);
  await t.canvas.focus();
  await t.press("Space");
  await t.press("ArrowRight");
  await t.press("Space");
  expect((await t.state()).money).toBe(978);
  expect((await t.state()).investments.shares[10]).toBe(1);
  await t.press("Escape");
  await t.press("Escape");
  await t.press("Space");
  await t.until((s) => s.scene === "office");
  const result = await t.ending();
  expect(result.ending).toMatchObject({
    won: true,
    banked: 978,
    rivalBanked: 0,
    day: 31,
    asset: 36,
  });
  expect(result.money).toBe(0);
  expect(result.investments.shares[10]).toBe(1); // Unliquidated stock is excluded from the banked score.
  expect(result.campaign.location).toBe(0);
  await t.pixels(".local/ending-winner-first.png");
  await page.screenshot({ path: ".local/browser-results/ending-win.png" });
  await t.press("Space");
  await t.until((s) => s.ending.phase === "celebration");
  await t.pixels(".local/ending-winner-second.png");
  await t.press("Space");
  await t.until((s) => s.ending.phase === "replay");
  await t.pixels(".local/ending-replay-yes.png");
  await t.press("Space");
  expect((await t.state()).scene).toBe("difficulty");
  expect((await t.state()).money).toBe(0);
  expect((await t.state()).campaign.banked).toBe(0);
  expect((await t.state()).campaign.day).toBe(1);
  expect((await t.state()).ending).toBeNull();
  await t.press("Enter");
  expect((await t.state()).scene).toBe("office");
  expect((await t.state()).seed).toBe(1960);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(t.errors).toEqual([]);
});

test("a tied campaign wins and No reaches credits and a finished screen", async ({
  page,
}) => {
  const t = await campaign(page);
  const result = await t.ending();
  expect(result.ending).toMatchObject({ won: true, banked: 0, rivalBanked: 0 });
  await t.press("Space");
  await t.press("Space");
  await t.press("ArrowDown");
  expect((await t.state()).ending.choice).toBe(1);
  await t.pixels(".local/ending-replay-no.png");
  await t.press("Space");
  expect((await t.state()).ending.phase).toBe("credits");
  await page.clock.runFor(2000);
  expect((await t.state()).ending.credit).toBe(0);
  await t.press("Space");
  expect((await t.state()).ending.phase).toBe("farewell");
  await page.clock.runFor(4000);
  expect((await t.state()).ending.phase).toBe("closed");
  await expect(page.locator("#status")).toContainText("Game finished");
  await page.locator("#restart").click();
  await page.clock.runFor(100);
  expect((await t.state()).scene).toBe("title");
  expect((await t.state()).ending).toBeNull();
  expect(t.errors).toEqual([]);
});

test("a lost real flight race leads to Glomgold's winning ending", async ({
  page,
}) => {
  test.setTimeout(90000);
  const t = await campaign(page, true);
  await page.locator("#map").click();
  await page.clock.runFor(100);
  await t.point(37, 33);
  await t.press("Space");
  await t.press("ArrowRight");
  await t.press("Space");
  expect((await t.state()).departure.racing).toBe(true);
  await page.keyboard.down("Space");
  await t.until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await t.until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  await t.until((s) => s.scene === "map");
  expect((await t.state()).campaign.rival.money).toBe(4500);
  const result = await t.ending();
  expect(result.ending).toMatchObject({
    won: false,
    banked: 0,
    rivalBanked: 4500,
    day: 31, // Klondike→Macaroon costs2 days; office legs cost3.
    asset: 37,
  });
  await t.press("Space");
  expect((await t.state()).ending.asset).toBe(33);
  await t.press("Space");
  await t.until((s) => s.ending.phase === "replay");
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(t.errors).toEqual([]);
});
