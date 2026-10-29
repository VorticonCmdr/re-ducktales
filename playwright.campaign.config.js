import base from "./playwright.config.js";

export default {
  ...base,
  use: { ...base.use, baseURL: "http://127.0.0.1:5212" },
  webServer: {
    command:
      "npm run dev -- --config vite.campaign.config.js --port 5212 --strictPort",
    url: "http://127.0.0.1:5212",
    reuseExistingServer: false,
  },
  outputDir: ".local/campaign-browser-results",
};
