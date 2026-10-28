# Flight translation and evidence

Build: `reference/build.json`; overlay 4 SHA-256
`cefab7184f72f605af90ddcf9b8cc8027870fdacb9922acdb68e8d6212db3ae9`.
Physics, course generation, scene/object updates and collision rules are translated.
The checks include conditional comparisons, a closed-loop segment, and exact pixels.
Flight is connected to the browser. Actual keyboard takeoff, crash, losing-race
return, airport landing and restart are covered by browser acceptance. Arrivals
continue through the guide into all four expedition families, including treasure,
failure and campaign return. A complete mixed Easy campaign is also checked.
Original whole-flight parity and broader Hard/variant routes remain unproven.

## Implemented rules

`src/game/flight-physics.js` translates overlay offsets 1330–194a, stall helper
2cf8–2d3f, and the main loop's throttle/turn sampling. It accepts one explicit
64K data segment. State and constants retain their original offsets; the memory
object owns a copy, including when its input is a Node Buffer. It never reads
DOM state, browser time, host randomness, or an expected output.

Original vector constants at DS:0ee2 give sixteen headings. Heading 0 moves
right, 4 up, 8 left, and 12 down. The flight entry builds DS:5516 gravity vectors
by multiplying these float32 values by the float64 constant 0.6 at DS:32ca.
Physics stores round to float32; intermediate arithmetic retains JavaScript
double precision. This matches the captured software-FPU results exactly for
the cases below, but does not prove every possible extended-precision result.

Physics moves the plane, applies gravity/climb speed changes, consumes turn
requests, follows/clamps the camera, handles stalls and ground collisions, and
writes sprite position, frame, and collision bounds. A ground bounce increments
the bounce byte. A further impact after two bounces returns the crash sprite.
The dry-ground crash early return preserves the original uncleared turn requests
and old plane bounds. Camera following adds the horizontal displacement a second
time, as in the original 1559–1574 / 159f–15b5 code.

Throttle is sampled **after** physics/render/collision processing. Held fire adds
0.25 below speed 14 and subtracts 0.25 at/above it. Without fire, speed >=0.01
loses the original float32 0.15, then clamps below zero. Turn requests are sampled
for the following physics update. Original heading-dependent speed thresholds,
signed 16-bit camera fields, and truncation toward zero are deliberate.

The return value separates a sprite pointer, sound request, and required water
splash retraces. The caller must gate sound using original sound-enable state.
The Flight main loop now supplies the three water splash retraces; the water
branch has not been original-capture validated. No
device completion or wait is silently simulated here.

## Conditional reference scenario

Continue `reference/expedition-departure.json` at the first flight entry: day7,
Easy Money, Klondike slot25, duration1, racing1. The original plane begins at
x0/y139, heading0, speed0. This session used normal core, 3000 cycles, svga_s3,
headless/mute, read-only `game/`, DOSBox MCP 0.84.0-vc1 f6d9b.

Original main load paragraph is 01f5; helper0603; DS/SS1403. Flight overlay base
is 0e0c for this loading. Before trusting those addresses on another launch,
compare original relocated code bytes, actual CS/DS, and real-mode status.
At the physics entry, original bytes begin
`55 8b ec b8 12 00 9a 9e 1e 03 06 56 a1 18 6d 8b`.
The return at 194a is `cb`; AX contains 6f3e or 4d1e. These bytes and addresses
were checked live. All execution uses the unmodified original EXE.

Capture CPU plus DS:0000 length65536 atomically at entry 1330 and return 194a.
Pause, add breakpoints, continue to arm, and use a newer debugger stop ID.
Eight local before/after pairs are pinned in `reference/flight-physics.json`:

| Update | Starting condition / exercised behavior |
| --- | --- |
| 0 | Stationary first update |
| 1 | First 0.25 throttle movement |
| 26 | Speed6.5, ground roll, x81.25 |
| 31 | First captured turn request while camera follows |
| 32 | Heading15, diagonal gravity and acceleration |
| 33 | Heading14, second ground bounce |
| 35 | Heading0 after bounce, preserved camera state |
| 37 | Third ground impact, dry-ground crash early return |

For capture: after update0, hold Space; skip24 entry hits after update1 to reach
26. After26, request Space+Up; skip4 entry hits to31. Capture32 and33 on the next
entries; skip1 to35 and skip1 to37. Each pair's captured internal state is the
authoritative **conditional input**. The input schedule is a setup recipe,
not a claim of a deterministic event-only replay: debugger stops and timed-input
dispatch affect the intervals. No expected result supplies a simulation input.
No memory injection, partial restore, or full machine checkpoint was used.

