import { finishSecurityEntry } from "./security.js";

// Fixed external player route, starting on the map. Results are returned only
// for comparison by the caller; they never select inputs or seed the game.
export async function bankTrips({ page, canvas, state, until, press, count }) {
  if (!Number.isInteger(count) || count < 1 || count > 4)
    throw Error("SETUP: invalid bank trip count");
  const checkpoints = [];
  for (let trip = 0; trip < count; trip++) {
    await until((s) => s.scene === "map");
    const bounds = await canvas.boundingBox();
    await canvas.click({
      position: {
        x: (bounds.width * 212) / 320,
        y: (bounds.height * 131) / 200,
      },
    });
    await press("Space");
    await until((s) => s.scene === "map" && s.campaign.info);
    await press("ArrowRight");
    await until((s) => s.scene === "map" && s.campaign.choice === 1);
    await press("Space");
    await until((s) => s.scene === "bank");
    await page.keyboard.down("Space");
    await until((s) => s.scene === "map");
    await page.keyboard.up("Space");
    await page.locator("#back").click();
    const office = await until((s) => s.scene === "office");
    checkpoints.push({ day: office.campaign.day, seed: office.seed });
    await page.locator("#map").click();
    await finishSecurityEntry({ page, until, state });
    await until((s) => s.scene === "map");
  }
  return checkpoints;
}
