import { test, expect } from "@playwright/test";
import manifest from "../../reference/easy-campaign-office.json" with { type: "json" };
import { runLinkedCampaign } from "./helpers/linked-campaign.js";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import { readFile } from "node:fs/promises";

test("one campaign carries four expeditions, rival activity and deposits through the deadline", async ({
  page,
}, info) => {
  test.setTimeout(600000);
  const capture = process.env.DUCKTALES_CAPTURE_EASY_CAMPAIGN === "1";
  const replayManifest = process.env.DUCKTALES_EASY_CAMPAIGN_MANIFEST
    ? JSON.parse(
        await readFile(process.env.DUCKTALES_EASY_CAMPAIGN_MANIFEST, "utf8"),
      )
    : manifest;
  if (capture)
    await runLinkedCampaign({
      page,
      info,
      manifest: { expected: {} },
      capture: true,
    });
  else {
    await runRecordedCampaign({
      page,
      info,
      manifest: replayManifest,
      negativeMode: process.env.DUCKTALES_EASY_RECORDED_NEGATIVE,
    });
    await page.locator("#restart").click();
    await page.clock.runFor(100);
    const fresh = JSON.parse(
      await page.locator("#game").getAttribute("data-state"),
    );
    expect(fresh.scene).toBe("title");
    expect(fresh.money).toBe(0);
    expect(fresh.campaign.banked).toBe(0);
    expect(fresh.campaign.day).toBe(1);
    expect(fresh.campaign.playerCollected).toEqual([]);
    expect(fresh.jungle).toBeNull();
    expect(fresh.mountain).toBeNull();
    expect(fresh.flight).toBeNull();
    await expect(page.locator("#diagnostic")).toBeHidden();
  }
});