The verifier checks all game-state fields written by physics, exact return AX,
and the statically inferred sound request. It excludes stack, software-FPU
workspace, timer, driver memory, and other CPU registers. Those exclusions are
limited to this routine comparison. Two additional checks compare only throttle
and turn fields after31→before32 and after32→before33; intervening render,
collision, terrain, and object updates are not replayed. Removing a turn,
altering crash position, and removing a case all fail negative controls.

```sh
npm run verify:flight
```

The command rejects missing/corrupt artifacts, unexpected capture layout,
incomplete memory, wrong addresses, zero/missing cases, and unequal bytes.
Missing artifacts are setup failures; they must be recaptured using this recipe.
These local captures contain original data and remain ignored by Git.

## Analysis preparation

```sh
npm run prepare:flight-analysis
```

This first verifies/unpacks the original via the existing preparation script.
It creates an **analysis-only** combined resident/overlay MZ under `.local/analysis`.
Overlay relocations reference paragraphs 0c17/0ed1/0ef1 in the whole image;
treating them as body-relative gives wrong addresses. The combined image places
the overlay at image c170 and combines the relevant relocation tables.

Software-FPU escapes CD34..CD3b are exposed as same-length NOP+x87 pairs;
CD3d becomes WAIT+NOP. Recognized fixed compiler stack probes become same-length
SUB SP,imm16+NOP, removing their relocation operands. All original bytes, patch
offsets, source/output hashes, function boundaries, and CS-relative switch table
locations are recorded in `flight-analysis-patches.json`. This image must never
be executed, deployed, or substituted for game assets. Read original disassembly
when an analysis patch could affect interpretation.

Ghidra import base1000 gives flight root1c17 and DS220e. Clear loader SP/SS entry
context over overlay functions; set DS220e. Bound functions using the recorded
offsets. Some far-segment aliases cause Ghidra to resolve near switch targets
against the wrong base: read original CS-relative table words and use explicit
JumpTable overrides. Decompiled C is supporting evidence only. The object
generation routine at root36c9 repeatedly kills the decompiler process;
continue from original disassembly rather than building a general translator.
A focused Ghidra MCP improvement would report this failure with the decompiler
log and retain a bounded instruction listing for the failed routine.

## Course generation

`flight-terrain.js` translates the four terrain sections at 2da8–2f4a and
3498–36c8. Duration1/2/3 yields 42/84/126 tiles. Section lengths truncate the
division by4, retaining the original uncovered tail. Terrain continuation,
water/shore transitions, branch order and otherwise-unused RNG draws are
preserved. The mixed-theme branch at 31f8 compares the existing theme rather
than the new random roll; this original behavior is intentional.

`flight-course.js` translates object placement at 36c9–43f8 and its helpers.
Each tile has a type word and first-object index; objects use fourteen-byte
records. Placement probability changes at tile2 and halfway through the route,
by difficulty. Conditional RNG draws, byte/signed-word comparisons, cloud
altitude separation and adjacency flags are explicit. The building's falling
object has **type0** and stores resource20/22/24/25 in its variant byte, as shown
by the original push order at 4261–426d. The helper leaves x, state, padding and
unallocated-record fields unchanged. Its start-of-tile count limit can permit
more than260 records including the two landing records; no invented per-record
260 limit is imposed.

`flight-setup.js` reads constants from the original unpacked EXE and geometry
from all68 PLANE.ARC entries. It initializes terrain, selects scenery and optional
obstacles, loads sprite geometry/frame bytes, creates objects and gravity vectors,
and sets the plane's initial state. No snapshot is needed to run this setup.
Asset references replace dynamic mask/pixel allocator pointers, which do not
participate in these placement rules. Original raw-picture dimensions come from
the same PLANE.ARC resources, without creating a synthetic DOS allocator.
Passing a previous FlightMemory preserves otherwise untouched fields between
flights; this is simulation state, never a claimed machine checkpoint.

`npm run verify:flight-course` checks five outputs:

1. Terrain arrays, object initialization sentinels and RNG seed immediately after
   terrain generation, using a captured entry contract.
