# Mountain expedition

The browser now connects flight/guide → mountain controls → three lost lives →
campaign map → direct retry. Walking, the climbing hook, ledge climbing, hazards,
pickups, camera movement and the summit condition are statically translated.
Browser acceptance covers movement, hook throw, failure/retry and a complete
variant0 ascent with three lives, $100 in pickups, the $8000 treasure award,
calendar/map return and repeat-visit protection.

## Supported source and analysis

Use the exact DUCKTALE.EXE and MT.ARC identities in `reference/build.json`.
Mountain is physical overlay 5, dispatched by INT3F index 0a for expedition
family flag 2. Its MZ record starts at executable file offset 0x17600, is 12514
bytes long, and has a 512-byte header. Overlay SHA-256:
`9ceee31191eb4155ee7136d1101c7954376acdd468153deb608fd90e57edd3ee`.
The 12002-byte body SHA-256 is
`b50591460d43e848d52b49ee7b843065413d877dca8dc75455ce7dca2a7f2bd0`.
This is 16-bit real-mode game code, with far calls and BP-relative stack
arguments, rather than a loader stub. Body entry is offset 0, independently of
the inherited resident startup fields in the overlay MZ header.

`npm run prepare:mountain-analysis` creates ignored analysis files with the
resident image and overlay at image offset 0xc170. Ghidra's import load segment
1000 gives entry 1c17:0000. Original helper segment 0xda0 aliases body offset
0x1890. For example, helper 0xda0:1479 is body offset 0x2d09. Analysis-only fixed
stack-probe normalization and any FPU patches are recorded with hashes in
`.local/analysis/mountain-analysis-patches.json`. No original is modified.

Ghidra's automatic analysis has overlapping/aliased function regions: the
mountain entry decompilation currently follows invalid flow and is not reliable.
The smaller terrain helper decompiles at alias 1d39:044c (same linear address as
1c17:166c); its result agrees with the unmodified overlay disassembly. The live
mountain entry is0e0c:0000, DS/SS1403, helper alias0f95:000e. All12002 overlay
bytes match after applying the68 original relocations with load bias01f5.
Debugger stops44/45 confirmed real mode and the actual game code. Revalidate
this mapping after executable, launch-path or allocation changes.

## Translated terrain boundary

Statically inferred; variant0 initialization also has conditional runtime evidence:

- Entry 0125 selects resident layout pointers 0fec/11fa/1408 and hazard pointers
  1618/16ae/1744 for variants 0/1/2.
- Each layout has 25 rows of 20 ASCII cells plus a NUL terminator. `F` leaves the
  background visible; `0` through `8` select MT sprite 1 frames.
- Helper 166c builds five 40-pixel strips, using successive rows of picture 0
  cyclically modulo five. It overlays tiles and places strips bottom to top at
  y=160,120,80,40,0. The caller copies only y=0..167 into the playfield.
- Initial actor platform is the first non-F column starting at column 1.
  Entry sets x=column*16, y=131, frame=20, action=0, facing=0 and three lives.
  Hazard initialization clears state for types 4,6,9, and the two global hazards.
  This preparation consumes no RNG. The first hazard update consumes the first
  rolling-rock RNG draw, including when that rock is outside the viewport.

`src/game/mountain-scene.js` keeps the original resident tables in an explicit
64K memory object. The terrain renderer emits pure drawing commands and consumes
no inputs, time, RNG or device state.

## Actions and effects

`mountain-actions.js` translates the eleven action cases at 034d..0e47 and the
position/fall logic at 0e60..0f85. `MountainLocals` preserves the 0x52-byte stack
layout separately from DS. All stored words/bytes wrap deliberately; signed
division truncates toward zero. The hook throw rounds its X down to a multiple
of eight on each update. A +4 horizontal velocity therefore does not advance an
already aligned X. This original quirk affects which ledges can be caught.

`mountain-hazards.js` translates helper189e..2829: transport points, two enemy
families, projectiles, shaking platforms, summit flag, $50 pickups, cloud and
rolling rock. Hazards update during original drawing passes, including both
initial pages and four intermediate camera presentations. The partial erase
pass advances pickup states1→2→3; forced redraws skip that effect. Pickup state
persists across lives but resets on a new expedition. Cloud positioning retains
the original discarded candidate-X computation. Action6 preserves the apparent
Y-versus-X comparison mistake at0b10.

`mountain.js` owns input sampling, retrace waits, life restart, HUD, sprite/rope
commands and four-step scrolling. Original helper198e:01d8 is a deadline wait
at life entry; the action loop has no additional per-update driver-tick delay.
Rendering consumes no simulation inputs. MT.ARC and the two MAIN HUD sprites
remain original authoritative resources, also validated during folder loading.
Each sound request is explicit; no mountain mechanic waits for audio completion.

Presentation limitation: the port rebuilds the complete playfield from the
original terrain and current objects while retaining the erase pass's logical
effects. It has not established equivalence for original framebuffer residue,
all scrolling crops or palette changes with remaining lives. Audio remains the
existing reconstructed provider. An exploratory initial PNG comparison still
differs around the upper enemy/transport graphics and palette colors; no pixel
exclusion mask or parity assertion is used. Local images are
`.local/mountain-initial-original.png` and `.local/mountain-initial-port.png`.
Stack locals not initialized by the original entry currently start at zero in
independent runs; the conditional walking comparison supplies its incoming stack allocation
from entry SS before initialization. Allocation/palette behavior outside that
segment remains unverified. This is not a machine checkpoint.

## Verification and next milestone

