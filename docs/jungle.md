# Jungle expedition

Jungle gameplay is connected to the browser. The working slice is flight →
guide → keyboard jump/walk/drop → life loss → campaign return → direct retry.
Original assets,maps,actor/hazard logic,dirty rectangles and two video pages run
together. A $50 pickup was manually exercised;automated browser coverage includes
variant0 controls,three-life failure,retry and restart. A complete Easy/variant0
route reaches the chest with one life,awards$1000 and returns to the campaign.
Other variants/difficulties and original full-loop timing still need acceptance.

The sections below preserve each comparison's scope. The runtime section at the
end records the independent factory,clock providers and current browser route.

## Source identity and analysis

Use the exact22-file pairing in `reference/build.json`. Jungle is physical
overlay8, file offset0x1fa00, declared length26104, header2048, body24056 bytes.
Overlay SHA-256:
`5782001bbf7e8d68b19274144a4e698a4fe1b9b577c7b5ff0614f4ace26ab0c4`.
Original body SHA-256:
`31690756aa6a355d980964a2f22d1aaccfe59f6bccefa872184a42245d659a9e`.
The resident dispatcher at image2c1b uses INT3F entry12 with the location flags
shifted right4 as a16-bit argument. Calls use16-bit far C stack conventions
(first argument BP+6, caller cleanup, AX return). This is actual16-bit real-mode game code;
the physical overlay's inherited MZ entry points to resident startup metadata.
The browser's supported EXE is EXEPACK packed; its initial loader is not used
as game logic. See `docs/executable.md` for the executable/loader evidence.

`npm run prepare:jungle-analysis` creates a local combined resident/overlay
analysis copy at image offsetc170. Ghidra import gives code entry1c17:0000 and
helper segments equal to original segments plus1000. The prep script normalizes
recognized compiler stack probes and software-FPU escapes for analysis only;
patches, original hashes and output hash are recorded in
`.local/analysis/jungle-analysis-patches.json`. Original files stay unchanged.
Ghidra entry bytes were checked against the prepared image: the original call
to040e:1e9e is replaced only in that analysis copy by SUB SP,00d4/NOP.

The map loaders decompile coherently and agree with original disassembly and
resident scanf strings. Ghidra's generic animation helper1f97:000c currently
follows overlapping invalid flow and produces an unreliable decompilation;
consult original bytes/disassembly when translating it. No P-code export or
recompiled decompiler output is used. Jungle has been entered in the
live emulator only for the conditional scenario below. At jungle entry80,
all24056 code bytes match after436 relocations with load bias01f5. Original
c17:0000 maps to live0e0c:0000; originalf97 helpers map to live118c. Ghidra
addresses remain original+1000. The actual game code and real mode are confirmed
for this scenario; revalidate after any relaunch or memory-layout change.

## Map resource contract

JG.ARC entries1,2,3 are generic type4 records containing ASCII level tables
(3125,2868,2956 decoded bytes). Variant0 selects1, variant1 selects2 and
variant2 selects3. Entry0 and5/6/17 are actor sprites; entry4 is a320×200 picture;
the remaining sprites supply platforms, terrain and hazards. Complete sprite
semantics remain under investigation.

`src/game/jungle-map.js` loads records using the original16-bit signed fields.
It has no DOM, clocks, RNG or device access. An optional incoming `FlightMemory`
preserves the shared resident DS; a fresh run copies the original initialized
data and zeroes BSS. This map-loading function does not initialize actor
animations, hazards, heap resources or the complete game routine.

| Section | Original loader | DS base/stride | Addressing |
| --- | --- | --- | --- |
| L | da0:06ae | 6a26/14 | Sequential, printed label suppressed |
| A | 1090:08b6 | 95ea/8 | Sequential, printed label suppressed |
| B | 1090:08b6 | 6040/50 | Sequential, printed label suppressed |
| P | 1036:0157 | 397e/38 | Printed index |
| S | 1149:027f | 7034/38 | Printed index |
| V | 118a:0061 | 5d40/34 | Printed index |
| J | 118a:0061 | 5bb2/2 | Printed index |
| M | e7a:0230 | 58cc/62 | Printed index; initial X also copied to saved X |
| X | 11d4:016a | 776e/10 | Printed index |
| F | f26:0004 | 514a/32 | Printed index |

Offsets within each sparse record follow the original scanf destinations,
including B's initial X/Y at+42/+44 rather than+4/+6. The original B count is
stored at3a42; F count at882c. The loader reads exactly the declared count.
Variant0 has two consecutive B rows labeled30; they populate records30 and31.
Its F section declares16 while containing an extra row16; that trailing row
does not initialize fish16. These are source quirks, not corrected data.
The original1090:04d2 scan visits columns0..5, rows0..2 in that order and selects
the first nonzero A cell. Starts are respectively(0,0),(0,2),(0,1).

## Verification and limitations

Run `npm run verify:jungle`. It rejects missing/corrupt originals, requires
exactly3 cases/348 declared records, compares all65536 initialized DS bytes to
pinned independent static-oracle hashes, and checks the starting scans. Negative
controls corrupt the duplicate-label record, remove a case/section, overflow a
field, exceed table capacity and select an invalid variant. Additional checks
preserve the ignored trailing F row and unrelated incoming DS bytes.

`scripts/verify-jungle-oracle.py` independently follows the original scanf
formats using Python's memory packing and a separate section scanner. It reuses
the already verified archive/EXEPACK decoders only to obtain original bytes. It
compares its results with `reference/jungle-maps.json`; it never updates expected
values during verification. No proprietary resource dump is committed.

