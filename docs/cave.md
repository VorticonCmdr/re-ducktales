# Cave expeditions

Build: `reference/build.json`. Overlay6 SHA-256:
`b50b7f3163c516c298569ab3ec301f2d0e31f456a623bfafe294d6077344713d`;
body `2114197d8aef68f97c58a253a3f1d2414370d81723ebf1f28a84048129d5350d`.
INT3f index0c selects this actual game code, not a loader stub.

## Working browser route

Easy → office → map → Klondike → Launchpad → fly to airport → landing →
Junior Woodchuck Guide → cave. Hold an arrow to point and Space to move through
an available passage. A new safe room after the first awards the original $50
during its entry animation (the shortened A/B-drive path instead waits73
driver ticks). Restart works. Maps, room/party/torch/passage art come from
EXP.ARC/CAVEMAPS.ARC. Treasure collection, falling into a pit, pursuer capture
and torch expiry now play their statically translated terminal sequences.
Failure shows MAIN34, waits20 seven-tick polls and then spends a campaign day.
Success spends a day, shows MAIN35, adds the location's signed16 LOOT value to
uint32 carried cash, waits40 seven-tick polls and marks the destination collected.
Both return to the map. ID9 unlocks the original atomic-transport explanation
and the usable transmitter choice documented in [atomic transport](atomic-transport.md).
Collected destinations show the original notice; failed current destinations can be retried without flight.

`cave-scene.js` translates setup and normal EGA composition. `cave.js` supplies
independent driver/retrace clocks, held-input sampling, room transitions, cash,
lamp counters and pursuer movement. `expedition.js` translates main12bb:00fe/022a:
chapter screen, one RNG draw for its CLUES.ARC group, and30 seven-tick input polls (210 driver ticks), shortened by Fire.
Mountain,jungle and photography chapters enter their implemented activities.
Same-location retry and collected-location notices are documented in `campaign-visits.md`.

Map bits:1 left,2 right,4 down,8 up,16 visited/start,32 goal,64 pit. All64 words
are parsed exactly, accepting original map4's trailing spaces. Entry locates
start/goal and draws RNG&63 until the pursuer differs from the player. Lamp
limits64/48/32 and pursuer intervals20/16/7 depend on difficulty. The pursuer
threshold uses distance from the player to the goal, an original quirk. Party
drawing consumes one RNG for torch-frame selection and prevents immediate
repeats. Original memory offsets and integer widths are deliberate. Rendering
observes commands and does not advance simulation.

Movement, room cash, lamp, pursuit, endings and campaign results are statically
inferred. The browser exercises actual keyboard controls and rendering. These
checks do not establish full timing or complete-level replay parity; the aligned
capture image below is the only terminal pixel comparison.
Minimap refresh order and terminal animations still need original comparisons.

## Original comparison

`npm run verify:cave` requires artifacts pinned in `reference/cave-entry.json`.
Continue the earlier flight repair at main01f5:0ae5, then dispatcher04b0:0002
(target6) and04b0:00c8. Overlay entry0e0c:0000 receives variant7 (Siberian), cash25,
seed51460. Original bytes begin `558becb886009a9e1e030656c646f200`; DS/SS1403 and
real mode were revalidated. Capture CPU+DS64K+32 code bytes; continue to0e0c:05ed
just after the first party draw and capture CPU+DS64K.

The actual Cave constructor uses the captured entry as a conditional starting
state. Exact comparisons cover all64 map words, actor indices, RNG51460→9142,
lamp/time fields and sprite geometry/frame bytes. Dynamic allocation pointers,
CPU, stack, device buffers and clock are outside this browser boundary. The
first presentation is pending at this stop, so an immediate screen capture can
be black. No original pixel comparison is claimed. Changed-torch, changed-map
and missing-checkpoint negative controls must fail.

The original cave was visually observed at0e0c:081f before input. That session
was later restarted for loot capture; revalidate mappings before reuse. No
partial memory restore or machine checkpoint was used.

## Static analysis

`npm run prepare:cave-analysis` combines resident and overlay6 bytes into ignored
`.local/analysis/CAVE_CODE.EXE`. Only the analysis copy normalizes stack probes;
it is never executed. Keep the resident DOS entry in its MZ header, then create
an ordinary far C function at1c17:0000 with one16-bit variant argument. This avoids
Ghidra treating the cave as startup and flattening its stack into globals.
Disassembly resolves missing register returns, including column/row helpers
2390/23b1. Originals remain unchanged.

## Terminal animation evidence and environment

