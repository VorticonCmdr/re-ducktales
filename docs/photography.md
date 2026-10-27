# Photography expedition

The browser now supports flight/repair arrival → guide → aiming with Left/Up/Right
→ twelve photographs → results → campaign map. Target photographs pay$500,
ordinary photographs$50,and a target picture marks the location collected.
Photography spends **two campaign days**: one inside the overlay and one in its
caller. Results already credit the photo earnings,so no additional loot award is
added. A collected location shows the original notice and cannot pay again.

The implementation uses the original PS.ARC sprites and scenery,original byte
records,RNG,pose transitions and seven-tick poll interval. Input,driver and
retrace clocks,dialogue fire and audio effects cross explicit interfaces.
Browser acceptance covers Easy/variant1,including sound and a target-picture
result. The tested route crashes during flight,then completes the translated
repair/arrival path; landing is covered separately by the cave scenario.
Other photography variants have static implementation; independent regressions
also exercise Hard/variant5 misses and Standard/variant6 timeout. Whole original
expedition timing,all species branches and all browser variants remain unverified.

## Original identity and analysis

Supported pairing: `reference/build.json`, original `game/DUCKTALE.EXE` and
`game/PS.ARC`. Physical overlay7 starts at EXE offset1d800, declared length8436,
512-byte MZ header,7924-byte code body and93 relocations. Overlay SHA-256:
`fb2eb3f7c329c64b4b3511f0eca497b399afab37dd3bba5f121f111ec7ab378b`.
Code-body SHA-256:
`f9af75d9397eb95d39f0c9eb3670cdb1237f21c4fdd3d9487f12cdf6d637cf6c`.
The executable/resource file hashes remain in the supported build manifest.

This is actual16-bit real-mode game code, far cdecl calls, no protected-mode
extender. Main0000..1225 contains the expedition; the remaining code contains
animal and presentation helpers. The resident EXEPACK image and overlay loader
are shared with the verified existing expeditions. Main opens the archive named
by original DS1a38 (`ps.arc`), not the jungle archive.

`npm run prepare:photography-analysis` creates the ignored analysis-only
`.local/analysis/PHOTOGRAPHY_CODE.EXE`. Originals are never modified. The preparation
normalizes recognized compiler stack probes in an analysis copy, using the
existing preparation infrastructure. This overlay has zero software-FPU escapes.
Open Ghidra program `PHOTOGRAPHY_CODE.EXE`, x86:LE:16:Real Mode. Main is
1c17:0000; helper0d39:0006 is Ghidra1d39:0006 (body1226). Main decompilation times
out; some embedded switch tables produce invalid overlapping instruction flows
and misleading decompiled C. Consult original disassembly, resynchronizing at
confirmed branch targets. In particular, helper1b04's table is at body1bf1;
entries are offsets relative to original segment0d39, not body offsets.

At live entry334 the **entire7924-byte body**, with all93 original relocation
operands adjusted by load bias01f5, matches memory exactly. Original segment0c17
is live0e0c; original0d39 is live0f2e. A breakpoint at alias0f95:042a can stop with
actual CS:IP0f2e:0a9a; compare physical addresses and retain actual CPU registers.
DS/SS1403. This mapping applies to this launch and must be revalidated after a
new launch/layout change.

## Rules and evidence

