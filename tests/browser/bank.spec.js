import { test, expect } from "@playwright/test";
import { campaign } from "./helpers/ending-route.js";
// Explored interactively: title,office,map,Macaroon travel,bank pause/resume,
// Fire return to day4 map. Browser holds supply the declared digital provider.
async function enterBank(page, t) {
  await t.enterMap();
  await t.point(212, 131);
  await t.press("Space");
  await t.press("ArrowRight");
  await t.press("Space");
  expect((await t.state()).scene).toBe("bank");
}
test("real bank arrival matches original idle pixels, defers pause and returns through the outro", async ({
  page,
}) => {
  const t = await campaign(page);
  await enterBank(page, t);
  await page.keyboard.press("p");
  await page.keyboard.press("Space");
  await t.until((s) => s.bank?.phase === "idle");
  expect((await t.state()).systemOverlay).toBeNull();
  await t.pixels(".local/bank-idle-before-input.png");
  await t.press("p");
  const paused = await t.until(
    (s) =>
      s.systemOverlay?.kind === "pause" && s.systemOverlay.phase === "waiting",
  );
  const picture = await t.canvas.evaluate((c) => c.toDataURL());
  await page.clock.runFor(1000);
  expect((await t.state()).bank).toEqual(paused.bank);
  expect(await t.canvas.evaluate((c) => c.toDataURL())).toBe(picture);
  await t.press("p");
  await t.until((s) => s.systemOverlay === null);
  await t.press("q");
  await t.until((s) => s.systemOverlay?.kind === "quit");
  await t.press("n");
  await t.until((s) => s.systemOverlay === null);
  await t.canvas.screenshot({ path: ".local/browser-results/bank-zero.png" });
  await t.press("Space");
  await t.until((s) => s.bank?.phase === "outro");
  await t.until((s) => s.scene === "map");
  expect((await t.state()).campaign.day).toBe(4);
  expect((await t.state()).campaign.location).toBe(0);
  expect((await t.state()).bank).toBeNull();
  expect(t.errors).toEqual([]);
  await expect(page.locator("#diagnostic")).toBeHidden();
});
test("earned money is banked once while scales and digits animate, then held Fire returns", async ({
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
  await enterBank(page, t);
  const arrival = await t.state();
  expect(arrival.money).toBe(0);
  expect(arrival.campaign.banked).toBe(1000);
  expect(arrival.bank.playerTier).toBe(0);
  expect(arrival.bank.target).toBe(1);
  await t.until((s) => s.bank?.phase === "numbers" && s.bank.balanceStep === 4);
  await t.until((s) => s.bank?.phase === "idle");
  expect((await t.state()).campaign.banked).toBe(1000);
  await t.canvas.screenshot({ path: ".local/browser-results/bank-earned.png" });
  await page.keyboard.down("Space");
  await t.until((s) => s.scene === "map");
  await page.keyboard.up("Space");
  await page.clock.runFor(16);
  expect((await t.state()).campaign.banked).toBe(1000);
  expect((await t.state()).money).toBe(0);
  expect(t.errors).toEqual([]);
});