These are static map-loading checks. They do not prove jungle gameplay,
rendering, original runtime parity, input replay, audio or timing. The original
entry next initializes animation lists, hazards and randomized pickups, then
polls joystick input at body0651 before collision/scene passes. Actor action
selection is f97:06a9 (Ghidra currently fails to decompile it); camera movement
is body0591. Actor world X/Y are DS5f46/6858, current action6882, facing3d12
and platform column/row544c/5462. The animation helpers are now translated
from raw disassembly and checked below. Stateful presentation and browser
integration are documented in the later sections;these map checks alone do not
establish either behavior.

## Actor animation and conditional original scenario

`src/game/jungle-animation.js` translates the sparse14-byte actor-list writes
at body173e..1ef4, actor selection at originalf97:06a9, frame advancement064e,
and main11c5 presentation-history/descriptor updates. List fields are resource
pointer, frame, delay, object-specific motion/flags and X/Y offsets. Actor
frames apply X/Y changes to world coordinates; object animations retain those
as draw offsets. Countdowns decrement to zero without advancing until a later
call. Heap resource and list pointers are unsigned16-bit offsets even when
stored/read through signed word fields; this matters for captured fcxx pointers.
The module also statically translates the shared object initializer/advance
helpers000c/01e6. Their captured runtime coverage is still absent.

Actor drawing emits original sprite/frame/position commands using a caller
supplied resource-pointer map. Page-history updates occur explicitly in
simulation before rendering; rasterization cannot advance animation or consume
RNG/time/input. Direct driver sound requests honor original DS03be. Resident
0dcc calls are driver waits, exposed as a required `wait` provider where used;
the earlier `sequenceSound` name was misleading and has been removed. There is
no audio-completion or host-clock substitution. Full audio fidelity is unverified.
Vine projection has an explicit geometric provider; its missing default stops
with a useful diagnostic. Other actions beyond the captured subset are static
translations and still require gameplay comparisons.

`reference/jungle-animation.json` pins26 ignored local artifacts. Setup continues
from the original mountain walking scenario. Right held through mountain failure
returns on day14; map navigation overshot to slot33. At main01f5:0439 stop77,
exactly one target byte SS1403:9f5e was changed33→25 (Okeefadokie Swamp) before
travel calculation. Natural flight with Fire/Down, then release/stall/crash and
repair, reaches jungle entry80 with variant0/day17/seed40257. No code/resource
file, CPU register or machine checkpoint was changed. This additional setup
injection is explicit and separate from the prior mountain scenario's injection.
Navigation/flight are conditional setup, not an independent campaign replay.

The comparison requires12 routine checkpoints: list initialization, idle5/walk1/
Fire18 selection, four walking frame advances, three Fire advances (including
loading delay8 then decrementing to7), and actor presentation. Selector arguments
are checked against incoming stack bytes and a separate three-event stream.
Every routine starts only from its BEFORE capture. Two additional animation-only
sequences start from their first BEFORE state and carry all actor state across
four/three checkpoints, without injecting intermediate expectations. They do
not replay the surrounding unported physics/hazards or browser scheduler.

Initialization compares all65536 DS bytes except exactly14 bytes at the current
loop/interrupt stack interval BP-14..BP (BP9e6a). Other checks compare named actor
counters, pointers, world positions, facing/action/riding flags, sound enable
and selected sprite-frame byte. Presentation also compares page history and
resource X/Y. All18 resulting routine/carried actor poses decode and render from
the original sprites. Five negative controls corrupt code, alter an initialized
delay, alter an expected world position, omit a routine and omit a carried frame
advance. Missing/corrupt local captures are explicit setup failures.

These checks prove conditional routines and two carried animation segments;
they do not prove full jungle gameplay, controls, hazards, complete-scene pixels,
audio or wall-clock timing. Browser integration is verified separately below. The local original screenshot `.local/jungle-original.png` is an
exploratory capture at stop104, not a pixel expectation.



## Control selection and collision foundation

`jungle-controls.js` translates main0651..0aad. A caller supplies the consumed
joystick byte, then the routine selects actions from the current actor state,
platform edges, moving-platform ownership, fish support and vine reach. It
normalizes Fire's40 bit into80 but still compares complete byte values. A
cooldown returns before clearing input. On other paths, resident040e:19a5
clears exactly128 bytes at DS276c..27eb and copies BIOS queue tail to head.
The DS clear is translated; the BIOS flush is an explicit provider callback.
It must not fabricate the next consumed input byte. A browser keyboard provider
must account for new key/repeat events after this clear; continuously replaying
an old press would differ from the original keyboard-matrix behavior.

`jungle-collision.js` translates the main0b1e pickup/ground test and these
supporting boundaries: platform query1090:041c, edges0399/03db, moving-platform
detach073d and dirty flags054c/02fe, snake dirty flag1149:024b, dirty rectangles
f97:0357, fish supportf26:04de and vine reach118a:043f. No collision callback
silently supplies a guessed result. These helpers use the original shared DS,
signed16-bit arithmetic, truncating division, inclusive bounds and32-bit cash
wrapping. Dirty rectangles retain the eight-pixel right overscan. Fish ID0 is
a valid support-query result, but the original directional step decision tests
for a result greater than0. The vine routine compares signed high words and
unsigned low words of squared32-bit distance; the extreme signed-overflow quirk
is retained and has a separate authored boundary check.

`reference/jungle-controls.json` requires seven original routine cases, each
starting only from its own BEFORE state at live0e0c:0680 (hardware joystick
return) and comparing at0e0c:0aa9. The independent byte stream is
0,3,7,1,5,c0,c3. Cases cover a busy neutral sample, idle Right/Left/Up/Down/Fire,
and Fire+Right during busy action6. That last case does not establish the idle
chord path. In between cases the original advances its own unported motion and
hazards; this is a conditional routine comparison, not a full control replay.
No additional memory/register injection or restore was used beyond the earlier
explicit destination setup in the animation manifest.

