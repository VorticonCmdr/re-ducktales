# Opening sequence: remaining implementation work

The current browser displays MAIN.ARC2 as a static title and immediately selects
difficulty on Fire. The original title reveal and following opening animation
are still missing. Sound001 playback alone does not implement this sequence.
This investigation identifies the next runtime boundary. It includes static
and live code identity, but no new original gameplay/animation capture or
acceptance claim.

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
  not yet implemented. It clears4e0f when returning. The interrupted intro
  sends sound reset0; title audio source hashes remain in title-audio.json.

The53-byte140e:0dcc helper reads the32-bit driver counter2225/2227 and retains
its base at2221/2223. Its original bounded comparisons are documented separately
in jungle/system-control evidence. No wall-clock duration or instruction cost
has been measured for the complete opening.

## Next experiment

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
