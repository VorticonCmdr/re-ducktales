import { test, expect } from "@playwright/test";
import { runRecordedCampaign } from "./helpers/recorded-campaign.js";
import historicalManifest from "../../reference/office-mountain-ascent.json" with { type: "json" };
import { readFile } from "node:fs/promises";
const manifest = process.env.DUCKTALES_MOUNTAIN_ASCENT_MANIFEST
  ? JSON.parse(
      await readFile(process.env.DUCKTALES_MOUNTAIN_ASCENT_MANIFEST, "utf8"),
    )
  : historicalManifest;

test("recorded mountain summit carries independent DOM input through rival reports and duplicate notice", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  // Bootstrap only a declared complete stream; the replay still checks every
  // required event, carried state and complete picture independently.
  expect(
    manifest.pending === false || manifest.pendingBrowserReplay === true,
  ).toBe(true);
  await runRecordedCampaign({
    page,
    info,
    manifest,
    negativeMode: process.env.DUCKTALES_MOUNTAIN_REPLAY_NEGATIVE,
  });
});
