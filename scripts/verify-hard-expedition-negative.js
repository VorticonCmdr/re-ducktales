// Current security-aware routes. Original pre-security manifests remain intact.
import { verifyHardMovementNegative } from "./verify-security-hard-movement-negative.js";
await verifyHardMovementNegative(
  process.argv.includes("--boola") ? "boola" : "bermuda",
);
