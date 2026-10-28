// Historical receipt validation; fresh browser execution is separate.
import manifest from "../reference/security-expedition-integration.json" with { type: "json" };
import { verifyBrowserIntegrationReceipts } from "./browser-integration-receipts.js";
await verifyBrowserIntegrationReceipts(manifest, {
  cases: 17,
  sources: 121,
  artifacts: 25,
});
