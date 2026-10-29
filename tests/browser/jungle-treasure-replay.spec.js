import { test, expect } from "@playwright/test";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import historicalManifest from "../../reference/office-jungle-treasure.json" with { type: "json" };
import { readFile } from "node:fs/promises";
const manifest = process.env.DUCKTALES_JUNGLE_TREASURE_MANIFEST
  ? JSON.parse(
      await readFile(process.env.DUCKTALES_JUNGLE_TREASURE_MANIFEST, "utf8"),
    )
  : historicalManifest;

test("recorded jungle treasure carries independent DOM input through award and duplicate notice", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  // A complete declared stream may await its first independent browser run.
  // runRecordedCampaign still requires every event,state and pixel checkpoint.
  expect(
    manifest.pending === false || manifest.pendingBrowserReplay === true,
  ).toBe(true);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_TREASURE_REPLAY_NEGATIVE,
  });
});
