import { test } from "@playwright/test";
import manifest from "../../reference/office-easy-campaign-entry.json" with { type: "json" };
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";

test("recorded office-aware Easy campaign carries real controls through first flight and jungle entry", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_OFFICE_ENTRY_REPLAY_NEGATIVE,
  });
});
