import { test } from "@playwright/test";
import { runHardExpedition } from "./hard-expedition-route.js";
import thunderManifest from "../../reference/thunderclap-mountain-browser.json" with { type: "json" };
import thunderInputs from "../../reference/thunderclap-expedition-inputs.json" with { type: "json" };
import machuManifest from "../../reference/machu-mountain-browser.json" with { type: "json" };
import machuInputs from "../../reference/machu-expedition-inputs.json" with { type: "json" };

for (const [manifest, inputs, destination] of [
  [thunderManifest, thunderInputs, "Thunderclap"],
  [machuManifest, machuInputs, "Machu Picchu"],
])
  test(`Hard race, ${destination} summit, bank and restart carry real browser state`, async ({
    page,
  }, info) => {
    await runHardExpedition({
      page,
      info,
      manifest,
      inputs,
      activity: "mountain",
      negativeMode: manifest.negativeControl.mode,
    });
  });
