import { test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import catalog from "../../reference/security-hard-expedition-inputs.json" with { type: "json" };
for (const entry of catalog.cases) {
  const manifest = JSON.parse(
    await readFile(`reference/office-hard-${entry.key}.json`),
  );
  test(`Hard ${entry.key} expedition replays independent DOM input through treasure and bank`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    await runRecordedCampaign({
      page,
      info,
      manifest,
      negativeMode: process.env.DUCKTALES_HARD_REPLAY_NEGATIVE,
    });
  });
}
