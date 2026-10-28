import { expect } from "@playwright/test";
import { finishSecurityEntry } from "./security.js";
import { bankTrips } from "./bank-trips.js";

// The recorded BIOS0/Easy route from the office. Expected observations are
// compared separately; the player controls and destination are fixed.
export async function easyJungleEntry({ page, canvas, state, until, press }) {
  await page.locator("#map").click();
  await finishSecurityEntry({ page, until, state });
  expect(
    await bankTrips({ page, canvas, state, until, press, count: 2 }),
  ).toEqual([
    { day: 7, seed: 62042 },
    { day: 13, seed: 19313 },
  ]);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: (bounds.width * 64) / 320, y: (bounds.height * 73) / 200 },
  });
  await page.clock.runFor(100);
  await press("Space");
  await press("ArrowRight");
  await press("Space");
  expect((await state()).departure.racing).toBe(false);
  await page.keyboard.down("Space");
  await until((s) => s.scene === "flight" && s.flight.speed > 4);
  await page.keyboard.down("ArrowDown");
  await until((s) => s.flight.heading > 0);
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("Space");
  return until((s) => s.scene === "jungle");
}