| Rule | Original body location | Evidence |
| --- | --- | --- |
| One RNG draw AND15 selects the target for one of six variants | 006b..0249 | Static96 branch-boundary cases; original variant1 selects44 |
| Companion0 is target minus16; five other IDs come from executable DS1a4a + variant*10 | 1226..1262 | Exact original helper comparison |
|32 metadata records repeat the same16 masks/widths/heights | 05d4..06fe | Exact metadata comparison with original initialization; unrelated loader state not compared |
| Metadata byte0 is a placement eligibility mask, not an animation duration | 1cba..1eab | Static mask AND; original accepted and rejected attempts |
| Empty-slot chance draws occur left,right,center; timer stages0..2,3..8,9+ change chance thresholds | 136f..148b | 11 conditional original whole-pass comparisons |
| Target branch consumes two draws; ordinary-animal branch consumes three | 1cba..1eab | Three original target-branch cases (two rejected, one accepted); ordinary branch static only |
| Spawn writes place,animal,frame0,phase1,countdown,width,height; Easy slows an unselected column | 1cba..1eab | Exact original accepted center spawn plus two rejected cases |
| Position depends on place1..14 and original record dimensions | 1b04..1c24 | Static all placements; exact original target at place14 before draw |
| Foreground objects are drawn after the animal in a fixed place-specific order | 1c2e..1cb9 | Exact original gameplay PNG with fixed EGA capture alignment |
| Shutter accepts frame<4 for animals16/32,otherwise frame<3; inactive slot has limit0 | 1263..128e,0944 | Static; original valid hit observed |
| Hit sets special frame/countdown/phase; animals19/35 reset phase and countdown to0 | 128f..12d1 | Exact original target44 reaction; special species branches static only |
| Miss pays0,ordinary picture$50,target picture$500; amounts add to DWORD cash | 1094..11b5 | Original two-target result$1000,cash1094→2094 matches; ordinary payout static only |
| Any target picture marks the current location collected; every result spends a day | 1204..1225 | Original success return AX1,slot7 claimed,day25→26 |

The module deliberately retains original DS widths and RNG. It does not use
wall time, DOM, host randomness or captured state in production. Drawing and
sound are explicit effects; the original sound driver itself has not been
translated or compared by these checks. `settlePhotographyResults` is a single
results pass; the runtime invokes it once. Resource disposal is handled by JavaScript ownership. The runtime translates the
striped wipes/reveals,dialogue wait and border flash state; full original timing
comparisons remain outstanding.

Main's timer interval is seven driver ticks. Difficulty chooses a signed byte
50/40/30, compared with a **postincremented** signed word counter. After the first
counter expiration, subsequent expirations advance the timer sprite through
frame10. A shot runs four animal/draw/flip passes and bypasses that timer update.
Fire is latched only after a successful hit; an inactive selected slot clears
the latch. These rules are implemented in `src/game/photography.js`. Main0987 also tests a result slot using the reused
local loop index for an ordinary-picture sound; do not silently replace that
quirk with an assumed current-picture check. The translated locals retain that
reused index and the initialized aim coordinates it can reference.

## Original-scenario

Single owner: this task. DOSBox engine0.84.0-vc1(f6d9b), bridge0.1.1/protocol1.14,
normal core,3000 cycles,svga_s3,original directory pairing unchanged. Instance
0719a1b0cdcede0b85c39577ff760639/PID59942. No machine checkpoint or partial memory
restore was used. Captured DS bytes are conditional routine preconditions;
loading them alone would not recreate the DOS allocator,video,devices,stack
execution state or a complete machine checkpoint.

1. Continue `reference/jungle-treasure.json` stop330 before successful jungle
   RETF. One step reaches resident0603:455c stop331; continuing naturally awards
   the jungle treasure and reaches the map,day25,cash1094. An exploratory
   one-shot0e0c:0000 breakpoint does not hit map's nonzero entry point. Pause332,
   delete that owned breakpoint,then stop at joystick0319:0002 stop333. Pause332
   was inside the graphics driver with a different DS; always read **fixed1403**
   for game memory. The ignored `photography-map-setup.json` was an exploratory
   driver-DS read and is not an accepted artifact.
2. Save CPU+fixed game DS as `photography-map-before.json`. Apply the three
   explicit conditional CAS patches in the manifest: cursor X64→46 at9f46,
   Y73→56 at9f42,and current location25→7 at5b3c. This puts the cursor/current
   location at Yellerstone Park and skips another flight. All other bytes and
   CPU registers must remain unchanged. An initial incorrectly specified CAS
   expected value returned conflict and aborted without writes. Save after.
3. Dispatch the manifest's six Space/Right events. Wait for actual photo entry
   stop334 at0e0c:0000. All six events dispatched; no input remains queued.
   Argument SS:SP+4 is variant1. Capture CPU,64K fixed DS,and the whole code body.
4. Stop main00e3 stop335,after target selection. Capture CPU+DS. Then capture
   animal selection helper0f2e:0006 entry336 and0042 RETF337. Before/after states
   compare exactly except its own documented8 bytes of stack scratch.