2. Scenery flags and seed at the pre-object boundary.
3. The complete terrain/object arrays and seed across the isolated object routine,
   using its captured before memory, including stale object fields.
4. Complete asset-backed setup for the first racing flight: seed1822, day7,
   Easy Money, duration1, picture39, rival assets59/60. Exactly212 RNG draws and
   ten objects, matched against the first physics entry.
5. Complete asset-backed setup for the second ordinary flight: seed1185, day8,
   Easy Money, duration1, picture28, optional assets40–43. Exactly213 RNG draws
   and sixteen objects, matched against the first physics entry.

The last two run their own initialization, RNG and resource providers throughout
setup. They compare all fields setup writes, including loaded descriptor positions,
geometry/frame bytes, gravity vectors, day/difficulty/race and initial plane state.
They exclude allocator pointers and untouched stale fields. This exclusion is
scoped to setup's write footprint; the isolated routine check also compares the
untouched bytes over the full arrays. Initial seeds are captured **internal**
starting contracts, so these are not independent campaign input-only replays.
Medium/hard, multi-day and other random courses remain statically translated,
without equivalent original captures yet.

The manifest `reference/flight-course.json` pins all local data and the exact
checkpoint count. Both EXE and PLANE.ARC identities are checked before decoding.
Omitting an RNG update, changing an object position and removing the cases all
fail negative controls. Missing/corrupt captures fail setup explicitly. No
injected memory, fitted input or expected-output-derived resource dimension is
used. These checks do not include flight drawing, collisions or arrivals.

To reproduce the second capture, acknowledge Glomgold's post-crash message and
return to the map at Klondike, day8. Schedule Right down at frame0/up200,
Space down300/up330, Right down440/up470, Space down580/up610. Stop at main
01f5:06d9 then0845, and at flight entry0e0c:0000. The selected runtime slot is14;
the flight stack contains duration1/racing0. Capture CPU/full DS at entry;
also capture SS:[SP] eight bytes and the first sixteen code bytes. The entry
bytes match the previous relocated flight image and protected mode remains false.

Stop after terrain at physical0e0c:2f4a (actual CS:IP10e6:01aa), before objects
at0e0c:36c9 (actual10e6:0929), and after objects at0e0c:43f8
(actual10e6:1658). The overlay's far aliases are important: these are the same
physical addresses, not separate copies. Capture CPU/full DS atomically at each.
Finally capture the first physics entry0e0c:1330. The separate first-frame PNG
under `.local/` is exploratory material, not a verified rendering comparison.

## Scene, object updates and collisions

`flight-scene.js` translates the scene pass at f78–132f and HUD at2ba0–2cf7.
It emits immutable drawing commands while advancing the original state changes.
`flight-objects.js` translates194b–22ed and22ee–2576: balloon following/release,
falling objects, the airship, launcher, water creature, birds, foreground bonuses
and flags. `flight-collisions.js` translates261f–2b9f, including bounding-box
adjustments, duplicate-collision suppression, bonus cash, race loss, arrival,
boost/tether flags, reflections and randomized responses. The main loop supplies
the required spin generator and input-clear callback. Missing providers stop
when their branch is reached; no animation or input clear is silently omitted.

`flight-raster.js` consumes those commands and original images/font, without
access to simulation memory, time, input or RNG. It uses original transparency,
eight-pixel strip alignment, palette and clipping. It stops on unsupported image
frames/crops; there is no silent image substitution. Original IT.DRV resource1
code at035d (live2ed7:035d) was matched byte-for-byte for the EGA sprite path.
Its03ad–03b8 instructions use the unsigned frame byte without a strip bounds
check. The initial landing flag's frameff is entirely offscreen and therefore
causes no pixel/mask reads; the clipping rule and its limits are described below.

`npm run verify:flight-scene` adds22 checks:

- Sixteen **closed-loop segment** state checkpoints, carrying the port's own
  state from a captured initial data segment. They cover throttle, lift, heading
  changes, gravity, sprite state and collision checks. No checkpoint is copied
  back into the port. Fifteen original control values drive the intervals between
  these sixteen checkpoints, and every required input has a subsequent observed
  output. The final native return value is outside this replay's endpoint.
- Three **conditional** state checks: the first full frame; a later scene with
  birds, a balloon, cloud and tether structure; and balloon release phase1→2.
- Three exact320×200 RGBA image comparisons of those scenes. No tolerance,
  pixel exclusion or fitted alignment is used. These are renderer comparisons,
  not browser flight acceptance.