Each case checks exact actor/action/frame/countdown/grid/riding/input/counter
fields, the entire128-byte key matrix, selected sprite-frame byte and required
BIOS flush request. All seven poses decode/render. Four negative controls omit
Right, corrupt an expected position, corrupt the cleared matrix and omit a case.
Additional authored static-rule cases check cooldown/no-flush, idle Fire+Right,
platform lookup, vine signed overflow,32-bit pickup wrap/revisit and fish0.
Those modified initial states are independent checks, not original captures.
The command remains `npm run verify:jungle`; the original overlay identity is
checked by the animation verifier before these control cases.

Presentation,scene scheduling and browser integration have separate evidence
below. Ground,vine and moving-platform helpers have static evidence but no new runtime comparison
in these seven cases. No full-scene, audio, original wall-clock or browser
acceptance claim is made for jungle yet.

### Capture-tool limits encountered

`input_key` uses the same queued PIC timeline as `input_sequence`, even for a
release. While paused, a queued release can remain pending and subsequent key
calls return409. Thirty idle samples after a press consumed during an animation
still read0 because the original matrix flush had discarded it. The capture
recipe therefore waits for idle first, sends fresh presses, observes AL and
batches releases into one sequence. Confirm `replay_status` completion; do not
treat `events_scheduled` as delivery. Cancel stale pending schedules explicitly.
A focused tool correction would document this behavior on `input_key` and add
an atomic multi-key release operation, rather than requiring queued single-key
calls that conflict with one another.

After the seven control cases, an uncaptured extra chord attempt continued
through natural final life loss and returned to the map on day18. That attempt
is not a regression checkpoint. The subsequent entry and current live state
are recorded below; earlier stops refer only to their own capture boundaries.

## Actor movement and support contributions

`jungle-motion.js` translates main0c98..11c4 from the original21-entry dispatch
table and raw disassembly. Ghidra follows overlapping invalid flow in this
function, so its combined decompilation is not authoritative. Walking alternates
the low byte at8e26, falls advance by16 pixels until the fish/water boundary,
and action completion uses index+1 against count independently of frame delay.
Fresh selections skip the routine; main00fe clears that latch before each
outer loop's controls. Platform step completion retains the original1001→1007
quirk: the no-fish drowning choice is overwritten by idle.

Supporting translations include main0aae rider maintenance, f26:0684 fish
movement,1090:0824 moving-platform contribution and118a:03b3 vine endpoint
lookup. Vine projection is owned by the separate hazard update; this getter
reads the existing endpoint and anchor without host trigonometry. Platform
motion uses the original104 divisor. Resident040e:52c2 sets x87 rounding bits
to0c before FISTP qword and restores the control word, so conversion truncates
toward zero before the16-bit AX store. The verifier pins all51 original helper
bytes. No translated motion routine consumes host randomness or wall time.

`reference/jungle-motion.json` records a new entry, not a reuse of the old
live mapping. After the map pause158, a mouse warp did not change the game's
selected TooPei destination22. Ordinary travel, flight stall/crash and repair
advanced to day22. At resident01f5:04ca stop163, the destination stack byte
SS1403:9f5e was explicitly changed22→25 before assignment/dispatch. This is
conditional setup after unrelated travel; it does not establish a normal jungle
journey. No machine restore, register writes, fitted timer or later memory
injections were used. Entry164 is variant0/day22/seed37850. All24056 overlay
bytes, including436 relocations with01f5 load bias, match again.

Twenty-five conditional routine cases cover idle, walking, the short upward
step, downward drop, falling and the water-death transition. Each starts only
from its own BEFORE DS at live0e0c:0c98 and compares at11c0. Every DS byte is
compared except9e3a..9e6d: a52-byte interval occupied by the routine's saved
registers, locals and nested-call/interrupt scratch, below the incoming SP9e6e.
No game table is excluded. Three independent AL snapshots document the actual
setup Right/Up/Down samples3/1/5. Motion itself has no external input events;
the producer schedules are setup evidence rather than an input replay.

Three carried actor segments add21 checkpoints, starting once from the first
BEFORE and keeping their own state through subsequent calls. Between calls,
the fixed main00fe clear of8b56 is reproduced from static code, never fitted
from expected output. These comparisons cover named actor/action/frame/grid/
riding/support fields and sprite frame; hazards, controls, ground checks and
page histories outside these calls are not a whole-loop replay. All25 post
poses decode/render. Five required negative controls reject a changed code
byte, omitted case, omitted movement update, altered expected result and omitted
scheduler clear. Authored platform truncation/constant rejection and vine-data
checks remain separate from original runtime evidence. Platform/fish riding,
vine attach/detach and remaining branches currently have static evidence only.

Run `npm run verify:jungle`. All55 local capture artifacts are required and
hash checked; missing/corrupt captures fail explicitly. No full scene pixels,
original audio/timing or jungle browser acceptance is claimed by these actor
checks. Hazard,scene and browser evidence follows separately below.

After the dispatched Down release and neutral AL0 at stop218, the original
continued through natural life loss and the reset boundaries recorded below.
No owned breakpoints or pending input schedules remain. Current overlay bytes
were revalidated on entry164; captures stay pinned to their recorded boundaries.

## Initial hazard reset routines

