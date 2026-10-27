# Expedition departures

Supported build: `reference/build.json`, EXE SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
This milestone implements **departure preparation**, through the original flight
call contract. Flight is connected; cave arrival now reaches playable rooms, terminal animations, rewards/failure
and campaign return. Mountain arrival now supports a complete variant0 ascent,
reward and return,plus failure/retry. Jungle arrival now supports keyboard
movement,jumping,hazards,three-life failure,campaign return and direct retry.
A complete Easy/variant0 jungle route reaches the chest,awards$1000,returns to
the campaign and prevents repeat collection. Photography arrival now supports aiming,photographs,results and campaign return.
Target pictures mark the location collected;photo earnings replace the generic
loot award and the original overlay/caller together spend two days.

## Browser behavior

Office → Right+Space → place the map cursor on a destination → fire → Right →
fire. Klondike Mines at (37,33) is a one-day cave journey. Confirming displays
Launchpad's original portrait and randomly selected speech. Cash, banked money,
current location, and campaign day are preserved. The rare-coin latch resets.

The complete seed-0 initialization now produces briefing variant0 and race
roll61; only Hard difficulty races. The preparation state contains destination, activity family, full location
flags, travel duration, updated RNG seed, race flag, and rival route. Fire after
the briefing starts the translated flight with original assets and controls. Restart resets the campaign and departure state.

The pause at this boundary is explicit: the original immediately enters its
flight overlay while the speech remains visible during resource loading. The
port lets the user inspect this briefing before requesting the next activity.
The flight determines its own outcome. A cave arrival now reaches the original
guide, cave gameplay and result screens returning to the map. A confirmed
journey cannot be cancelled during flight; Restart is available.

## Static rules and observations

| Behavior | Source | Evidence scope |
| --- | --- | --- |
| Confirming an ordinary expedition clears DS:4e26 coin latch | main 1000:0e68 | Static; browser simulation carries an earned coin through this transition |
| A different-location journey uses the flight route; same-location skips it | main 1000:0439–045e | Static; no zero-day flight is fabricated |
| Standard aircraft uses Launchpad; atomic transport is gated separately | map overlay 2:1d4e–1d7d; main 1000:0454 | Static; only standard aircraft available in supported current campaign |
| First RNG draw modulo 3 selects speech variant | main 1000:06d9–07fe | Static; captured variant 1 matches browser pixels exactly |
| Second RNG draw modulo 100 tests strict thresholds 25/50/75 by difficulty | main 1000:0758–0845 | Static + conditional original segment comparison; synthetic threshold checks |
| Race is suppressed if rival already collected this location | main 1000:0820–0831 | Static + synthetic case; Glomgold campaign progression is not implemented |
| Race writes rival current/next locations to origin/destination | main 1000:0837–0842; 126b:032d | Original DS:0581 and DS:358e reads match prepared route |
| Flight arguments are two 16-bit stack words: duration, race flag | main 1000:0845–0855; overlay 4:0000–0080 | Live stack exactly matches; duration*42 is set by flight initialization |
| Day/current location still unchanged on flight entry | main 1000:084d; 04ca is reached after flight return | Observed day7/location35 at both stops; independent browser preserves its day1/location35 |
| Activity dispatcher uses location flags &15: 1 jungle,2 mountain,4 photography,8 cave; variant flags >>4 | main 12bb:0002–00fd (image 2bb2–2cad) | Disassembly resolves misleading decompiled control flow; all four classifications exercised in browser |

Speech reads from the user's unpacked EXE data segment (image offset 120e0),
not copied text constants. `src/game/executable.js` mirrors the existing local
EXEPACK preparation algorithm solely to read assets. It neither executes code
nor applies relocations. The image SHA-256 is independently pinned against
`scripts/prepare-analysis.py` output:
`47e622175ccf124edab2ed1b5ccb725045d5e54b5766428f8309303fcdf5564d`.

Portrait helper 11c4:0008 called with 3 selects MAIN.ARC resource30. Text rows are
x168,y60/76/92 in original font/color15. String offsets are 0186/0199/01a7,
01b8/01c1/01d0, or 01d9/01e2/01ec. The variant-1 full-screen RGBA comparison is
exact, with no excluded pixels or tolerance. Other variants are statically
translated but have no captured pixel comparison.