Run `npm run verify:mountain`. Missing originals or incorrect hashes fail
setup. It checks exact table identities and all 75 variant/scroll positions
against an independently constructed pixel image from the original decoded
assets. Required negative controls alter a background crop and introduce an
invalid frame. Invalid contracts and an unexpected case count fail.

The terrain check is static asset evidence. `reference/mountain-controls.json`
separately defines an independent initial contract, input stream and ten exact
port regression checkpoints. It walks to and climbs the first ledge, catches a
higher ledge with the hook, swings/climbs to row2, drops back to row1 and collects
$50 exactly once. All148 input samples and149 rendered presentations are
required. Omitted Fire, altered cash and a missing checkpoint must fail. This
is closed-loop port evidence, not an original runtime comparison. Its expected
values never supply inputs. No fitted inputs or injections are used in this
independent scenario; the one-tick/one-retrace provider excludes timing parity.

`npm run test:browser -- tests/browser/mountain.spec.js` exercises the actual
keyboard adapter, asset loading and renderer through office/map → El Capitan
departure → takeoff/crash → guide → mountain movement/hook swing/throw → three
lost lives → day increment/map → direct retry with no flight/day → restart.
The browser scenario does not establish the full ascent, all layouts or audio.

`reference/mountain-entry.json` separately pins one conditional initialization
case and its three local artifacts. The verifier checks the complete relocated
overlay and exact actor, lives, RNG, hazard table, global hazards, page state and
MT sprite geometry/frames before the first input poll. A different code byte,
seed or hazard state must fail. The input count is explicitly zero for this
pre-input segment; the executed case/checkpoint count must be one. Driver epoch,
allocation storage, unspecified stack bytes and pixels/audio are outside this
comparison. Expected final memory never supplies the starting state.

Next: extend original comparisons to hook/climbing/hazards, other layouts and
difficulties. The complete browser ascent is documented below. Keep the shared
emulator under one owner and revalidate bytes/addresses after a relaunch.

The original conditional comparison uses a recorded setup injection. PIC scheduling during
map navigation overshot the requested location. At main01f5:0439, stop38, a
single RAM byte at SS1403:[BP-30]=9f5e was changed from slot33 (Duckbill Island)
to slot24 (El Capitan), before travel calculation. The full pre-write CPU/DS and
original code signature are local in `.local/mountain-before-target.json`.
Subsequent flight uses normal game code; the injection is explicit in the
original manifest. It is not a campaign replay. No
executable/resource file was changed and no machine restore was used. Hardware
input queued before Flight's input flush was discarded; the later post-flush
sample at0e0c:02b3, stop42, confirmed actual joystick byte c5 (Fire+Down).
The initialization comparison depends on that setup. It proves only the named
conditional fields, not a campaign or closed-loop original level replay.


## Original walking segment and complete browser ascent

`reference/mountain-movement.json` pins thirty local input/post-state artifacts
from original stops46..75 and reuses the original ENTRY capture. The live address
mapping remains0e0c:031c for the hardware joystick return and0e0c:145d after the
page history update, before flipping. Each input capture records AL independently
from the expected output. The stream is0, thirteen Right bytes3, then0. No new
injection or restore was used. Remove the two capture breakpoints after stop75.
The capture recipe/configuration, hashes, setup injection and exclusions are in
the manifest. Missing/corrupt artifacts fail with setup diagnostics.

The port starts from ENTRY DS plus the incoming82-byte stack allocation at
SS:[entrySP-2-0x52,entrySP-2). This is an explicit external initial-state provider;
it never takes bytes from an expected post-state. `MountainLocals` must receive
it in the constructor because the running generator retains its original locals
object. Independent/browser runs continue to use the zero-filled provider.
Every one of15 updates compares exact actor/action/pose/counters, page histories,
RNG, global cloud/rock records, the full selected hazard table and ten live
BP-relative fields. The port carries its state across all checkpoints. Three
negative controls remove an input, corrupt a result and skip a checkpoint.
This proves a conditional closed-loop walking segment, not original hook,
summit, wall-clock, pixel or complete machine replay equivalence.

`reference/mountain-ascent.json` is a separate independent port regression.
Its764 authored input samples reach row24 with three lives and $100. The26 exact
checkpoints and870 presentations include transport, hook catches, climbing,
scrolling, pickups and summit completion. Every presentation is decoded/rendered.
The route was discovered by an exploratory input-prefix search, then replayed
from its initial state; expected values are port regression outputs and do not
claim original ascent parity. Input events remain independent from expectations.
Three negative controls remove Fire, alter final money and drop a checkpoint.

`tests/browser/mountain-ascent.spec.js` follows title → office → El Capitan
confirmation → ordinary flight/crash → guide → the complete ascent → original
$8000 award → map/day+1 → collected-location notice → restart. All764 samples
pass through actual browser keyboard events and the existing scheduler; all26
checkpoints match,using the corrected startup RNG seeds in
`reference/campaign-startup-browser.json`. Historical conditional-seed ascent
expectations remain in the original manifest. No state is injected. Playwright controls time and supplies
a125Hz display cadence so every70Hz simulation consumption can be observed
without two samples sharing one browser callback. This scenario verifies the
input/render/reward/calendar adapters under that explicit display environment;
it does not establish original wall-clock parity. The existing mountain
failure/retry scenario retains the normal browser animation-frame provider.
The award screenshot is local at
`.local/browser-results/mountain-summit-award.png`.

Commands: `npm run verify:mountain` checks terrain, both independent routes and
both conditional original scenarios. `npx playwright test tests/browser/mountain*.spec.js`
checks the two browser routes. `npm run verify` is the integration gate. Original
hook/ascent and presentation comparisons, variants1/2 and other difficulties
remain work to do. Jungle,photography and trading now have their own playable
routes; normal rival progression remain unfinished.