The state comparisons cover RNG, plane/camera/bounds, frame/day/rival counters,
cash and gameplay flags, complete terrain/object arrays, and sprite descriptors.
Stack, software-FPU workspace, CPU/driver/hardware state, processing latency and
audio output are excluded at this routine boundary. Collision responses beyond
the no-hit paths of the sixteen-frame replay are statically translated; they
do not yet have equivalent runtime comparisons. Balloon release and drawing are
validated separately. These checks do not establish an independent complete flight.

Inputs and expected memory are separate local files pinned by
`reference/flight-scene.json`. Inputs originate at the original input-provider
return,0e0c:02b3, before the main loop stores/applies AX. The retained raw capture
contains sixteen return values; the replay uses the first fifteen, ending before
applying the final one. The checker rejects an omitted throttle, altered pixels,
missing checkpoints and an extra unconsumed event. It validates every replay
drawing command and stops on unexpected crash, termination or animation paths.
Missing or corrupt local artifacts fail setup. No injected memory or fitted input
is used. The starting memory remains a conditional internal starting state.

Capture recipe, continuing the second ordinary flight from the course scenario:

1. From stop96,0e0c:1330, save CPU/full DS as the loop start. Schedule Space down
   at native frame0, Down down70/up100, Space up10000. The long hold continues
   beyond this segment and is cancelled later; it is a setup action, not the
   regression input stream. Use a persistent breakpoint at0e0c:02b3. At each of
   sixteen stops, save CPU/full DS; record debugger AX low byte separately as the
   consumption-boundary input. Captured controls are c0 then c5. The final event
   is retained for provenance but not required before this replay's endpoint.
2. Remove that breakpoint. Stop atf78 when DS:0fb2>=21. Save CPU/full DS plus
   SS:[SP] eight bytes for the actual plane argument. Stop again at132f and save
   CPU/full DS. Continue to the next1330 so the displayed page has reached a
   retrace, then capture the raw PNG. Address correspondence remains unchanged.
