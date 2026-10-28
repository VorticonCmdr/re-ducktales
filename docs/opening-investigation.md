# Opening sequence: implementation and evidence

The browser now runs the original title reveal, office arrival and introductory
kids/Scrooge dialogue before difficulty selection. Fire is consumed at the
original polling boundaries: a reveal skip finishes all11 rectangles, while a
dialogue skip follows the helper cleanup calls and final clear. The opening office keeps MAIN5 at x32, distinct from the normal office renderer
at x33; the captured opening pixels validate that placement. The simulation
uses original resources and executable text, explicit16-bit RNG, separate driver
and retrace clocks, and no DOM or browser clock access.

`npm run verify:opening` verifies three closed-loop source-boundary cases,
33 exact native PNGs, native exit seeds/flags and six dialogue cleanup sound
arguments. It also checks the101-byte relocated reveal routine captured after
all three fresh launches, in addition to the earlier source-only mapping.
Missing fixtures fail with SETUP; altered artifacts, missing Fire, wrong RNG,
changed pixels and an omitted checkpoint are rejected. See the versioned
`reference/opening.json`, separate `reference/opening-inputs.json`, and
[original capture recipe](opening-capture-recipe.md).

The constructor stops before consuming its first source input boundary so the
browser can deliver initial controls. First driver advancement starts execution.
Browser audio begins disabled; its first enable gesture can supply the original
initial sound option late. No original autoplay restriction is implied. The
second BIOS reseed on difficulty confirmation isolates campaign initialization
from introductory RNG, including when the opening is skipped.

Native CPU/file/decompression costs, full IRQ phase, exact DOS keyboard typematic,
hardware waveform and complete elapsed-time parity remain unverified. Security,
original difficulty presentation and office/door transitions remain separate
work. The following source investigation is historical evidence from before the
runtime translation; the old paused stop is not the current live session.

## Validated static source

Supported build: DUCKTALE.EXE SHA256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Ghidra `DUCK_UNPACKED.EXE` reports x86 LE16 real mode. The unpacked analysis
image matches `unpackImage` byte-for-byte; applying its original MZ relocations
with load bias1000 makes all101 bytes at12f5:0d89 match Ghidra exactly.
Original unrelocated image offset15577,length101 has SHA256
`2fd2e8fa8de05874c1c4879655b4cb68789e6abd8e36aeb3a8498dc422b307ce`.
The static image comparison establishes source identity. A separate fresh
read-only check of the preserved DOSBox stop1478 then matched all101 reveal
bytes at live04ea:0d89 after applying the original relocations with load bias01f5.
The current CPU was paused at01f5:1076, DS/SS1403, protected_mode=false. The native
session remained unchanged. This revalidates code correspondence, not reveal
execution, input consumption, timing or pixels.

Local mapping receipt: `.local/opening-audit/receipt.json`. Its1158-byte
immutable `accepted-00c60595554c/reveal-live.json` artifact has SHA256
`00c60595554c416a623c3d9899103672c8c4bdc35e8b7e8a8e7ef0db56345b7d`.
A one-byte mutation was rejected by the exact-byte comparison. This is a memory
read, not a machine checkpoint or a restore recipe.
The following complete function ranges also match after the same relocation:

| Address | Unrelocated image offset | Bytes | SHA256 |
| --- | ---: | ---: | --- |
|12f5:09e1|14641|266|`830d18abf464851aedd93178d4b6633bc9d80485f8d769ec7b9fafd038ecbfee`|
|12f5:05ba|13578|1063|`702410f4c37d478abd3c91d2699c34bc5c9ddea6fa210ab0352daf7c16b00058`|
|11c4:09f5|9781|88|`29c7a6a964b796914e9ba4d3c39ea964f1cdf051f5d0d6417effb6187bf9ba88`|

The09f5 decompilation misrepresents its loop counter as a return-address value.
Its original disassembly has `INC word [BP-6]` at11c4:0a28 and signed `JGE` at0a31.
These instructions, not the misleading C assignment, establish the polling loop.

Statically inferred from12f5:09e1 and0d89:

- Entry clears the intro-skip flag DS7979 and enables its input handling at4e0f.
  It loads MAIN.ARC2 and sends sound request1 only if DS03be enables sound.
- The reveal copies a rectangle from the loaded picture to the presentation
  page, at matching source/destination coordinates. Inset80 decreases by8
  through0; width is320-2*inset and height200-2*inset. There are11 iterations.
- Each iteration presents, calls the original input routine1124:0002, resets
  timer base with140e:0dcc(0), then waits with0dcc(2). The final signed JNS
  controls the loop. The reveal itself does not branch on the skip flag.
- After the reveal,09e1 checks the skip flag, copies the complete picture and
  calls11c4:09f5 with40 before another input/skip check. Disassembly of that
  helper shows an initial keyboard flush, then up to40 input polls. Fire ends
  it early; otherwise each poll resets the timer base, waits7 driver counts
  and increments a signed16-bit local counter. It is not a40-count delay.
- If still active,09e1 calls12f5:05ba, whose resource loads and animations are
  now translated in `src/game/opening.js`. It clears4e0f when returning. The interrupted intro
  sends sound reset0; title audio source hashes remain in title-audio.json.

The53-byte140e:0dcc helper reads the32-bit driver counter2225/2227 and retains
its base at2221/2223. Its original bounded comparisons are documented separately
in jungle/system-control evidence. No wall-clock duration or instruction cost
has been measured for the complete opening.

## Original investigation plan (historical)

