import { test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import catalog from "../../reference/office-hard-expeditions.json" with { type: "json" };
for (const entry of catalog.cases) {
  const manifest = JSON.parse(
    await readFile(catalog.artifacts[`entry-manifest-${entry.key}`].path),
  );
  test(`Hard ${entry.key} entry replays independent DOM input through security and the race`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    await runRecordedCampaign({ page, info, manifest });
  });
}