3. Cancel the hold schedule; request Up for48 native frames while retaining fire.
   Stop atf78 when DS:7a61==1 (the tile24 balloon's release phase). Capture the
   same entry/return pair and PNG. Its phase becomes2 and its falling body is
   visible. This is a conditional observation, not an event-only flight replay.
4. Cancel pending input and release Up/Down/Space. Continue to the next physics
   entry and verify the release sequence fully dispatched. No restoration or
   machine checkpoint is used. One owner controls the session throughout.

The first scene PNG is displayed only after the page flip has reached video
retrace. Capturing immediately at2a7 can return the previous black page; the
documented next-physics-entry stop resolves that capture alignment exactly.

## Remaining flight work

Terrain and initial obstacle placement now match both tested flight setups.
Object placement conditionally changes terrain11 to8 and the following tile to0
(3a68–3a89); the stage captures verify that distinction. The translated scene now
includes rival movement, HUD day progression, object updates and rendering.
The main loop and browser controls are now connected, including the normal
race/crash outcome and airport landing. Expedition dispatch and terminal returns
are connected; special collisions need wider original-capture coverage.
The full-game objective remains incomplete.

Historical live-state note, **not current emulator status**: the earlier
stop118/flight-live-last snapshot was superseded by main01f5:0ae5 after the third ordinary
flight's repairs (day15,cash25). No keys, input schedules or breakpoints remain.
The first losing-race return observed AX0/day8 at main0855; its broader campaign
consequences remain static evidence rather than a captured full-campaign replay.

## Browser flight runtime and conditional crash comparison

`src/game/flight.js` supplies overlay4's main loop: six driver ticks between
normal physics updates, explicit retrace presentation, input consumed after
scene/collision processing, spin/boost/airship/tether providers, water splash,
25 crash presentations, 52 airport-jitter presentations and the 219-driver-tick
landing wait. Final day uses the saved departure day plus duration, adjusted -1
for an arrival under tiles*5 frames or +1 above tiles*11. Rendering never advances
simulation. Flight retains its data segment between journeys.

Special animation translations are static evidence; they are not all validated
against original execution. Optional Tandy / PCjr audio now retains a live
driver: sound 9 starts the engine, and each physics step sends the original
truncated-speed control word `(speedInteger << 11 | 8) & 65535`. This encoding
is statically inferred from overlay4:020c..022a and resident140e:52c2; original
whole-flight audio/IRQ alignment remains unverified. The PC-speaker rendition
still omits engine updates and approximates noise. Campaign notices consume
real audio completion when sound is enabled; sound-disabled notices retain
their 40-poll delay. Browser
instruction/render cost is not modeled, so total flight duration is not yet
original-aligned. The browser sound option does not establish audio fidelity.

Main0855..0b36 distinguishes race failure from ordinary crash. A race failure
calls 126b:0008(1), consumes three RNG draws, credits the location treasure to
Glomgold and returns to map at the destination. Further races for that claimed
location are suppressed. An ordinary crash adds two repair days, waits60 seven-tick polls (420 driver ticks),
and skips wreckage search/RNG entirely for signed cash<=0. Positive cash consumes
one draw: rolls0/1 lose nothing,2..4 lose cash>>3,5..7 cash>>2,8/9 cash>>1. Only
the low16 bits of that signed32-bit shift are subtracted from unsigned32 cash.
The wreckage dialogue waits100 seven-tick polls (700 driver ticks); fire can shorten both waits. Both landing
and repaired ordinary crash continue to expedition entry and its playable activity.
The captured positive-cash repair case below validates day/cash/RNG. Other
caller branches are statically translated, not full-campaign replay evidence.

`npm run verify:flight-runtime` requires the local artifacts pinned in
`reference/flight-runtime.json`. Capture CPU+DS atomically at 0e0c:0b45 (after
crash delay),0b9a (after crash frames),0ee6 (after final calendar). Original code
at1330 still starts `55 8b ec b8 12 00 9a 9e 1e 03 06 56 a1 18 6d 8b`;
CS0e0c,DS/SS1403 and real mode were rechecked before capture. The third flight
starts day12,duration1,racing0,seed52740. The regression explicitly begins at
its captured crash boundary (frame132,cash50), with no subsequent inputs, and
carries its own state through the next two checkpoints. It is **conditional**:
no fitted earlier input history or whole-machine restore is used or claimed.
The port repeats its seven-tick wait from that boundary; compared game state is
unchanged by that wait. Clock alignment and framebuffer pixels are outside this
check. All declared state ranges match exactly, including all sprite descriptors,
objects, terrain, cash, frame counter, RNG and day13. Missing/corrupt fixtures,
unfinished presentations and changed day fail. The omitted-frame, changed-day and
missing-checkpoint negative controls are required.

An earlier exploratory capture attempted to stop at0b95 after a crash. That
address is the successful-landing branch, so it did not fire. Its running-state
read is invalid for comparison and is not in any acceptance manifest. Subsequent
capture uses0b9a and validates every stop. `input_key(pressed:true)` also behaved
as a tap (two scheduled events); use a one-event `input_sequence` for held keys.
Do not infer consumed inputs from resulting position or timers. Earlier throttle
exploration is not accepted as an input replay.

The goal flag starts with frameff. At initial presentation its rectangle is
entirely offscreen, so EGA035d performs no pixel/mask reads. The rasterizer clips
that case before frame validation. Once any portion is visible, an invalid frame
still fails. Ordinary visible frames and original PNG comparisons remain exact.
Tether lines use resident140e:00b0/IT.DRV1:0589 axis-inclusive/diagonal-exclusive
Bresenham, with strictly-positive error tests. HUD selects global color4; text
passes its own color directly and leaves that global line color intact. This
line path remains static evidence pending an original tether capture.

The same conditional outcome continues into main01f5:08f3 and0ae5: day13 becomes
15, cash50 remains50 through the repair announcement, RNG7341 becomes46558
(roll8), and cash becomes25 in the wreckage dialogue. The verifier carries its
translated flight result into the actual application caller and matches day,
cash and RNG at both stops. Target1 is a synthetic unused caller parameter; no
expedition result, destination comparison or dialogue-pixel comparison is claimed.
Four total conditional checkpoints are now required by this verifier.

LOC's fourth number is a one-based treasure ID. Main18b4..1a30 resolves it
through LOOT.ARC; it is never a cash value. Klondike ID26 selects resource25,
whose first line is4500; original captured DS:6fe8+2 also contains4500 for that
location. The browser loads/validates LOOT.ARC and credits4500 after a lost
Klondike race. Zero IDs require original random assignment, which is still
untranslated and stops explicitly. Campaign initialization therefore still omits
those later loot RNG draws; this route is not whole-campaign RNG parity.

The later treasure-initialization milestone now assigns zero IDs using the
original routine and includes its RNG draws before departure. This supersedes
the previous zero-ID limitation and partial startup RNG noted above. Cave
arrivals now reach an interactive normal-room slice; see docs/cave.md for its
strict terminal boundaries and limited evidence scope.

## Empty strip at the left edge

The campaign landing browser scenario exposed a normal small-scroll case that
previously stopped with `Unsupported terrain drawing tile -1`. Overlay4:0fd8
rounds the strip origin down to an8-pixel boundary. With first tile0 and scroll
−1..−7,the preceding tile−1 therefore has width0. At1010..101b the original tests
that width before the visible-copy branch. The original also prefetches the
terrain descriptor at0fc5..0fd0 even for an empty strip; its value is unused when
width is zero. The port had rejected the tile before computing its width,
preventing the original no-copy path.

The corrected scene keeps that empty strip in both passes,including the original
rival increment at113e. The port omits the unused descriptor prefetch for the
empty strip; this preserves observable state/pixels rather than memory-read
traces. All three original object loops
(10f9,197f,2322) load an unsigned byte and clear AH before comparing with the signed
tile word; no object can match−1. The translated iterator consequently returns no
objects for that strip. Visible preceding terrain now follows the neighboring
word alias described below. Other invalid indices and visible terrain assets
remain fatal. No replacement terrain or best-effort recovery is used.

This rule is statically inferred from this executable and checked against literal
source instructions in `tests/flight-edge.test.js`; there is no original runtime
edge capture. `reference/flight-left-edge.json` records14 authored boundary cases,
their incoming state,comparison rules and limitations. Every case rasterizes;
non-racing scene commands equal an independently initialized scroll0 scene.
Racing cases require the extra strip's+2 rival movement. Missing/corrupt EXE,
MAIN.ARC or PLANE.ARC fails setup. Negative controls require visible invalid
terrain to remain fatal. Existing original closed-loop state and exact scene PNG
comparisons continue to pass.

Browser acceptance now uses one worker explicitly. At four,the large
jungle/mountain replays exceeded their existing120-second wall-clock limits under
CPU contention; their simulation clocks,input streams,checkpoint counts and
timeouts are unchanged. All browser scenarios remain required. This concurrency
setting establishes a repeatable verification environment,not a presentation
timing tolerance or a performance claim.

## Input polls and return delay

Flight global keys now enter through the original02ae post-collision poll and
the final `09f5(20)` dialogue. Plane/actor updates stop inside Pause or Quit;
driver and retrace clocks continue. The separate six-tick deadline can expire
while paused,so the first resumed flight loop advances immediately. A captured
original pause verifies that deadline preservation and zero-wait continuation.

Final cleanup flushes inputs and waits twenty7-tick polls before returning to the
campaign. This140-tick wait was previously omitted. Crash/landing keys are dropped
by that flush; a fresh Fire can shorten the wait at a poll. The existing crash
verifier keeps its calendar checkpoint at0ee6 and then verifies the separate final
wait before carrying the result into repairs. `reference/flight-input.json` and
[the system-control evidence](system-controls.md) record exact scopes,original
code identities,runtime FPU rewrites,input schedules and limitations.


## Visible strip at the left edge

A deterministic exploration of12,000 finite input schedules,with duration1..3,
all difficulties and the parent departure's race/seed coupling,found two model
runs reaching first tile0/scroll−8. This was a reachable port hard stop rather
than a reason to clamp the camera. Exploration is not original or browser proof.

Original overlay4:faa..fc8 computes the terrain pointer as4f42+4*(firstTile−1).
For tile−1 this reads DS:4f3e,the unused word preceding the generated flight
table. The captured original word is0. At scroll−8 the original copies asset0,
sourceX72,width8,to screen x0/y160. The fix reads that actual word. It preserves
object filtering,rival advancement and camera state; corrupt alias values still
fail. A unit negative control changes the word to8 and requires asset8,preventing
an implementation that merely substitutes asset0.

`reference/flight-visible-left-edge.json` pins13 ignored original artifacts.
Entry569 verifies the full relocated17,548-byte body and actual3-day/racing1
arguments. At initial scene570,the unexecuted drawing routine still matches the
original bytes exactly. The scene comparison runs from independently captured
incoming memory,compares the enumerated game-state fields at return571 and all
320x200 pixels. The page flip at572 is not sufficient for a visible capture;
next physics entry574 aligns the already-drawn page to retrace. There are no
pixel exclusions or tolerances. Timer/CPU/stack/device state are outside this
routine's state scope,as in the existing flight-scene comparisons.

This is **conditional original evidence**: the manifest records player flags,
difficulty/rival-unlock,cursor/menu,seed and scroll setup injections. It also
records cancellation of four remaining navigation pulses before the experiment.
No CPU writes,partial restore or complete machine checkpoint were used. Neither
that camera injection nor expected output supplies the independent replay inputs.

`reference/flight-boundary-inputs.json` holds25 independent control events for
two carried Flight runs. The first includes an explicit neutral/release at16s,
completes a crash and its return wait at30.656s,and renders709 presentations.
The second has a declared16s flying endpoint; it is not a complete-flight claim.
All required events must be consumed,both must reach−8,and every presented frame
must rasterize. Reinstating the old guard must fail. These endpoint assertions
are port regressions,separate from original expected outputs.

The conditional browser fixture uses the first independent stream through native
keyboard events,real asset loading,the production Flight simulation and raster,
and separate driver/retrace clocks. It verifies boundary passage and completed
crash without injected simulation memory. It starts with seeded flight options;
it does not claim natural campaign navigation or whole original-flight parity.
Run `npm run verify:flight-visible-left-edge` and
`npm run test:browser -- tests/browser/flight-boundary.spec.js`; both are included in
full verification. The next priority is additional complete routes and the
broader destination/difficulty coverage and audio-driver work. Map pointer
arithmetic is now translated; original input-provider timing remains unverified.

## Lightning input clear

The Hard-flight investigation exposed a missing callback in `Flight.run`:
`collideFlight` translated the storm strike's keyboard clear, but its caller did
not supply that external effect. A normally generated Easy course reproduces the
consequence: P queued just before the strike incorrectly opened Pause, and held
throttle continued after the original would have cleared the keyboard table.

Original collision types2a/2b both dispatch to2962. The unmodified overlay bytes
at2997 call resident040e:19a5, then clear the two turn-request words. Ghidra's
resident load base names that helper140e:19a5. The full original overlay,69-byte
branch and32-byte helper identities are pinned in
[flight-lightning-input.json](../reference/flight-lightning-input.json). The
existing original system-control captures independently verify the helper's
BIOS/custom-key clear. This is static evidence for the lightning call plus reused
runtime evidence for the primitive; it is not a new native lightning timeline.

The main loop now supplies `flushInput`; an absent provider fails at the strike
instead of doing nothing. The component ordering regression starts the original
course normally, then queues P at an authored frame121 boundary learned during
port exploration. This adversarial timing is explicitly conditional evidence.
No objects or RNG state are patched. Its old-code failure is preserved locally.
A negative-control module removes the callback without editing the checked-in
runtime and must fail at the missing-provider diagnostic.

The independent browser scenario navigates to Bermuda Triangle on Easy, encounters
the generated tile17 strike at frame112/y136, observes deceleration without a new
key, then uses fresh Space/Down to accelerate and climb. It records actual input
events, flight snapshots, recovery values and screenshots locally. It supplies
only original assets, browser controls and an8ms display clock. The component and
browser frame numbers differ because their input/presentation providers differ;
neither is asserted as original CPU/IRQ timing. Run
`npm run verify:flight-lightning`; the source and negative checks and browser case
are also included in full verification.

Earlier exploratory Hard controllers crashed or lost to Glomgold; those outcomes
were not proof of a game defect or a completed route. They remain separately
archived in ignored `.local/flight-lightning/` storage. The later
[Hard route](hard-expeditions.md) aligns controller observation with the browser's
display callbacks, wins in226 actions and completes Bermuda's jungle, bank and
Restart. This browser proof does not establish original whole-flight parity.

The lightning milestone passes full `npm run verify`:113 unit checks,61 development
browser scenarios and2 production scenarios, zero skips, all required original
comparisons and both negative-control mechanisms. The complete mixed campaign
retains its prior19 exact checkpoints. Local recovery values are8.45000076 speed
at the strike,8.15000153 after the input clear, then8.56000137/y127.08899689 after
fresh controls. These are port browser observations, not native waveform/CPU
measurements. Checksummed receipts and the reproducing old-code failure are in
`.local/flight-lightning/`; the manifest pins their identities.