Revalidate executable, launch path, segments and original bytes before using a
live address. Capture a natural opening and a Fire-during-reveal case with an
emulator-side input schedule. Record the first visible rectangle, presentation
count, input consumption, timer boundaries, skip behavior and resource sequence.
Keep that schedule independent of expected pixels/state.

Translate a small independent opening controller with explicit input, driver
clock and presentation effects. Inspect disassembly for05ba before translating:
its decompilation has unreliable local-array/stack reconstruction. Do not turn
that C into JavaScript by copying its inferred stack variables. Implement and
compare the first reveal/skip slice, then expand the following animation. Update
browser startup waits around observed states when required; do not preserve the
current instantaneous transition by inventing an original timing rule.

Full original opening timing, story/security behavior, office/door animation and
whole-campaign startup RNG remain incomplete or unverified.


## Rechecking the saved source mapping

Run `npm run verify:opening-source`. Its versioned contract is
[opening-source.json](../reference/opening-source.json). It checks the full
original executable identity, all four original source ranges, the pinned
capture/checker identities and every relocated byte in the saved101-byte
mapping. A temporary one-byte mutation must fail. Missing local capture data
produces an explicit setup error; it is never skipped or synthesized.

This focused check is preparation for the next runtime implementation. It does
not execute the opening and is separate from the full game/browser acceptance
gate. To recreate its capture, first establish the original process's current
load bias and source bytes. With the documented preserved session, the read was
`mem_read(segment=04ea,offset=0d89,length=101,view=bytes,include_registers=true)`.
Save a new exploratory read under `.local/opening-audit/`, with a new name. The
accepted fixture is `.local/opening-audit/accepted-00c60595554c/reveal-live.json`.
A new launch can have a
different memory layout; do not relabel or overwrite the accepted capture to
make it fit. Establish a new mapping/scenario and receipt instead.

## Prepared follow-up: difficulty screen

A fresh read of Ghidra `DUCK_UNPACKED.EXE`12f5:0aeb (670 bytes,
x86 LE16 real mode) identifies the remaining menu boundary. These are static
observations, not native menu acceptance. It starts difficulty0, invokes the
shared screen helper11c4:0008 with selector9, flushes input, then redraws at
seven-driver-count waits. Direction byte1 decrements with0→2 wrapping;5
increments with2→0 wrapping. Selection changes and Fire confirmation request36
when sound is enabled. Confirmation calls the BIOS reseed140e:0e01 before the
screen cleanup. The current browser preserves the three choices and reseed,
but still uses its simplified menu presentation and omits those menu cues.

Original text remains in the executable, not copied into a generated asset:
DS0624/0662 heading;0637/0642/0651 labels;0675..06e8 selected/unselected rows.
The heading is drawn at(168,60), rows at y80/100/120; selected text uses color12
and x168 with a `>` prefix, others color15/x176. The shared helper's selector9
jump-table entry is007c, verified from the original unpacked table at image1d91.
Do not interpret selector9 as MAIN.ARC sprite9: the helper selects presentation
procedures. Ghidra's current stored helper body includes misdecoded jump-table
bytes and its decompilation timed out. Resolve its007c path using original bytes
and a native menu capture before implementing the missing background/transition.

Follow-up static resolution: original helper007c..00b5 (image1cbc,58 bytes,
SHA256`879a245495252eab6f0be6b706077ef70c6982aff2d6a1535077ae0680a63d7b`)
loads MAIN.ARC32 through140e:175c, then joins the full-picture copy/presentation
path004f's tail. If DS2042 is nonzero, it temporarily changes palette byte2057
to41, calls graphics palette API2004 with nonzero1101, loads the picture, then
restores byte2057 to1 and calls the palette API again. The EGA driver masks palette
bytes with3f. The browser already uses MAIN.ARC32 and the original font; its row
text starts8 pixels too far left (x160 rather than selected-prefix x168). Exact
menu timing, input flush and sound36 dispatch still need application integration.
The static follow-up itself made no native session changes. Subsequent native
captures now verify four exact menu presentations, nine consumed inputs, five
sound36 calls and the BIOS reseed boundary; see [difficulty evidence](difficulty.md).
That core remains separate from the current browser menu, and does not establish
entry-animation or complete elapsed-time parity.

The first combined browser gate exposed old startup scripts sending Enter before
the reveal completed. Those scripts now wait on the actual difficulty scene
using `tests/browser/helpers/scene.js`; no inputs or simulation state are
injected, no route outcomes are weakened, and no delay is fitted from a final
state. The initial failed/aborted run is retained locally in
`.local/opening-full-verify.log`. A focused flight case interrupted by a source
reload was rerun with frozen code; both flight/cave and atomic routes passed.

A subsequent gate rejected a real negative-runner timeout, retained in
`.local/opening-final-verify.log`. The old120s wrapper could kill its180s browser
test before the required divergence. The wrapper now permits240s including
startup/teardown and explicitly rejects timeout/interruption errors. The wrong
climb still must fail checkpoint22 x; missing hooks still must fail checkpoint5
action. Route inputs, expected outcomes and comparison fields are unchanged.
The focused Bermuda negative rerun rejected its intended wrong climb.

The final frozen-code `npm run verify` passed117 unit,67 development browser
and2 production browser cases, zero skips, all original comparisons and the
production build. Accepted log/screenshots and read-only native cleanup are
pinned in `reference/opening.json` under `.local/opening-acceptance/`. The
original session remained paused at1544 with no breakpoints, freezes, scripts
or input replay active. CPU cycle settings were not exposed in the captured
MCP status; this is not an elapsed-CPU-time or whole-machine checkpoint claim.
