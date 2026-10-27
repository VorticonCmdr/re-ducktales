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
all scrolling crops or complete-frame palette presentation. Life-color writes and
their logical-color conversion are now implemented and checked below. Audio remains the
existing reconstructed provider. An old exploratory initial PNG comparison
differs around the upper enemy/transport graphics; capture alignment is not
established. It is not acceptance evidence and has no pixel-exclusion mask.
`.local/mountain-initial-original.png` is retained for that investigation;
the old unmapped port image is not a current rendering reference.
Stack locals not initialized by the original entry currently start at zero in
independent runs; the conditional walking comparison supplies its incoming stack allocation
from entry SS before initialization. Allocation behavior and complete-scene presentation outside that
segment remain unverified. This is not a machine checkpoint.

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
routes; [normal rival progression](rival.md) is also connected.


## Life palettes

Overlay5:022f–0274 changes DS205b/2063 (logical palette slots5/13) before each
life's initial pages. Ghidra disassembly agrees with original overlay bytes.
The same supported EGA008e handler used by jungle rendering converts those codes
(hexadecimal byte values):

| Lives | DS205b | DS2063 | Display color |
| --- | --- | --- | --- |
| 3 | 84 | 8c | red,#aa0000 |
| 2 | 49 | 41 | blue,#0000aa |
| 1 | c2 | 4a | green,#00aa00 |

`Mountain.resetLife` preserves those byte writes. The shared `ega-palette.js`
reads the original table; mountain and jungle both use its color conversion.
Mountain rendering caches logical terrain separately from mapped pixels,so a
palette change recolors the currently visible page without changing assets or
rerasterizing terrain. Rendering does not advance or alter simulation memory.
The asset viewer retains the original logical asset colors.

`npm run verify:mountain-palette` requires the parent mountain-entry artifacts and
three reused checksummed captures in `reference/mountain-palette.json`. Its parent
checks all12002 original overlay bytes and68 relocations. The new checks compare
all16 original life3 palette bytes,match the three palette-write instruction
branches and the shared original IT.DRV handler,and render48 logical-color
swatches. The same command page is rendered through3/2/1 conditions to reject
stale palette caching. Changed source bytes,changed pixels and missing life cases
are negative controls. The full `verify:mountain` command includes these checks
and now renders its control/ascent presentations through the mountain palette.

The initial mountain state inherits the explicit travel-target injection already
recorded by `reference/mountain-entry.json`. Life2/1 here are authored static-rule
conditions,not new original mountain captures. Shared driver evidence comes from
`reference/jungle-scene.json`; its eight exact original jungle images remain
regressions for the extracted converter. No old exploratory mountain PNG has
been promoted into a whole-frame golden or given a pixel-exclusion mask.

The native browser route uses actual keyboard flight,walking,hook throw and
walking off ledges through all three lives. A render observer checks the32×32
standing sprite after each natural reset: no logical-purple residue and at least
80 pixels of the required life color. Keys release at each life boundary before
moving again. Browser time is explicit; four8ms display callbacks run per32ms
observation while the70Hz simulation clock stays independent. The60-second
scenario limit is unchanged.
This is browser acceptance and source-derived color verification,not an original
complete-level pixel/timing comparison. Original whole-frame/scrolling/erase
behavior remains future work; input-poll evidence is documented below.

The existing ascent browser replay still consumes764 inputs and all26 checkpoints
within its120-second limit. A first1ms step aligns observations to a display
callback; subsequent8ms steps land on exactly the same callback boundaries and
still require precisely one consumed simulation frame per input. This removes
redundant browser queries without dropping inputs or fitting expected states.
The palette converter uses native packed pixel views built through byte arrays,
so it preserves alpha without assuming machine endianness. Original jungle
whole-frame comparisons validate the extracted and optimized shared conversion.

## Input polls,pause and life-reset controls

Mountain reads controls at overlay5:0317,after the two opening pages and after
each later action presentation. P/Q/S make/release flags wait for that reader.
Pause suspends its call; resume returns neutral input through the same call.
The driver/retrace clocks keep advancing while actor state and the independent
four-tick life deadline stay fixed. Mountain has no extra per-action driver wait.

Original19a5 calls at0014,016a and0278 clear both the BIOS queue and128-byte key
table. The port performs the entry/post-load clears around synchronous loading,
and the per-life clear immediately before preparing the opening pages. The
environment callback clears pending system keys and browser held controls. A
still-held arrow therefore requires a fresh keydown after a life reset.
`waitingForInputPoll` appears only while the iterator is suspended inside input;
normal and completed snapshots retain their previous deterministic shape.

The fresh original route used normal travel from Carlsbad Caverns to El Capitan
(ordinal17 in this run),without game/CPU memory writes or restores. Its live
location pointer table atDS4e2a establishes the name and target; resource ordinals
are not assumed stable. Native MT entry545 and input546 use0e0c:0000/0317 with
DS/SS1403,normal core,real mode. Complete12002-byte code/68-relocation identity
and resident input,pause,deadline and flush bytes are checked against the hashed
EXE. Ghidra `MOUNTAIN_CODE.EXE`,x86 16-bit real mode,normalizes the overlay at
1c17:0000; its instructions0317,016a and0278 agree with those live bytes. This
contains actual game code,not the EXEPACK loader. The far entry follows the
existing16-bit caller contract; the input byte returns inAL.

`reference/mountain-input.json` pins14 local artifacts,all input schedules and
the starting recipe. The six original checks cover code/mode/target identity,
pause state and advancing clock,neutral input return,held Right cleared at a
life2 reset,the popup crop and complete replay-event consumption. Comparisons
preserve the full52-byte mountain local frame plus named actor,hazard,palette,
RNG,cash,day,page-history and deadline ranges. They do not compare all DS or
driver scratch. The captured pause spans190 driver ticks; that observed value
is checked as output and is never supplied to the independent replay.

At stop551,0278 sees a held Right byte80 atDS27b9,with two lives. At552,0317,
the entire128-byte key table is zero. Both states also carry the original blue
life2 palette49/41. This adds a native second-life observation to the earlier
static palette evidence; life1 still has static/browser evidence only.

The independent controller replay starts from its own authored state and event
stream. It pauses after both opening pages,preserves all port DS/locals for200
clock steps,resumes through the suspended reader,walks into a natural life loss
and continues after its flush. An unread P is explicitly supplied at the flush
callback boundary to check discarding; this is an authored environment condition,
not an original captured P-at-reset replay. Six negative controls alter preserved
state,flushed keys,popup pixels,pause input,clock advancement and the flush callback.

The native browser scenario flies/crashes/arrives,presses P between opening
pages,compares the exact104×24 pause crop,checks frozen actors/advancing clocks,
resumes,uses Quit/No and walks through a life reset while keeping Right physically
down. It checks neutral movement afterward and Restart. No game state,timer or
audio completion is injected. Quit/No uses the shared statically verified input
path; it is not a new original mountain Quit/No capture.

```sh
npm run verify:mountain-input
npm run verify:mountain
npx playwright test tests/browser/mountain-input.spec.js tests/browser/mountain.spec.js tests/browser/mountain-ascent.spec.js
```

This is a bounded original input/pause/reset comparison,an independent controller
replay and browser acceptance. Complete original mountain movement,scrolling,
framebuffer residue,timing and other variants/difficulties remain unproven.