`jungle-initialization.js` translates fish initializationf26:00d4, vine
initialization118a:0002 and bonus initializationda0:0783. These functions remain
independent of the DOM, rendering and browser clock. Fish setup consumes one
original RNG draw per declared fish plus one for phase selection (17 draws
for variant0), retaining shared seed2229. Type17 preserves the loaded amplitude;
type18 sets32. The original CWD/XOR/SUB/SAR/XOR/SUB quarter calculation is
preserved even for the signed minimum overflow. Unknown fish counts/types stop
with a diagnostic. Bonus initialization keeps sparse animation writes and
the original difficulty waits350/200/100. Vine initialization visits all ten
slots, copying anchor/endpoints and setting the original motion counters.

`reference/jungle-initialization.json` pins four local captures from natural
life loss after motion stop218. Fish BEFORE/AFTER219/220 compare the complete
DS except42 bytes of call/local/interrupt scratch9e44..9e6d. Bonus221/222 compare
all DS except8 stack bytes9e66..9e6d. Incoming SP9e6e and saved BP shape are
required. No globals, resource descriptors or RNG fields are excluded. No new
injection/restore/device input is used; the prior conditional destination setup
remains inherited. Three negative controls omit a case, lose the internal RNG
advance and corrupt the expected bonus wait. All local artifacts are required
and hash checked by `npm run verify:jungle`, after complete entry164 code identity.

Vines and other difficulty values have authored static-rule checks, not new
original runtime coverage. These two conditional reset cases do not establish
a complete life reset, scene, audio/timing or browser gameplay. Additional
initializer evidence follows below; hazard advancement and complete scene
composition remain before integration. The original's da0:0783 is a
physical alias of main2013: the live CPU reports0e0c:2013, not0f95:0783; the
manifest records the actual CS/IP rather than assuming a unique segment alias.

The stop222 pause was followed by the setup below. No original resources or
code were changed.

## Remaining hazard initializers and carried entry

`jungle-initialization.js` now also translates monkeyse7a:0006, birds1036:000e,
snakes1149:034a, transports11d4:000e, platforms1090:0a6f and life setupmain12dd.
The dirty/dependency flags fromea1:00f5 and1036:050f are shared collision helpers.
All six monkey/five bird slots are visited, including inactive entries; snake
reset deliberately starts at slot1. Transport coordinates are written to slots0/1
while its dirty helper receives1/2. Sparse animation fields retain their incoming
contents. Platform pickup rolls run only on first entry; retry preserves pickups
and consumes no platform RNG. The raw routine sets an unused difficulty local
35/25/15 but its actual pickup comparison remains the constant25. Life setup
resets position, action, facing and support flags, initializes page history and
emits the original palette request through an explicit output callback.

`reference/jungle-hazards.json` requires23 local artifacts,10 conditional routine
cases, two independently recorded first/reset arguments and9 carried initialization
checkpoints. After stop222, Down press/release causes another natural loss and
monkey/platform reset223..226. A second Down after neutral227 causes final loss
and jungle exit228. Map Fire reaches resident0439 stop229 with selected22 but
current location25. A separately recorded target stack-byte22→25 override makes
this a same-location retry; it skips flight, opens the guide and enters jungle
at230 (variant0/day23/seed2725). No later memory/register injection, partial
restore or machine checkpoint is used. All24056 code bytes match after436
relocations at load bias01f5. Reset cases still refer to the prior entry164;
fresh-entry cases231..246 refer to230.

Every conditional routine compares all DS bytes except its fixed documented
call/local/interrupt scratch interval. Only the bird routine additionally
excludes DS2225..2228: the asynchronous IRQ8 clock advanced during that call.
This exclusion is based on pinned original driver evidence, not a fitted timer.
Resident040e:0cfa passes AX2225 and DS to the driver initialization pointer2010;
the captured pointer is2f7b:037b. Decoded IT.DRV entry5 code02a8..03c0 matches
live code exactly. Its initializer saves1403:2225 at driver028c, installs IRQ8,
and its handler0351..0358 increments word[BX] with carry into[BX+2]. The counter
is read by resident0dc4 and used by wait0dcc. Adjacent RNG2229 remains compared
exactly. Other conditional initializer cases do not exclude the clock.

The carried run starts once from BEFORE231 after original allocation, map
loading and actor-list preparation. It retains all state through seven hazard
initializers, life setup and platform initialization, comparing nine complete DS
checkpoints without inserting expected intermediate state. Its exclusions are
only that four-byte device clock and the union of helper call/argument/interrupt
scratch9e3e..9e71. Argument slots extend above the first helper SP because calls
have different argument counts. One outgoing life palette event is required.
This establishes conditional initialization through all hazards/lives/pickups;
it is not an independent resource allocation/startup or gameplay replay.

Five negative controls reject changed live code, an omitted routine, corruption
of the RNG adjacent to the clock, treating first entry as a retry and omitting
the carried bird initializer. Run `npm run verify:jungle`; missing/corrupt
artifacts and incomplete cases/arguments fail. This initializer evidence does not
establish scene pixels, hazard advancement, audio/timing or browser acceptance;
later sections add scoped scene and advancement comparisons.

After initializer246, run to main0680 stop247, observing neutral AL0, then049a
stop248 after the first presentation path. CPU/DS captures are local
`.local/jungle-scene-initial.json` and `.local/jungle-scene-first-frame.json`;
the raw screenshot is `.local/jungle-scene-first-frame.png`. They are exploratory
renderer setup, not part of accepted initialization evidence or an established
pixel/timing comparison. Front-buffer/VGA capture alignment still needs checking
before using the PNG as an exact frame expectation.

