import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";

test("recorded physical campaign carries jungle, Safari and cave treasure through the bank", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const manifest = JSON.parse(
    await readFile("reference/current-campaign-progress.json"),
  );
  expect(manifest.milestone).toBe("campaign-progress");
  expect(manifest.physicalKeyboard).toBe(true);
  expect(manifest.expectedCheckpointCount).toBe(24);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_CURRENT_CAMPAIGN_NEGATIVE,
  });
  await page
    .locator("#game")
    .screenshot({ path: info.outputPath("current-campaign-map.png") });
});
