import { test, expect } from "@playwright/test";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import manifest from "../../reference/office-jungle-treasure.json" with { type: "json" };

test("recorded jungle treasure carries independent DOM input through award and duplicate notice", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  expect(manifest.pending).toBe(false);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_TREASURE_REPLAY_NEGATIVE,
  });
});