`cave-endings.js` translates the branches in overlay6:0832 onward; torch expiry
is helper1ea1:0071 (body2951), party drawing1e22:0008 (20b8). Ghidra CAVE_CODE.EXE
was checked against disassembly when resolving signed bytes and return values.
Resident main04e7 spends the level day after the cave call returns. Main0b39–0c86
awards and marks ordinary treasure;0c89–0e0e unlocks atomic transport. The special
97a8/97aa reward branch belongs to other activities and is not exercised by Cave.

DS2038 is the video descriptor, DS203a the persistent room buffer. The EGA
page-flip routine00e5 changes the video segment by xor0200. Party helper20b8
copies the room buffer to the draw page before every party/torch draw. Capture
adds its foreground prop to the persistent buffer; pit later restores only the
specified rectangles. Capture also makes an unpresented party draw before its
first displayed pose; its RNG draw is retained. The port retains two video pages and a separate room
buffer with immutable drawing snapshots. The pure rasterizer resolves these
copies without consuming clocks or RNG. The first treasure reveal uses a normal
presentation in place of the original EGA striped reveal transition; that
transition and its retrace duration remain unverified/omitted. Exact terminal
pixels are limited to the aligned capture image below; full presentation timing
is not verified.

Audio is an explicit environment input. With Sound off, completion polls see
idle. With Sound on, every cave sound gets a token and is pending immediately;
the browser acknowledges completion or replacement through a timestamped event.
Stale tokens cannot release a newer sound's wait. Disabling sound releases its
wait. Hidden tabs pause the browser simulation and resume active sound on return.
Reconstructed browser audio duration is not original device timing evidence.

`npm run verify:cave` also runs four independent environment scenarios: capture
(map0, seed0, idle), pit (map0, seed0, shortest pit controller), treasure (map0,
seed0, safe-goal controller), and expiry (map3, seed0, idle), all Easy, cash0.
A separate C-drive circuit traverses Right/Down/Left/Up through17→18→26→25→17,
strictly renders every intermediate pose, and requires exactly$150 for the three
new safe rooms, lamp5, and no duplicate reward on returning to17.
The shortened-path controller uses the original initial map and current room, never the expected
outcome, enemy or RNG. Its external events are recorded, then replayed from the
same initial contract and compared at every checkpoint. This harness advances
one driver tick and one retrace per iteration: a synthetic environment, not a
claim about original or browser clock alignment. Source input events are now
identified by poll ordinal rather than fitted wall-clock or driver-step offsets;
the first controller run records them and the replay must consume all of them.
Every presentation is rendered
strictly. Static loop counts must match presentations/party RNG calls:
capture18/3, pit35/10, treasure15/15, expiry21/4. Removing a presentation or
capture's unpresented RNG call fails a negative control. All four must terminate
before10000 iterations and consume every
required replay event. Negative controls alter an outcome, remove movement and
send stale audio completion. Enabled sound must hold capture open until the
matching completion event. Conditional application-entry checks also verify
success/failure reward, exact report waits, calendar and one-time collection.
Original entry comparison remains a separate evidence level.

## C-drive path and original runtime comparison

Resident140e:037a executes `MOV AH,19; INT21; RETF`: it returns the DOS current
drive, not the graphics adapter. Cave entry sets DS5d2b=1 only on A/B (return0/1).
On the supported C: launch (return2), the initial zero flag enables full passage
animations. `currentDrive` is an explicit environment value, default2; an inherited
nonzero flag is retained as in the original. It is independent of EGA/CGA.

On C:, first room setup makes eight party draws (two room poses, two additional
poses and four open-passage indicators) before input. The previous assumption
skipped six of them and changed subsequent RNG/pursuit. Movement now uses the
original EXP10–13 sprites, coordinate tables1848–19a8, torch-attachment tables,
walk frames and foreground EXP24/25. Exit and entry are separate sequences;
new safe-room cash is awarded by the entry helper2496. The simple room-coin
73-tick delay belongs to the shortened A/B path. The striped EGA reveal itself
remains omitted; neither complete presentation timing nor full sound parity is
claimed.

`reference/cave-runtime.json` pins eight local artifacts and six required checks.
First scenario starts at captured cave entry: variant0, Easy, seed39182, cash0,
day4, current location15 (Klondike). No subsequent controls are supplied. At
0832 the original captures after197 neutral samples, lamp14, enemy16, RNG43553;
map, counters, torch fields and loaded descriptors match the port exactly.
Continue to1221 after18 capture presentations: RNG18736 and all compared
animation descriptors match. Continue to resident04e7: result0, cash0, day4
before the caller increments it. The browser implementation carries its own
state across these checkpoints from that one conditional entry snapshot.

