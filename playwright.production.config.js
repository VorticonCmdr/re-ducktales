import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testDir: "./tests/production",
  use: { ...base.use, baseURL: "http://127.0.0.1:5191" },
  webServer: {
    command: "npm run preview -- --port 5191 --strictPort",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: false,
  },
  outputDir: ".local/production-browser-results",
});
