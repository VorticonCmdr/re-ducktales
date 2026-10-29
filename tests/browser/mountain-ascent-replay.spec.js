import { test, expect } from "@playwright/test";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import manifest from "../../reference/security-mountain-ascent.json" with { type: "json" };

test("recorded mountain summit carries independent DOM input through rival reports and duplicate notice", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  expect(manifest.pending).toBe(false);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_MOUNTAIN_REPLAY_NEGATIVE,
  });
});