5. Capture spawn helper0f2e:0a9a entry and0c8b RETF three times:338/339 slot2
   rejected,340/341 slot1 accepted,342/343 slot0 rejected. All use two RNG draws.
   Another spawn entry344 is crossed while reaching position helper08e4 entry345;
   capture it and0a04 stop346 **before** the sprite draw. No state injection here.
6. Continue main07bf stop347. Schedule Left press/release,then Fire as in the
   manifest. Capture shutter reaction006f entry348 and00b1 RETF349. Three input
   events had dispatched at the hit;cancel the pending release and explicitly
   release Space. Continue main07bf stop350.
7. Hold Fire using the manifest's second schedule. The original consumes all
   film; stop main1094 stop351 before pricing. Capture twelve result bytes and
   all DS,then stop11b5 stop352 after pricing/cash update. Results are targets44
   in slots0/7,ten misses. Cancel remaining scheduled release; explicitly release
   Space. Continue to1225 RETF353 after the result display and cleanup. Capture
   CPU+DS and the original result PNG. Keys are released;no breakpoints or
   schedules remain. This original scenario ends at353; the extension below advances the session.

Schedules are setup provenance. Debugger pauses,device timing and measured
dispatch drift mean this is **not a deterministic whole-scene input replay**.
No expected output is turned into a timer,event or RNG provider. There are no
fitted inputs. No seed,animal,shot result,score,cash or timer was injected.

## Verification

```sh
npm run prepare:photography-analysis
npm run verify:photography
```

The verifier is included in `npm run verify`. It requires20 checksum-pinned local
artifacts and the original executable; missing/corrupt artifacts fail explicitly.
It checks eight conditional cases/nine checkpoints,full relocated code identity,
exactly the three setup patches,112 static target/default boundaries and32 original
metadata records. Six leaf comparisons cover the entire64K DS except their
specific stack scratch: animals9ed0..9ed7;rejected spawns9eb4..9ec3;accepted
spawn9ea6..9ec3 (includes sound-call scratch);position9eb8..9ec1;shutter9eca..9ed7.
No clocks,RNG or other globals are excluded. Results compare semantic accounting
fields,photo slots and claim/day return,not all drawing or cleanup internals.

Seven required negative controls reject altered executable code,a skipped case,
changed RNG consumption,wrong sprite frame,wrong payout,a removed picture and
zero executed cases. This establishes conditional routine agreement. It does
not establish a whole original expedition replay or timing parity. The extension
below adds independent carried replay,browser acceptance and exact pixels without
increasing the scope of the old leaf comparisons.


## Animation-and-browser-extension

`reference/photography-runtime.json` pins29 additional local artifacts. Starting
at353,stop at resident01f5:04f2 (354): day is27,cash2094,score1000. At01f5:0c6a
(355),cash remains2094 and score is cleared. Resident04e7 spends the additional
day;04f2..052e skips the generic loot award when photo score is nonzero. On
success,the existing claim/atomic-unlock path follows. On failure,the caller
still spends its day but does not clear the photo score. The port preserves
those branches; the atomic-unlock notice has an executable application check.
Atomic travel itself remains outside the implemented routes.

The original's normal rival progression runs before the next map. Stops356/357
are rival-report input polls,not map polls. Continue to the actual map input
call0ed6:1238 (359),matching overlay2 body1ed8. Capture fixed DS1403 and CPU.
Apply exactly three recorded CAS changes: cursor46,56→173,98 and current
location7→12 (Kenya Game Reserve). No score,seed,animal,clock or photo injection.
Fire press20ms/release120ms enters the guide and then photography entry360.
Both events finish. Entry argument is variant4,incoming seed45009,day27,cash2094.
The entire relocated7924-byte overlay again matches the earlier original entry.