## Reference scenario and artifacts

Continue the original `campaign-bank` recipe at day7 in the office, Easy Money,
zero cash. Right+Space opens the map. Hold Up from the office icon until the
cursor is near Klondike at (37,33); release. Fire for details, Right to select
travel, then fire to confirm. The actual runtime record for Klondike is slot25
in this campaign (LOC.ARC resource1, flags8). The independent seed-0 browser
campaign has Klondike at slot1; these identities must not be conflated.

Environment: DOSBox MCP 0.84.0-vc1 (f6d9b), normal core, 3000 cycles, svga_s3,
headless/muted, original game directory mounted read-only. Main load paragraph
01f5, helper0603, DS/SS1403. Pause before adding breakpoints, arm with continue,
and wait for a newer stop ID. Revalidate addresses for every executable launch.
No memory or register injection, partial restore, or full machine checkpoint
was used. This task alone owned the live session.

Capture these stops and batch reads into `.local/reference-departure.json`:

1. **Before first RNG draw**, main 01f5:06d9. Capture registers; DS:2229 length2
   (seed), DS:4e0e length1 (day), DS:5b3c length1 (current location), DS:8990 length1
   (difficulty), DS:4e26 length2 (coin latch), SS:[BP-30] length30 (locals).
   Observed seed a2fd, day7, location35, difficulty0, destination25, duration1.
2. **Prepared**, main 01f5:0845. Repeat those reads, plus DS:0581 length1 and
   DS:358e length1 for rival origin/target. Observe seed071e, race1, rival35→25;
   day/location unchanged. Capture raw PNG `.local/original-departure.png` here.
3. **Flight entry**, 0e0c:0000. Capture registers, SS:[SP] length8, seed/day/
   current location, and 16 code bytes. Stack after far return address is duration1,
   race1. Code bytes `55 8b ec b8 1c 00 9a 9e 1e 03 06 56 c6 06 c1 03`
   match overlay4 with the original relocated helper segment. Protected mode is
   false. No game code was patched for this comparison.

The entry capture is retained; subsequent flight investigation has advanced the
live session beyond it. See `docs/flight.md` for its current state. Prepared Ghidra
`FLIGHT_ANALYSIS.EXE` is reproducible via `npm run prepare:analysis`. Its entry is
normalized to 0; its decompiler currently truncates at software floating-point
INT instructions. This program is actual game code, but that C is not a faithful
flight translation. The new combined analysis copy described in `docs/flight.md`
exposes those floating-point operations; its physics translation now has exact
conditional routine comparisons. It is now integrated into browser gameplay.

## Verification levels and limits

`reference/expedition-departure.json` pins local artifacts and input contracts.
`npm run verify:departure` requires them, validates checksums and fixed counts,
and compares the two original output checkpoints (prepared state and entry
arguments) exactly. It rejects altered duration and an omitted RNG draw.

This is a **conditional routine comparison**: captured internal seed a2fd and
runtime slot25 are explicit initial conditions. They are not external environment
events, and the check is not an independent whole-campaign replay. No input is
fitted from the expected final state. The independent browser run uses its own
seed0 provider, real map input, asset loading, and the port's location permutation;
it now reaches variant0 after complete loot initialization. The original variant1
image uses a separate explicit conditional renderer case.

`npm run test:browser` compares that briefing image and exercises all four
activity families, flight controls/outcomes, cave room navigation, and restart. `npm test` additionally
checks cash/latch preservation, seed consumption, signed/width boundaries,
classification, malformed executable input, and strict difficulty thresholds.
`npm run verify` includes these checks and all previous regressions.

Flight input, terrain, racing and crash/cash consequences are connected. Cave
arrival, cave navigation and terminal results work. Mountain variant0 ascent,
reward and retries also work; see `docs/mountain.md`. Original ending comparison,
other jungle variants/difficulties,photography,atomic aircraft and normal Glomgold/stock progression remain
incomplete.

Campaign startup now includes original random loot assignment. With BIOS seed0,
first Klondike preparation is variant0/seed18461/race roll61, so only Hard races.
The old variant1 pixel check is explicitly conditional; the browser default
scenario uses its corrected initialization. See docs/treasure-assignment.md.
