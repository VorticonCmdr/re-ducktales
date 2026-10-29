import { verifyHardMovementNegative } from "./verify-security-hard-movement-negative.js";
for (const key of ["thunderclap", "machu"])
  await verifyHardMovementNegative(key);
