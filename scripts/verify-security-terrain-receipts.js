// Historical receipt validation; fresh browser execution is separate.
import manifest from "../reference/security-terrain-integration.json" with { type: "json" };
import { verifyBrowserIntegrationReceipts } from "./browser-integration-receipts.js";
await verifyBrowserIntegrationReceipts(manifest, {
  cases: 3,
  sources: 122,
  artifacts: 10,
});