The first-frame pause248 was followed by the rendering checks below. Scene
work follows raw main032b..049a:
backgroundf97:0479/04ab, terrain1090:0528, monkey e7a:0318, fishf26:01f6,
bird1036:0246, monkey projectile/overlaye7a:0912/09c0, vine118a:01f0,
snake1149:0008 (only while actor action45), transport11d4:006b, actor main11c5,
bonus main21ff and HUDe4c:0144. Ghidra function labels sometimes use equivalent
segment aliases; raw far-call bytes decide the actual routine boundary.

## Full-scene compositor and exact presentation comparisons

`jungle-scene.js` reconstructs the complete viewport as pure drawing commands
from a presentation-boundary DS snapshot. The renderer does not advance tuples,
change dirty counters/page histories, consume input/RNG/time or write memory.
It follows the original order: repeated background, static platforms/pickups,
background snakes, moving platforms/monkeys, fish, section birds/projectiles/
vines/transports, actor, bonus and HUD. Foreground visits three sections (four
while scrolling); background snake coverage uses its separate inclusive range.
Incremental two-page copying is not established by this full-redraw compositor.

Backgroundf97:05bf first copies JG4, draws JG7 frame1 at48,0, then takes the
104-pixel strip from source56..159. Background04ab repeats it with the original
eight-pixel copy rounding. HUD cards use MAIN25/23, the font is MAIN42, but life
icons use **MT12**: the original filename at DS1acf is `mt.arc`. All originals,
including MT.ARC and IT.DRV, are hash checked before these comparisons.

The supported EGA320x200 palette remains explicit and separate from the viewer.
Life setup changes slots5/13 to red,blue,green; this milestone captures red and
blue. Driver1 palette code008e..00e4 matches the live bytes at2ed7:008e. Its
table pointer is DS2056 and its cached16 colors match original bytes masked3f.
The low RGB bits/intensity bit4 projection is checked against every captured
screen pixel. Without life palette application, the first frame differs in80
Scrooge pixels; these differences are corrected, not excluded.

`reference/jungle-scene.json` requires20 local artifacts and eight exact320x200
RGBA comparisons: four idle frames, three downward-step frames and the initial
two-life scene after natural drowning. The independently observed setup Down
sample is AL5 at0680 stop253. Actual requested input timing drifted while paused,
so that producer schedule is setup provenance, not a timing/gameplay replay.
There are no new memory/register injections, restores or fitted timers. The
earlier conditional target override before entry230 remains inherited.

DOSBox raw capture returns the last completed VGA frame rather than guaranteeing
the just-presented page. A single fixed offset of one presentation is required:
state248→PNG249,249→250,250→251,251→252;254→255,255→256,256→257;260→261.
The initial simultaneous248 capture also matched, but is not used to choose
per-case alignment. Cross-frame experiments and the extra252 image confirm the
fixed offset when fish pixels change. The verifier never searches for a best
match. Zero tolerance, every RGBA byte, no image exclusions. This rule is scoped
to this build and capture sequence; it does not establish wall-clock parity.
A focused capture-tool improvement would expose the captured VGA frame/page
identity alongside `screen_capture`, or offer current-front-page capture; its
current `raw` description does not explain this cache alignment boundary.

One separate life-reset routine258/259 consumes the independently recorded
first=false argument (also checked against incoming stack). All DS bytes match
except22 bytes of call/local/interrupt scratch9e56..9e6b; one palette output is
required and life count becomes2. It does not use a post-state to initialize
simulation. Seven negative controls reject a missing case, wrong blue-coat
palette, omitted forest, wrong capture alignment, changed pixel, render-time
memory mutation and wrong reset argument. An invalid visible sprite frame must
stop explicitly. Error reporting compares every byte but prints only the first
divergence; Node's large structural Buffer diff exhausted memory during the
deliberate failures and is no longer used for image comparisons.

Run `npm run verify:jungle`. Rendering is conditional on captured state; it is
not a closed-loop simulation or independent browser acceptance. Other variants,
camera scrolling, incremental page copies and active enemy/projectile/transport/
bonus pixels still need targeted comparisons. A known boundary matters for
projectile hits: original e7a:0912 draws the projectile before09c0 may deactivate
it and change the actor. An arbitrary post-collision snapshot cannot reconstruct
that already-drawn projectile from its now-cleared active flag. The production
loop must retain drawing commands at those consumption boundaries; this snapshot
compositor is not acceptance for hit frames. The separate projectile presentation
and collision helpers below now preserve that ordering; presentation-side state
updates and the main scheduler are now implemented separately below.

The stop261 pause was followed by the advancement comparisons below.

## Hazard advancement, collisions and explicit waits

`jungle-hazards.js` translates main0251..0323's section pass: moving-platform
attachment/animation, bird decisions/attacks, vine projection, monkey decisions/
climbing/throws, projectile movement, snake trapping/escape, transport completion,
fish phases and the idle-triggered moving bonus. Camera0591 remains separate.
Rider maintenance and actor motion follow this pass in the caller. RNG always
uses shared seed2229 and the original integer generator; short-circuit draws and
unsigned probability comparisons are retained.

The monkey dispatcher e7a:0402 does not decompile coherently. Its eight-entry
table11..18 is translated from raw disassembly, including its unconditional dirty
local and countdown behavior. The bird distance test uses the actual signed
DX:AX result (distance>=10000), not a stale high word from decompilation. Vine
projection uses resident040e:14d7/151a's byte table at DS269a, preserving XLAT's
AH, word overflow, CWD/XOR/SUB/SAR division and sign changes. It uses no host
trigonometry. All129 original trig-code bytes are pinned; quadrant checks are
authored static-rule evidence in addition to original whole-pass comparisons.

