# Campaign travel — supported slice

Build: `reference/build.json`, DOS EXE SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.

## Browser route

Start → choose difficulty → office → **Right+Space** (or Control center).
Click a map position to place the cursor, or hold arrow keys to move it. Fire
opens a location description. The initial choice is Map; Left/Right switches
between Map and Travel, and fire confirms. Choose Macaroon near (212,131),
select Travel, then select the office icon near (46,139) and fire to return.
The first visit takes day 1 to 4; returning takes day 4 to 7.

Macaroon transfers carried cash to banked cash, clears carried cash, and resets
the money-bin coin latch. The office keeps these values. Restart resets the
campaign. The on-screen status distinguishes carried and banked money.

All 35 location records and their descriptions load from verified `LOC.ARC`.
Expedition departures and journeys reaching day 30 stop with diagnostics before
changing campaign state. Expeditions, plane gameplay, Glomgold, stocks, campaign
ending, and save/load remain unsupported.

## Evidence and scope

| Rule | Static source | Verification |
| --- | --- | --- |
| Right opens control center; Left investments | overlay 2:03c2–0468, DS:0d02/0d11 | Observed original Right+Space; browser input |
| Campaign starts day 1, location 35 | main 1000:00b4,00e7 | Observed and browser |
| Original location permutation, two RNG calls | main 115a:00d7–02e7 (image 1677–188e) | Statically inferred; seed-specific runtime comparison remains unverified |
| Office cursor (46,139), icon hit box inclusive x22–70,y115–163 | overlay 2:0e19,11b7 | Original map pixels match exactly |
| Closest location uses squared Euclidean distance, strict less-than ties | overlay 2:12b6–1338 | Static; browser selects original location records |
| Cursor clamps x32–285,y28–151; one-pixel cardinal keyboard polls | overlay 2:1ec8–20ae | Static; browser real keyboard movement; exact input latency unverified |
| Cost office coordinate is (56,64), independent of icon | main 1000:1099–10eb | Static + original bank/return day changes |
| Shortest wrapped distance on 272×140 map, squared /6606 +1 capped3; same location0 | main 1000:1080–1241; helper 11c4:0176–01d1 | Disassembly checked widths/32-bit multiplication; original 3-day legs; independent boundary checks |
| Bank adds cash with carry, then clears it | main 1000:1036–107f | Zero-cash original checkpoints; nonzero browser/simulation route, not nonzero original comparison |
| Bank clears rare-coin latch | main 1000:0144 | Static + simulation |

Ghidra `OFFICE_MAP.EXE` is original overlay 2 normalized to entry 0000:0caa,
reproducible with `npm run prepare:analysis`. Overlay dispatch indices are **not**
physical overlay numbers: INT 3f index 4 offset 000a reaches this routine through
its paragraph-adjusted entry. The early exploratory imports MAP_ANALYSIS and
TRAVEL_ANALYSIS were overlays 3 and 4; neither is the campaign map.

The browser uses the original map, sprites, font, marker positions, and colors.
The opening map PNG matches every RGBA pixel. Location information currently
shows original descriptions and calculated journey duration, omitting treasure
valuation/description and optional extra aircraft choice. These screens have no
claim of full pixel parity. Door, security, bank celebration, initial map reveal,
and other transition animations are omitted. The checked EXE's security routine
has an unconditional branch returning success at overlay 2:0c9c–0ca5.

The environment supplies semantic input and elapsed time through the scheduler.
Browser cursor clicking, buttons, and Escape-to-office are explicit accessibility
adapters; original keyboard selection remains available. Rendering observes the
simulation and never supplies results. Map polling uses two driver ticks; DOS
instruction/render costs have not been matched. Browser BIOS seed is explicitly
0; original BIOS seeding and RNG consumption by untranslated setup/security/
stocks paths are not a verified full-campaign RNG stream.

## Original reproduction and local artifacts

Single owner: this task. DOSBox MCP engine 0.84.0-vc1 (f6d9b), normal core,
3000 cycles, svga_s3, headless/muted, game directory mounted read-only on C.
Launch `DUCKTALE`, hardware N at 1.5s, hardware Space at 6s/8s/10s (100ms pulses).
At office: Right+Space, release, then fire twice through security. Capture the
opening map to `.local/original-map.png` before moving the cursor.

On this fresh run, load paragraph=01f5, DS/SS=1403, helper=0603,
overlay 2 allocation=0e0c. Revalidate these on every launch: live
0e0c:0caa begins `55 8b ec b8 1a 00 9a 9e 1e 03 06 56 c7 46 f2 00`;
0603:0eb8 begins `a1 29 22 05 48 92 d1 c8 d1 c8 d1 c8 a3 29`.
Protected mode was false. At map-loop entry 0e0c:1ec8, actual CS:IP is
0ed6:1228, the same physical address. Breakpoint addresses are segment aliases.

Use emulator-side held keys to move near (212,131), visually confirm Isle of
Macaroon, fire, Right then fire to travel. Hardware key schedules must finish
before starting another schedule. `input_key` itself schedules a pulse and
cannot interrupt an active replay. A conditional map-loop breakpoint can bound
movement using SS:[BP-0xc], but do not inject cursor memory. All capture reads
are observational; no partial restore or complete checkpoint was used.

Capture five reads in a single `batch_execute`: DS:4e0e length1 (day),
5b3c length1 (location), 8cc0 length4 (cash), 5ae2 length4 (bank), 4e26 length2
(coin latch). Save the complete MCP result at these three execution stops:

1. Main 01f5:1036, after arrival before deposit: day4, location0.
2. Main 01f5:1076, after deposit, acknowledging bank animation with fire:
   day4, location0. Cash is zero in this reference.
3. After the map is interactive again, hold Left to the office icon and fire.
   Main 01f5:0133: day7, location35.

The raw reads are `.local/reference-campaign.json`; manifest and SHA-256 pins are
`reference/campaign-bank.json`. Capture-tool queries must confirm each replay
fully dispatched and each stop is newer than the prior stop ID. No final-state
values are used as replay inputs. Original keyboard cursor placement is a
semantic consumption-boundary input, not a timed machine replay; the browser
uses the independent point/select event schedule in the manifest.

`npm run verify:campaign` requires all artifacts, validates checksums and exact
checkpoint counts, carries its own state through bank and return, and checks
omitted-departure and altered-output negative controls. It rejects missing,
corrupt, extra or unfinished checkpoints. `npm run test:browser` adds real input,
original loading/rendering, exact map PNG comparison, cancellation, unsupported
route rejection, and restart. `npm run verify` runs all required checks.
