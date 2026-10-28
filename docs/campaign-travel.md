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
Confirming an expedition now prepares Launchpad's flight and displays the original
briefing, followed by playable flight and cave arrival. Caves now return through
reward/failure screens. See [departure evidence](expedition-departures.md) and
[cave evidence](cave.md). Other expedition families and stocks now have playable routes. Normal Glomgold
progression is connected; see [rival evidence](rival.md). No original save/load path has been identified; see [the interface audit](system-controls.md). Deadline deposits and endings now
work; see [ending evidence](ending.md). Bank arrival at day30 ends the campaign;
travel to the office on exactly day30 is still allowed. A later arrival redirects
to final banking.

## Evidence and scope

| Rule | Static source | Verification |
| --- | --- | --- |
| Right opens control center; Left investments | overlay 2:03c2–0468, DS:0d02/0d11 | Observed original Right+Space; browser input |
| Campaign starts day 1, location 35 | main 1000:00b4,00e7 | Observed and browser |
| Original location permutation, two RNG calls | main 115a:00d7–02e7 (image 1677–188e) | Statically inferred; seed-specific runtime comparison remains unverified |
| Office cursor (46,139), icon hit box inclusive x22–70,y115–163 | overlay 2:0e19,11b7 | Original map pixels match exactly |
| Closest location uses squared Euclidean distance, strict less-than ties | overlay 2:12b6–1338 | Static; browser selects original location records |
| Cursor clamps x32–285,y28–151; consecutive inputs accelerate and diagonals adjust horizontal steps | overlay 2:1ec8–20ae | 24 exact routine cases; native browser chords/selection; original reader cadence/full-map timing unverified |
| Cost office coordinate is (56,64), independent of icon | main 1000:1099–10eb | Static + original bank/return day changes |
| Shortest wrapped distance on 272×140 map, squared /6606 +1 capped3; same location0 | main 1000:1080–1241; helper 11c4:0176–01d1 | Disassembly checked widths/32-bit multiplication; original 3-day legs; independent boundary checks |
| Bank adds cash with carry, then clears it | main 1000:1036–107f | Zero-cash original checkpoints; nonzero browser/simulation route, not nonzero original comparison |
| Bank clears rare-coin latch | main 1000:0144 | Static + simulation |

Ghidra `OFFICE_MAP.EXE` is original overlay2 with header entry0000:0caa
(loaded analysis address1000:0caa),
reproducible with `npm run prepare:analysis`. Overlay dispatch indices are **not**
physical overlay numbers: INT 3f index 4 offset 000a reaches this routine through
its paragraph-adjusted entry. The early exploratory imports MAP_ANALYSIS and
TRAVEL_ANALYSIS were overlays 3 and 4; neither is the campaign map.

The browser uses the original map, sprites, font, marker positions, and colors.
The opening map PNG matches every RGBA pixel. Location information currently
shows original descriptions and calculated journey duration, omitting treasure
valuation/description. The unlocked atomic aircraft choice is now connected; see
[atomic transport](atomic-transport.md). These screens have no
claim of full pixel parity. Door, security, initial map reveal,
and other transition animations are omitted. The checked EXE's security routine
has an unconditional branch returning success at overlay 2:0c9c–0ca5.

The bank now runs its original scales, balances and idle RNG before returning;
see [bank evidence](bank.md). The environment supplies semantic input and elapsed time through the scheduler.
Browser cursor clicking, buttons, and Back/Office are explicit accessibility
adapters; original keyboard selection remains available. Rendering observes the
simulation and never supplies results. Map polling uses two driver ticks; DOS
instruction/render costs have not been matched. Browser BIOS seed is explicitly
0; original BIOS seeding and RNG consumption by untranslated setup/security/
paths are not a verified full-campaign RNG stream. Stock initialization and daily
updates now consume the shared RNG; see `docs/investments.md`.

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
flight rejection, and restart. `npm run verify` runs all required checks.

Retry/ownership dispatch now follows the original before flight: current failed
expeditions restart via their guide; player/rival collected destinations show
notices and return to the origin map. See [campaign visits](campaign-visits.md)
for original checkpoints, timing/device boundaries and verification scope.



## Map pointer movement

