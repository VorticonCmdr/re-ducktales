// Historical receipt validation; fresh browser execution is separate.
import manifest from "../reference/security-input-audio-integration.json" with { type: "json" };
import { verifyBrowserIntegrationReceipts } from "./browser-integration-receipts.js";
await verifyBrowserIntegrationReceipts(manifest, {
  cases: 6,
  sources: 122,
  artifacts: 11,
});
