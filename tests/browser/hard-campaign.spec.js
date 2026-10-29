import { test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runLinkedCampaign } from "./helpers/linked-campaign.js";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";

test("Hard campaign carries all four families through the final bank and result", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const capture = process.env.DUCKTALES_CAPTURE_HARD_CAMPAIGN === "1";
  const manifest = capture
    ? { expected: {} }
    : JSON.parse(
        await readFile(
          process.env.DUCKTALES_CAMPAIGN_MANIFEST ??
            "reference/hard-campaign-office.json",
          "utf8",
        ).catch(() => {
          throw Error(
            "SETUP: missing verified Hard campaign manifest; exploratory capture is not acceptance",
          );
        }),
      );
  if (capture)
    await runLinkedCampaign({ page, info, hard: true, capture, manifest });
  else
    await runRecordedCampaign({
      page,
      info,
      manifest,
      negativeMode: process.env.DUCKTALES_RECORDED_NEGATIVE,
    });
});