The captured PNG at1221 is the native cached image of capture loop14 (presentation
16): loop15's BIOS page selection has executed but its cached VGA refresh is
pending. The verifier fixes this one-frame alignment for this build/stop and
compares every RGBA byte; it never searches frames or adjusts inputs to fit.
The next original cave entry (same-location retry, seed31581, day5) supplies
independent first-input09a1 and first-idle-decision0b9c boundaries. These also
match without memory injections. Required negative controls select the wrong
drive, alter RNG, remove sprites and omit a checkpoint.

Original sound was enabled. The comparison uses an explicitly idle audio
provider; processing time, driver/retrace duration and the terminal audio busy
wait are excluded. This is conditional game-state/pixel evidence, not an
original audio/timing replay or a whole campaign replay. Earlier independent
four-outcome tests explicitly use drive0 to cover the retained shortened path;
the browser and new original-reference scenario use drive2. Movement coordinate
paths are statically translated/browser exercised; original movement captures
remain next work.

The later campaign-retry capture advances the original to cave entry0e0c:0000,
stop23, DS/SS1403, instance0719a1b0cdcede0b85c39577ff760639. No active input schedule or breakpoints remain.
No original memory/register injection or partial/full restore was used.

Next: original comparisons for C-drive room moves, striped reveal timing,
remaining outcome comparisons alongside the other expedition games.

## Input polls, Pause and keyboard flushes

`npm run verify:cave-input` requires the18 checksummed local artifacts in
`reference/cave-input.json`. It runs as part of `npm run verify:cave` and the full
verification command. Missing/corrupt files,unfinished event schedules and changed
required values fail. Five negative controls change preserved RNG,a queued P,
a popup pixel,required Pause input or required device clocks.

Ghidra `CAVE_CODE.EXE` and original instructions identify overlay6:0495 as the
initial `140e:19a5` flush,0997 as the safe room-entry flush,and09a1 as the
`1124:0002` input call (return09a6). The099c label initializes a local word before
that call. Overlay6:04a6 calls `198e:01d8`,with a separate six-tick deadline.
The port exposes poll/flush interfaces at these boundaries. Unread P/Q/S and held
controls clear at room entry; passage/terminal animation cannot open a dialog.
The following result dialog also starts with a keyboard flush; the shared
photo-score shortcut skips that dialog and flush. Pause and cancelled
Quit resume the suspended input call after clearing controls.

Original scouting continued naturally from flight-input stop514 to cave09a1515,
room17,goal45,pursuer37,seed3129. All11054 cave code bytes match after196
relocations. Resident input876,pause494,deadline49 and flush32 bytes also match.
Original/live segments are cave0c17→0e0c,input1124→0319,pause11c4→03b9,
deadline198e→0b83,helpers140e→0603,load base01f5 and DS/SS1403. Normal-core
real mode and original code are verified; no loader stub or analysis image runs.

P schedules reach pause entry516,waiting517,return518 and cave09a6519. Selected
cave globals,all sprite descriptors and the complete134-byte cave local frame
remain exact. Device clock52840→53031 advances191 ticks while deadline52846 stays
unchanged. At the next helper520→521,the overdue deadline consumes zero driver
ticks and becomes53047=current53041+6. Drawing between input return and that
helper costs10 original driver ticks; the port does not claim that drawing cost.

Right/Space enters18,then Left/Space revisits17 with P pressed during passage
animation. At0997 stop524,P's unread key flag is64. After the flush and input
return525,all128 key slots are zero and AL is0. Required emulator schedules fully
consume2/3/4/6 events. The pause popup's104×24 crop matches the previously verified
original popup exactly; surrounding cave pixels are outside this comparison.
No game-memory/CPU injection,partial restore or machine checkpoint is used.

These are eight original code/state/input invariant checks. Separate port checks
validate the same rules; this is not a captured-input whole-cave state replay.
An independent replay starts
from decoded resources and supplies its own200-tick pause. Five unit cases cover
entry/room/terminal flushes,clock separation,No and Restart. A native browser case
loads original assets,flies/crashes/arrives,uses P and Q/N,compares popup pixels,
holds movement across entry and checks the$50 room reward. The treasure browser
route also still completes failure,retry,treasure and campaign return. Both use
an explicit browser clock and observe its8ms display cadence; simulation retains
its own driver/retrace clocks. This proves browser acceptance,not an original
full-level replay. New original Quit-No,terminal-flush and initial-flush captures,
whole-level native movement/audio timing and additional variants remain future
checks. Source sprite/copy time now precedes continuation and presentation;
[cave-timing.md](cave-timing.md) records the conditional native evidence, browser
cadence checks and remaining omitted costs.
