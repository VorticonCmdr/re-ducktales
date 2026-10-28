import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  // The full expedition replays perform thousands of clock/input handoffs.
  // Bound concurrent renderers so CPU contention cannot consume their timeouts.
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5186", headless: true },
  webServer: {
    command: "npm run dev -- --port 5186 --strictPort",
    url: "http://127.0.0.1:5186",
    // Always test this checkout on a fresh owned server; do not reuse an editor
    // session that may reload or serve another working tree.
    reuseExistingServer: false,
  },
  reporter: "list",
  outputDir: ".local/browser-results",
});
