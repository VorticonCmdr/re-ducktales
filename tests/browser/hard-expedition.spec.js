import { test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { runHardExpedition } from "./hard-expedition-route.js";
import catalog from "../../reference/security-hard-expedition-inputs.json" with { type: "json" };
for (const inputs of catalog.cases.filter((c) => c.activity === "jungle")) {
  const manifest = JSON.parse(
    await readFile(`reference/security-hard-${inputs.key}.json`),
  );
  const destination = inputs.key === "bermuda" ? "Bermuda" : "Boola";
  test(`Hard race, ${destination} treasure, bank and restart carry real browser state`, async ({
    page,
  }, info) => {
    await runHardExpedition({ page, info, manifest, inputs });
  });
}
