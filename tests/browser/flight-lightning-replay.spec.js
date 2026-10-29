import { test, expect } from "@playwright/test";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import manifest from "../../reference/office-lightning.json" with { type: "json" };
test("recorded natural lightning carries independent DOM input through throttle recovery", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  expect(manifest.pending).toBe(false);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_LIGHTNING_REPLAY_NEGATIVE,
  });
});
