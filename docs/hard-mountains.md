# Hard mountain completion routes

Two fresh Hard Earned Cash campaigns now complete the remaining mountain layouts
through actual browser controls, then bank and restart. Thunderclap Mountain
(slot33, LOC asset4, flags18) uses variant1. Machu Picchu (slot5, LOC asset10,
flags34) uses variant2. Both retain all three lives.

| Route | Mountain inputs | Checkpoints | Pickups | Treasure | Banked on day6 |
| --- | ---: | ---: | ---: | --- | ---: |
| Thunderclap | 494 in29 packets | 59 | 100 | Kenducky Derby Wreath,2000 | 2100 |
| Machu Picchu | 706 in43 packets | 73 | 200 | Thinkas Thinking Cap,2500 | 2700 |

Run `npm run verify:hard-mountains`. It verifies the22 original file identities,
runs both browser routes, then requires a missing hook input to fail at the
intended checkpoint in each. Both positive cases and negative controls are also
part of full `npm run verify`.

## Reproduction and environment

Each case loads the supported original folder, with sound explicitly disabled,
BIOS seed0, a frozen starting browser clock and8ms display callbacks. From the
title, Space,Up,Enter selects Hard. Open the map, click logical49,62 for
Thunderclap or75,130 for Machu Picchu, then Space,Right,Space confirms Launchpad.
The feedback controller holds Fire, observes each display callback and steers
between altitudes25 and40 until the landing approach. It reasserts real held
keys after original obstacle routines clear them. No game or campaign state is
written by the test.

Both one-day flights win in226 action updates and return seed16696. The guide
consumes the shared RNG to6768. The mountain's opening hazard pass consumes the
next draw, so its first browser snapshot already contains5527. The independent
component model has the same opening state;6768 is not the snapshot expectation.
Mountain entry unlocks rival family mask2, unlike the jungle's mask1.

The authored streams turn left, aim/throw the hook, climb ledges, cross platforms
and repeat through row24. Neutral samples release Fire or wait for a current
animation. They are player inputs, not injected clock values or fitted device
results. Each stream must finish completely, with every actor/hook/RNG checkpoint
in order and each sample advancing exactly one action. Treasure is awarded on
day3. Space returns to the map; click212,131 and Space travels to Macaroon.
Hold Fire through banking, then Restart must clear money, ownership and actors.

Independent replay inputs:
[Thunderclap](../reference/thunderclap-expedition-inputs.json),
[Machu Picchu](../reference/machu-expedition-inputs.json).
Separate expected results and source identities:
[Thunderclap](../reference/thunderclap-mountain-browser.json),
[Machu Picchu](../reference/machu-mountain-browser.json).
The shared browser adapter is `tests/browser/hard-expedition-route.js`; both
capture manifests pin its hash separately from the case registration module.
The existing Hard jungle routes use this adapter too and remain regression checks.

## Evidence and limits

The bounded explorer replays every candidate from an explicit component starting
contract. It carries the winning flight memory into the mountain and advances
driver/retrace clocks independently. It never patches an actor, RNG, timer or
score. Browser acceptance subsequently carries its own state and clocks from
the title; the fixed expected checkpoints never drive the controls.

This is independent port regression and browser acceptance, not an original
whole-mountain replay. Existing bounded original terrain, action, hazard, control
and presentation comparisons remain separate; see [mountain evidence](mountain.md).
Only listed actor, hook, geometry, money and RNG fields compare across providers.
Device/presentation counters and original CPU/IRQ phase remain unverified.
No new DOSBox capture, fitted input or memory checkpoint is claimed.

The negative runs replace input5 Fire with neutral, preserving all sequence
lengths. Both must fail `Hard mountain checkpoint5 action`; a timeout, launch
failure or setup failure cannot satisfy the check. Capture/input/dependency
identities, nonzero packet/sample/checkpoint counts, exact comparison fields,
ordered checkpoints and completed sequences are required. Browser diagnostics,
rendering errors and unreleased keys fail acceptance.

Actual keys/pointer targets, flight and mountain snapshots, entry/treasure
screenshots and bank/return states stay in ignored local storage. Pointer
coordinates live in the authored recipe; the recorded event log is diagnostic,
not a standalone pointer replay. Accepted immutable receipts and checksums are
recorded in the manifests and under `.local/hard-thunderclap/` and
`.local/hard-machu/`. Original assets and traces are never committed.


## Verified milestone

Full `npm run verify` passes113 unit checks,65 development browser scenarios and
2 production scenarios, with zero skips and all required original comparisons.
Both missing-hook controls and both existing jungle wrong-climb controls pass.
The full mixed campaign still matches all19 checkpoints. Four Hard-route archives
now include the shared capture dependency; each has14 checksummed artifacts.
The versioned manifests and ignored local receipts point to the immutable copies.
Passing these routes does not establish original whole-level or arbitrary-campaign
parity. The next runtime milestone is the [original opening sequence](opening-investigation.md).
