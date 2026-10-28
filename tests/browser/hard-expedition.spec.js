import { test } from "@playwright/test";
import { runHardExpedition } from "./hard-expedition-route.js";
import bermudaManifest from "../../reference/hard-jungle-browser.json" with { type: "json" };
import bermudaInputs from "../../reference/hard-expedition-inputs.json" with { type: "json" };
import boolaManifest from "../../reference/boola-jungle-browser.json" with { type: "json" };
import boolaInputs from "../../reference/boola-expedition-inputs.json" with { type: "json" };

for (const [manifest, inputs, destination, negativeMode] of [
  [bermudaManifest, bermudaInputs, "Bermuda", "wrong-climb"],
  [boolaManifest, boolaInputs, "Boola", "boola-wrong-climb"],
])
  test(`Hard race, ${destination} treasure, bank and restart carry real browser state`, async ({
    page,
  }, info) => {
    await runHardExpedition({ page, info, manifest, inputs, negativeMode });
  });