`presentJungleProjectile` implements e7a:0912 and requires a drawing sink for a
visible projectile. The sink snapshots the descriptor immediately;09c0 collision
is a separate call. A hit can start monkey action18, clear the projectile and
force actor falling after it was drawn. The new original draw/miss/hit captures
verify that state boundary. They do not turn the snapshot compositor into a
complete renderer for collision frames.

The old `sequenceSound` callback in jungle object/fish helpers actually represented
resident040e:0dcc. It is now `wait`, with required providers for fish boarding and
monkey-hit animation. Missing providers stop development mode. Original waits0
and7 run even with sound disabled. The hit capture records both wait entries and
0603:0df1 immediately BEFORE reading the driver counter and storing the new wait
base. Counts166605/166612 are independent external events from those boundaries,
not values fitted from the final hit state. A provider carries its own base,
checks the seven-tick deadline, updates clock2225..2228 and base2221..2224, and
must consume both events. Timing/input scheduling in an independent browser
environment still needs implementation; these are conditional consumption checks.

`reference/jungle-advance.json` requires45 local artifacts,12 conditional whole
passes and six other game checkpoints: bonus spawn,two camera calls,projectile
draw,miss and hit. The two pre-read clock boundaries bring the total to20. Three
projectile ID arguments and two clock events must match the original incoming
stack/consumption snapshots and all be consumed. The hit segment starts at
106f:0a39, after pure geometry calculation/local writes but before any collision
game-state write; AX1 is observed and the JS helper recomputes overlap from the
same BEFORE geometry.

All65536 DS bytes are compared outside explicit stack scratch: whole passes
9e36..9e71 plus caller section cursor9e78..9e79 and record pointer9f44..9f45;
other routines use the exact intervals in the manifest. No game-global,descriptor,
RNG,clock or wait-base exclusions. Captures must start at the first section and
finish the full pass. No expected state is inserted between calls. This is not
a carried gameplay comparison: original control,rendering,history and device
logic runs between each independently captured BEFORE/AFTER pair.

Setup is explicitly conditional. After scene261, ordinary idle passes262..267
lead to bonus spawn268/269 and moving pass270/271. A position/camera override
at272 sets X8→340 and camera0→312. A mistaken camera stop064c was inside the MOV
at064a; no breakpoint fired, and an unmeasured interval ended in natural life
loss. A memory read taken while running is rejected and absent from acceptance.
At requested pause274, the atomic CPU/memory batch reports0b83:01e6 (the pause
notification had reported01ea); neither is treated as a routine boundary. All
24056 overlay bytes match again after436 relocations; the game is in life3.
The valid camera return is0650, used by275/276. A second recorded setup at277
sets X8→400,Y16→80,camera0→312. It exposes vine1,monkey1 and snake1, followed
by passes280..287. The monkey's current Y8 is retained from the earlier life;
its reset restores X but does not reset Y. An active-projectile condition reaches
288 in section5,not the first section3, so that observation is setup only.
Drawing/miss289..292, whole passes293..300 and a later actual hit301..306 are
accepted at checked instruction boundaries. No registers,code/resources,partial
machine restore or fitted timer is used. The failed stop attempt prevents any
claim that this entire original capture history is a reproducible timed replay;
each accepted conditional routine remains reproducible from its required fixture.

Seven negative controls remove a case,omit an update,corrupt RNG,lose the drawing
event,omit a clock event,complete a wait early and leave an extra event unconsumed.
Additional authored static checks cover trig quadrants,snake capture/escape,
transport completion and missing wait diagnostics. Remaining bird attacks,monkey
branches,fish boarding and other state combinations still need targeted runtime
comparisons. Run `npm run verify:jungle`. No full-level,independent browser,audio
or wall-clock timing parity is claimed.

For the runtime boundary, main1227 invalidates the previous actor rectangle;
it is not a timing wait. The frame footer calls original098e:01d8 (Ghidra198e),
which waits against deadline27f8/27fa and schedules the next deadline from the
driver counter plus27fc/27fe (entry sets the interval to3). Its DX:AX arithmetic
was checked in raw disassembly before implementing the scheduler:unsigned
high-word/low-word comparisons followed by ADD AX/ADC DX and word stores. Graphics
flip1fd4 points to live2ed7:00e5, which also calls the driver retrace helper0064.
Keep driver-clock deadlines and display retraces separate from browser frames.

## Stateful presentation and bounded pixel pages

`jungle-presentation.js` translates main032b..047c,including dirty rectangle
restores,platform redraw/coin passes,monkey/fish/vine/projectile histories,actor
history,bonus presentation and the conditional HUD. Draw descriptors are consumed
immediately before reuse; projectile drawing precedes its collision. Driver
color is an explicit incoming/outgoing byte. No DOM or browser clock is used.
The helpers retain original redraw-counter behavior,including the pickup pass
occurring after decrementing static-platform redraws and the nested vine2 gate.

`jungle-raster.js` keeps two EGA pages,one saved background and the forest strip.
Pixel storage is bounded at108800 bytes,plus108800 bytes of validity masks and
temporary current-pass commands/pixels. Reading unwritten bits stops explicitly;
initial allocation zeroes are never accepted as original pixel evidence.
It copies width>>3 bytes from sourceX>>3 to destinationX>>3,matching driver01ef;
only the destination bottom is clipped. RAM planes remain contiguous,so right
overscan retains scanline/plane addressing rather than being horizontally clipped.
Unknown surfaces,negative rectangles,overlapping copies and reads outside allocated
storage stop with diagnostics; those unsupported cases are not silently simulated.
The existing pure sprite/font/line rasterizer draws into the selected page.

