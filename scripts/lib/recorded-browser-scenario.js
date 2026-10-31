import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { runRecordedCampaign } from "../../tests/browser/helpers/recorded-campaign.js";
// Reuse the existing strict timestamped DOM comparator on a fresh page. This
// server/context is owned by this one operation and always closed, including failure.
export async function replayRecordedScenario(
  manifest,
  out,
  negativeMode,
  activity,
) {
  assert.ok(["jungle", "mountain", "photography", "cave"].includes(activity));
  await mkdir(out);
  const cache = await mkdtemp(join(tmpdir(), "ducktales-recorded-scenario-"));
  let server, browser;
  try {
    server = await createServer({
      root: process.cwd(),
      configFile: process.cwd() + "/vite.campaign.config.js",
      cacheDir: cache,
      server: { host: "127.0.0.1", port: 0, strictPort: true },
      logLevel: "error",
    });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:" + server.httpServer.address().port,
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    await runRecordedCampaign({
      page,
      info: { outputPath: (name) => join(out, name) },
      manifest,
      negativeMode,
    });
    const s = JSON.parse(
      await page.locator("#game").getAttribute("data-state"),
    );
    assert.equal(s.money, manifest.expectedOutcome.money);
    await page.locator("#restart").click();
    for (let i = 0; i < 20000; i++) {
      const s = JSON.parse(
        await page.locator("#game").getAttribute("data-state"),
      );
      if (s.diagnostic) throw Error(s.diagnostic);
      if (s.scene === "title") {
        assert.equal(s.money, 0);
        assert.equal(s[activity], null);
        assert.deepEqual(s.campaign.playerCollected, []);
        return {
          completed: true,
          checked: manifest.expectedCheckpointCount,
          consumed: manifest.requiredEventCount,
          restart: true,
        };
      }
      await page.clock.runFor(8);
    }
    throw Error("Unfinished recorded scenario Restart");
  } finally {
    await browser?.close();
    await server?.close();
    await rm(cache, { recursive: true, force: true });
  }
}
