# Jungle expedition

Jungle gameplay is not yet connected to the browser. The current foundation
loads the three original map resources, locates the starting platform and
translates actor animation lists, selection, countdowns, control selection,
ground/support queries, actor motion and presentation history.
The actor routines now have conditional original-runtime comparisons. The next playable route is flight/guide →
walking/jumping among the initial platforms → consequence → restart, followed
by the complete expedition and campaign reward. No substitute mechanics are
implemented while hazards and scene scheduling remain untranslated.

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
from raw disassembly and checked below. Complete hazard initialization and
the scene next, then compare that scene with the
original before claiming a playable jungle milestone. Existing cave and mountain browser routes
remain the working expedition routes.

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
RNG/time/input. Direct driver sound requests honor original DS03be; resident
sequence-sound requests have a separate callback. There is no audio-completion
or host-clock substitution in these helpers. Full audio fidelity is unverified.
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
audio or wall-clock timing. The browser still stops at the unsupported jungle
boundary. The local original screenshot `.local/jungle-original.png` is an
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

Complete hazard initialization, full scene composition and browser scheduling
still remain before a playable jungle route. Ground, vine
and moving-platform helpers have static evidence but no new runtime comparison
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
original audio/timing or jungle browser acceptance is claimed. Next: complete
hazard initialization and scene scheduling, then integrate this actor loop.

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
a complete life reset, scene, audio/timing or browser gameplay. Monkey, bird,
snake, transport and platform initialization, hazard advancement and complete
scene composition remain before integration. The original's da0:0783 is a
physical alias of main2013: the live CPU reports0e0c:2013, not0f95:0783; the
manifest records the actual CS/IP rather than assuming a unique segment alias.

Current live original: paused0e0c:208f stop222 after bonus reset; no breakpoints
or pending input schedules. No original resources or code were changed.
