import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
// One owner, fresh browser context, ephemeral loopback port, mandatory cleanup.
export async function withRawBrowserPage(fn) {
  const cache = await mkdtemp(join(tmpdir(), "ducktales-consumer-"));
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
    return await fn(await context.newPage());
  } finally {
    await browser?.close();
    await server?.close();
    await rm(cache, { recursive: true, force: true });
  }
}
