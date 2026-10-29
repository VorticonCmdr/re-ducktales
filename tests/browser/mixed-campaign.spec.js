import { test } from "@playwright/test";
import manifest from "../../reference/mixed-campaign.json" with { type: "json" };
import { runLinkedCampaign } from "./helpers/linked-campaign.js";

// Independent browser controls, not an original-game campaign replay.
test("one campaign carries four expeditions, rival activity and deposits through the deadline", async ({
  page,
}, info) => {
  // Bounds the host-driven browser handoffs; simulation timing stays explicit.
  test.setTimeout(600000);
  const capture = process.env.DUCKTALES_CAPTURE_EASY_CAMPAIGN === "1";
  await runLinkedCampaign({
    page,
    info,
    manifest: capture ? { expected: {} } : manifest,
    capture,
  });
});