Capture11 helper passes at actual0f2e:0144 entry /08e3 RETF (361..382). These are
body1364..1b03,Ghidra1d39:0144. Ghidra's recovered function body is incomplete
around switches; use the original disassembly and embedded tables. Passes0..7
have no active animal;passes8..10 include center-place8,target39. Each active
pass draws normal23,rare39,then two foreground sprites,then advances the pose.
All actor/descriptor/RNG/game bytes match exactly. The only exclusions are each
case's exact original helper/driver stack scratch (20..112 bytes) and external
clock DWORD2225..2228. The timer interrupt advances that clock while drawing;
this helper never reads it. It is neither supplied as a fitted value nor used
as an input to the comparison. Each original pass starts from its own captured
precondition; this is not a carried full-original replay.

Continue to main07bf (383) and capture the original image. EGA00e5 selects a page
and waits for vertical retrace;screen capture exposes the preceding completed
presentation. As in the existing jungle captures,the comparison uses **pass9**
for the image captured after pass10. No frame search or pixel tolerance is
allowed. Replacing9 with10 is a required failing negative control. All320×200
RGBA pixels match. The separate result sheet reconstructs all original pixels
from the older two-target result,including thumbnail overlays and pricing.

Current live original: instance0719a1b0cdcede0b85c39577ff760639,paused0e0c:07bf
stop383,Kenya variant4/day27,film12,target39. Keys are released and there are no
breakpoints or pending input schedules. No full checkpoint or partial restore
was used. Game code/asset dumps and screenshots remain ignored local artifacts.

Four independent replays start from authoritative assets and initialized
state,carry their own state to completion,and consume authored joystick and
separate dialogue-fire streams. Inputs are constants authored before outputs:
held Fire for success/misses,an authored two-sample wait/left-aim/Fire sequence
for ordinary-only earnings,and neutral input for timeout. The expected hashes
are **port regressions**,not original full-level outputs. The streams consume554
joystick samples,43 dialogue events and9354 driver/retrace events across20
checkpoints and779 presentations. Eighteen additional fixed-Fire resource cases
cover all six actual destination layouts and all three difficulties,with exact
final hashes and required input/event counts. Required checks reject missing/corrupt
artifacts,zero/missing cases,skipped checkpoints,invalid rendering,unfinished
sequences,unconsumed inputs/dialogue events and exact byte/hash differences.
Eleven new negative controls cover those comparison mechanisms.

`tests/browser/photography.spec.js` follows the real application from title,
flies/crashes/repairs,aims and takes a target picture with keyboard events,
spends the film,checks native audio,views the result,returns exactly two days
later,checks cash without an extra treasure award,and exercises the collected
notice and Restart. It chooses targets adaptively from observable game state;
this browser acceptance is separate from fixed-stream deterministic replay.
Sound replacement now invalidates the cancelled playback request. Only an
AbortError belonging to a superseded request is ignored;current audio failures
remain fatal. This fixes an observed browser failure during the sound-enabled
route,without changing game sound completion inputs.

```sh
npm run verify:photography
npx playwright test tests/browser/photography.spec.js
```

Next: extend original comparisons for special-species reactions and whole-scene
timing. Remaining full-game work includes
atomic travel,save/load and high scores. [Normal rival progression](rival.md) is connected.


The LOC audit establishes layouts1..6:Yellerstone,Duckbill,Ronguay,Kenya,Xanadu
and Borneo. Borneo's flags100 give variant6,which uses main's default target
branch but its own companion row. Variant0 is not a destination:its apparent
companion row aliases placement masks. The playable factory rejects0;the low-level
target selector retains0 only as a default-branch static comparison. Tests cover
all16 Borneo target outcomes and actual companion IDs,plus its browser departure.

A failed visit with only ordinary pictures returns code0 while leaving score
DWORD97a8 nonzero. Resident04eb skips the clearing branch in that case. The next
successful cave/mountain/jungle call therefore takes resident04f2's score path:
it clears the carried score,marks that location collected,and suppresses the
usual loot award once. This original quirk is statically inferred from the caller
and unchanged expedition entry code. An independent ordinary-only replay earns
$50 without claiming its photo location. Conditional caller tests then inject a
subsequent success result at the application boundary to verify one suppressed
award and restoration of normal awards afterward. Those injected success packets
are explicit test inputs,not a played subsequent expedition or original campaign
replay. `applicationChecks` in the manifest records that scope.