`reference/jungle-presentation.json` pins19 local artifacts and6 independently
started BEFORE/AFTER state passes307/308,309/310,314/315,316/317,318/319,320/321.
Redraw counters entering these are0,0,3,2,1,0. All DS bytes compare exactly except
helper/call/interrupt stack9df2..9e71 and the independently advancing IRQ8 counter
2225..2228. Caller locals,dirty lists,histories,descriptors and adjacent RNG remain
exact. Every pass consumes its independently captured incoming graphics-driver
color; outgoing color matches exactly. No AFTER value supplies an input.

After310,an armed032b condition78e8>0 sees19 nonmatching frames; the game returns
to map without another matching stop. Pause311/delete248,then Map Fire100ms press/
250ms release reaches resident0439 stop312 with target25/current25. No new override
is needed. Entry313 revalidates the complete overlay after436 relocations at01f5.
Fresh entry produces passes02..05. Each checkpoint atomically reads CPU,DS and
2ed7:0024 color. This capture adds no register/memory write or restore; inherited
conditional campaign setups remain explicit in the earlier manifests.

A separate raster comparison carries only its pixel pages/background through
02..05,consuming each original BEFORE game state and page descriptor. The first
frame's own incoming stack flag9f42 requests copying to the other page. The final
image matches all320x200 RGBA bytes of PNG323,after four passes,with no image
exclusions or tolerance. The prior established fixed one-presentation VGA cache
offset maps post-flip state322 to PNG323. Wrong PNG322 alignment is rejected.
This is carried pixel storage with conditional game states,not a whole-game replay.
Other negative controls remove an input/case/frame/restore,corrupt RNG/color/pixels,
leave an event unconsumed,omit a required sink and read unwritten pixels:
11 required negatives in total.

The live EGA driver00e5..035c matches decoded IT.DRV1 except four required exact
self-modifying words. Copy01ef writes32d/331=row-stride minus copy byte-width and
341/34b=source/destination plane stride. Capture323 has36,36,8000,8000 following
the32-pixel actor restore; these exact values replace the original1234 placeholders
for code comparison. Every other byte is exact. They are expected code patches,
not simulation inputs or a blanket code exclusion.

Run `npm run verify:jungle` (also required by `npm run verify`). Missing/corrupt
local captures fail setup. Pixel evidence covers this initial viewport sequence;
scrolling,other hazard/hit pixels,driver deadlines,retrace scheduling,independent
startup and browser jungle gameplay are outside these presentation checks;the
next section adds separate runtime evidence.

Current original: paused0e0c:04b0 stop330,variant0/day24,AX1 before successful
return after the conditional chest comparison below. All controls released,no breakpoints or pending schedules.
Fresh overlay mapping was revalidated at313.

## Browser runtime and current playable slice

`jungle-state.js` translates loader13d4's observable resource/map/list setup.
Original assets remain authoritative;runtime descriptors occupy explicit virtual
DSa000..a167 and framebuffer handlesa400/a40c/a418. These addresses replace DOS
allocation,not game mechanics. Observable geometry/frame/coordinates stay in
original descriptor layouts;unused DOS data/mask far pointers are not consumed.
The supported EGA drawing page starts atA200 and flips with XOR0200. Maps,
source text,animation lists,palette and hazard initializers use the source order.
A prior expedition DS may be carried;independent startup uses static executable
data with zero BSS. No captured state is loaded in the browser.

`jungle.js` runs the original main-loop sequence:invalidate old actor,input,
ground,life reset,camera,hazards,rider,motion,presentation,page operation,frame
deadline. Browser keys emulate original joystick bytes1/3/5/7 and Fire40;the
provider owns held controls independently of the cleared DOS keyboard matrix.
Driver ticks and display retraces are separate. The driver rate is PIT1193182 /
(1365*12),not125Hz;the independent retrace provider is70.086Hz. Resident098e:01d8
uses unsigned DX:AX comparison and ADD/ADC,not the decompiler's staleDX value.

Synchronous translated segments finish at a logical driver timestamp. A required
wait provider implements040e:0dcc's unsigned base+ticks deadline and consumes its
own clock. Subsequent input,presentation and sound are held until the advancing
driver provider reaches that logical timestamp. Audio completion does not enter
these jungle mechanics. This preserves waits with sound disabled;there is no
rollback,expected-state/timer fitting or host randomness. Internal states during
a queued segment wait are not original checkpoints. Instruction-duration/IRQ
alignment and original whole-loop timing remain unverified.

EGA0155/0101 wipe/reveal rows0,5,...195,then1,6,...196,etc,with five retraces per
group. Entry/outgoing clears consume25 retraces;first-frame wipe plus reveal
consumes50. The final cleanup includes its separate25-retrace clear too. Wipe
payload alpha0 explicitly preserves the incoming renderer screen;the DOM renderer
owns that pixel source and never returns it to simulation. Reveals progressively
copy the completed jungle page. Masks,pages and renderer incoming-screen storage
are bounded;no historical frame command chain is retained. This translation has
static driver evidence;original transition-pixel/timing comparison is pending.

`reference/jungle-runtime.json` requires five hashed local original artifacts.
Its conditional loader starts from entry230 BEFORE,consumes campaign values
checked there,and compares against initialized246:12 full entity/map/pickup/edge
ranges,33 animation lists,all loaded descriptor geometry/frame,actor globals,
palette and RNG. Only tuple sprite pointers are normalized to explicit asset IDs;
unknown identities fail. DOS heap/archive/freed-resource/stack/device state is
outside this semantic initialization comparison. It is not a full-DS loader proof.

