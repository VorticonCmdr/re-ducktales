# Verification entry point

The current behavior, exact commands, evidence levels and remaining limitations
are maintained in [STATUS.md](STATUS.md). Run `npm run verify` for strict local
acceptance; no missing-fixture or unsupported-route checks are silently skipped.

Original build identities: `reference/build.json`.
Original checkpoint contract: `reference/money-bin-failed.json`.
Reproduction procedure: [original-scenario.md](original-scenario.md).

The existing asset audit still checks all 400 ARC/DRV records, LZW decoded lengths,
726 graphics frames, the font, and 121 PC-speaker sound IDs. These asset checks
establish decoding coverage, not full gameplay fidelity.