The fixed one-pixel implementation is replaced by `src/game/map-pointer.js`,
a DOM/clock-independent translation of overlay2:1edd..20ae. Its input is the
external reader's AX word. Consecutive cardinal inputs move1,2,3,4,... pixels;
changing direction without neutral retains the counter. Diagonals begin with
horizontal2/vertical1,then adjust the horizontal vector before multiplying by
counter−1. Neutral resets the counter/vector/latch. Fire bitsc0 win over movement,
return1 and leave pointer drawing disabled. The counter uses the source's signed
comparison against256; IMUL/ADD and coordinate updates preserve16-bit wrapping
before clamps. Counter-cap/wrap boundaries have authored static-rule tests.

`reference/map-pointer.json` pins four ignored artifacts,24 original routine
cases and the full8368-byte/180-relocation body. Eight cases observe a native
Right hold at the input-reader return:3 then seven0 inputs. This observation
alone does not establish keyboard typematic behavior. The future hold-release
was explicitly cancelled; its exact dispatch count was not captured,so this is
not a strict event-only acceptance replay. A subsequent three-key release
schedule is verified fully dispatched and inactive.

The other16 cases supply independent authored AX values **at the original
reader return** via explicit CPU writes. They are conditional external-input
injections,not natural original keyboard replay. The checker carries its own
pointer state through all16,compares exact coordinates,counter,vectors,latch,
latched input,sprite coordinates,draw flag and return AX,and never copies an
expected after-state back into the simulation. Missing/corrupt fixtures,zero or
missing cases,missing/unconsumed inputs and any compared difference fail.
Negative controls change state,remove an input and corrupt source code.

Ghidra's default CS1000 for `OFFICE_MAP.EXE` resolves the indirect switch table
incorrectly and produces bad-data warnings. The actual routine executes at
CS0ed6,allocation0e0c+ca paragraphs. Its CS-relative table1320 is physical body1fc0.
The verifier checks that table's eight targets and all relocated body bytes.
Disassembly and live observations,not the faulty decompiled switch,establish the
direction cases. Resident input reader `1124:0002` and scanner `140e:19c5` were
also inspected; their keyboard-table/BIOS/key-repeat paths require separate
consumption-boundary evidence before claiming full input-device fidelity.

The browser supplies held cardinal/diagonal direction words at the existing
2-driver-tick map poll. Opposing arrows cancel at this adapter; releasing one
arrow keeps the other. These chords supply the original eight-direction codes;
they are not a claim about original simultaneous-key priority. Original numpad/
navigation-key diagonal bindings are not yet exposed by this browser adapter. This is a declared browser environment provider,not a
verified reproduction of original keyboard typematic or rendering costs.
`Campaign.pointerMotion` carries the translated counter/vector/latch across
polls and direction changes; neutral clears them. Entering another map preserves
them until the next input poll rather than inventing an entry reset.

Native browser acceptance starts from the real title/office/map UI,holds Right,
adds Up,releases Right,returns to neutral,then uses Down+Right. Exact coordinates
and counters are checked at each poll. Fire opens destination information,Back
cancels,and selecting the Office returns normally. Mouse setup targets logical
pixel centers to avoid CSS/browser rounding into a neighboring pixel; there are
no coordinate tolerances or simulation-state injections. Screenshot:
`.local/browser-results/map-pointer.png`. A separate interactive IAB exploration
also moved diagonally to Machu Picchu.

Run `npm run verify:map-pointer`, `node --test tests/map-pointer.test.js` and
`npx playwright test tests/browser/map-pointer.spec.js`; these are included in
`npm run verify`. Remaining map work is original input-provider/timing alignment,
not the previously missing pointer arithmetic.


The integrated cave acceptance setup now waits for asset-ready controls while
its virtual clock remains frozen,then requires initial tick0 before the first
native key. This makes asynchronous file/network readiness explicit rather
than advancing test time during setup. The prior unchanged c858923 baseline
also exceeded the cave's90-second wall limit; it passed with the readiness wait.
The working focused route passed49.6s and the final full gate passed38.4s.
Gameplay checks,required actions,8ms observation cadence and the90-second limit
are unchanged. Concurrent CPU use was observed,but a unique cause of wall-time
variation is not established. Failed runs are retained in.local/; see STATUS.