The whole-frame case continues stop323:checked run-to00dc stop324,independent
joystick consumption0680 stop325 (AL0),then047c stop326. Each game boundary
captures CPU+DS;before/after also capture driver drawing color. The simulation
starts once from324,consumes the recorded incoming joystick/color,and carries all
state through every helper in order to326. All65536 DS bytes compare except the
fixed128-byte helper stack9df2..9e71 and identified IRQ8 counter2225..2228.
RNG,descriptors,histories,dirty lists and all game globals compare exactly.
No new input schedule,injection,register write or restore was used. This neutral
initial-viewport frame does not establish original life-reset or scrolling loops.

A separate independent replay starts only from original static files,authored
campaign seed2725/$44/day23/Easy/variant0,virtual descriptors and its own driver/
retrace providers. Its five input runs total824 samples:neutral2,Fire1,neutral15,
Right18,Down788. It carries all game state through20 exact snapshots/full-memory
hashes/presentation-payload hashes,6405 clock events and875 display updates,then
requires an exact final failure state at scroll960. Fish travel covers much of
the level. Expected values are authored port regression data,not original capture
outputs. Eight negatives corrupt seed,input,dirty invalidation,pixels or required
case/event counts;missing/corrupt artifacts and unsupported paths fail explicitly.

`tests/browser/jungle.spec.js` exercises actual verified file loading,keyboard
flight,jungle jump/walk/drop,life loss,calendar/map return,direct same-location
retry and restart. No game memory or expected state is injected. Separate manual
browser exploration collected$50 and observed the coat/HUD life change. Required
commands are `npm run verify:jungle`, `npx playwright test tests/browser/jungle.spec.js`
and the full `npm run verify`. Missing local originals are setup failures.

Next:implement photography,then trading and endings. Other maps/difficulties received exploratory short runs only;
those are not full acceptance. Original scrolling/enemy/hit pixels,whole-loop
clock/IRQ alignment,audio and full-level replay remain open.

## Treasure completion and shared-palette cleanup

JG15 is the treasure chest. The existing internal `Transport` names refer to X
records,not teleportation. Original11d4:00cb tests the actor center/Y+16 against
an inclusive48x30 chest rectangle after checking nearby columns. Variant0 X1
is at(1125,85),so its rectangle ends at(1173,115). Contact sets1aac=1;the main
loop finishes its current presentation,cleans up and returnsAX1. The campaign
caller spends one day,credits the assigned treasure value,then marks the location
collected after the award dialogue. No Fire action is required at the chest.

`reference/jungle-treasure.json` pins five local original artifacts. Continue
stop326 to main0651 stop327,and revalidate all24056 relocated overlay bytes.
Four explicit CAS setup words move X8→1124,Y16→80,camera0→960 and redraw0→3.
Before/after setup DS differs in exactly these words;CPU registers are unchanged.
Run original goal helper live13c9:00cb stop328 with independent stack argument1,
then014f stop329. Actor point(1128,96) lies inside the chest rectangle. The port
helper matches all64K DS outside its fixed40-byte call/local stack9e44..9e6b.
Clock,RNG,descriptors and every game global remain exact. This position/camera
injection is conditional completion evidence,not an original whole-level replay.

Run main04b0 stop330 before RETF:AX1 and success flag1. The original also restores
shared palette slots5/13 to85/8d. `restoreJunglePalette` now performs those source
writes before returning;the captured EGA-mode0 palette matches all17 bytes,and
no other DS byte may change in that helper. The other source video mode also
restores slots1/9;it has static evidence only. DOS heap/archive release remains
outside the browser's virtual allocator boundary. This fixes the previously
retained life palette in carried campaign state;the visible screen is black
before the next scene renders,so the omission was not exposed by the old PNGs.

An independent full-level route starts from variant0/Easy,seed11324,$0/day4 and
static original files. The inputs total792 samples:neutral2,Fire1,neutral15,
Right18,neutral8,Down722,Up5,Down2,Up17,Right2. It carries its own state through20
exact snapshots/full-DS/presentation-payload hashes,6026 driver/retrace events and
839 display updates,and requires success with one life at X1124/Y80/scroll960.
The eight neutral samples are player input chosen during exploration to board a
fish,not fitted timer values;the clock providers remain unchanged. Expected
outputs are authored port regressions,not original level capture outputs. Nine
negative controls omit setup,goal contact,climb,checkpoint or palette restoration,
corrupt argument/RNG/pixels,or leave an input unconsumed. Missing/corrupt local
artifacts and unsupported paths fail explicitly.

The browser scenario starts at title with BIOS-seed0,selects Easy and the swamp,
flies using actual keyboard controls,then reaches seed11324 through the ordinary
campaign/guide logic. It injects no memory,RNG,allocator or expected state. It feeds
the same792 inputs through real key events,checking20 semantic checkpoints at
matching input counts. Intermediate standalone timestamps,phase and display
counters are outside this DOM comparison because their observation phases differ;
position,action,RNG,lives,camera and cash remain exact. Final outcome/frame/display
counts,reward,calendar,collection and restart are checked exactly. The controlled
8ms display cadence observes inputs without changing the two simulation rates.

The complete browser route awards$1000 for this assigned treasure,returns on day5,
marks location25 collected,and shows the original collected notice on a revisit
without changing cash/day/location/seed. Run
`npx playwright test tests/browser/jungle-treasure.spec.js` and
`npm run verify:jungle`;both are required by `npm run verify`. Browser acceptance
is distinct from the conditional original return and independent level replay.
Original whole-level timing,scrolling/enemy/transition pixels,audio and other
variants/difficulties remain unverified. Photography,trading and endings remain
next;the full-game goal is active.
