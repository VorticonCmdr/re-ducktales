import { waitForScene } from "./helpers/scene.js";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { parseArchive, imagePixels } from "../../src/assets.js";
import { campaign } from "./helpers/ending-route.js";

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
  await t.until((s) => s.ending.phase === "celebration" && s.ending.ready);
  await t.pixels(".local/ending-winner-second.png");
  await t.press("Space");
  await t.until((s) => s.ending.phase === "replay" && s.ending.ready);
  await t.pixels(".local/ending-replay-yes.png");
  await t.press("Space");
  expect((await t.state()).scene).toBe("difficulty");
  expect((await t.state()).money).toBe(0);
  expect((await t.state()).campaign.banked).toBe(0);
  expect((await t.state()).campaign.day).toBe(1);
  expect((await t.state()).ending).toBeNull();
  await waitForScene(page, t.canvas, "difficulty");
  await t.press("Enter");
  await t.until((s) => s.scene === "office");
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
  await t.until((s) => s.ending.phase === "celebration" && s.ending.ready);
  await t.press("Space");
  await t.until((s) => s.ending.phase === "replay" && s.ending.ready);
  await t.press("ArrowDown");
  expect((await t.state()).ending.choice).toBe(1);
  await t.until((s) => s.ending.choice === 1 && s.ending.ready);
  await t.pixels(".local/ending-replay-no.png");
  await t.press("Space");
  await t.until((s) => s.ending.phase === "credits");
  await t.until(
    (s) =>
      s.ending.phase === "credits" && s.ending.credit === 0 && s.ending.ready,
  );
  await t.press("Space");
  expect((await t.state()).ending.phase).toBe("farewell");
  await t.until((s) => s.ending.phase === "closed");
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
  await t.enterMap();
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
  await t.until((s) => s.ending.phase === "celebration" && s.ending.ready);
  expect((await t.state()).ending.asset).toBe(38);
  // Static helper11 selects MAIN38; this is asset identity, not a new DOSBox capture.
  const original = parseArchive(await readFile("game/MAIN.ARC"))[38];
  const actual = PNG.sync.read(
    Buffer.from(
      (await t.canvas.evaluate((c) => c.toDataURL())).split(",")[1],
      "base64",
    ),
  );
  expect(Buffer.compare(actual.data, Buffer.from(imagePixels(original)))).toBe(
    0,
  );
  await t.press("Space");
  await t.until((s) => s.ending.phase === "replay" && s.ending.ready);
  await expect(page.locator("#diagnostic")).toBeHidden();
  expect(t.errors).toEqual([]);
});
