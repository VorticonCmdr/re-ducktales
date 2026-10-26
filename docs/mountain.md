# Mountain expedition

The terrain and initial actor/table state are translated; mountain gameplay is
not yet connected to the browser. The existing guide still stops at the
unsupported mountain boundary. Do not interpret the terrain check as a playable
level or an original runtime comparison.

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
1c17:166c); its result agrees with the unmodified overlay disassembly. These
static addresses have **not** been validated against a live mountain session.

## Translated terrain boundary

Observed in original bytes and statically inferred, not runtime-validated:

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
  This preparation consumes no RNG. MAIN HUD sprites, allocator pointers,
  stack-local sprite 4, clocks, audio and complete frame composition remain
  outside this module's current boundary.

`src/game/mountain-scene.js` keeps the original resident tables in an explicit
64K memory object. The terrain renderer emits pure drawing commands and consumes
no inputs, time, RNG or device state.

## Verification and next milestone

Run `npm run verify:mountain-terrain`. Missing originals or incorrect hashes fail
setup. It checks exact table identities and all 75 variant/scroll positions
against an independently constructed pixel image from the original decoded
assets. Required negative controls alter a background crop and introduce an
invalid frame. Invalid contracts and an unexpected case count fail.

This is a static asset/translation check. It has no runtime scenario, injected
memory, fitted timers, replay inputs, expected runtime checkpoints or screenshot
alignment rule. It does not establish runtime state, timing or browser parity.

Next: translate the action state machine and hazard updates, then connect
guide → mountain → meaningful movement/action → result → campaign return.
Capture an original mountain entry and a short independent input schedule after
the implementation can exercise the same route. Keep the shared emulator under
one owner and revalidate bytes/addresses at the mountain entry first.
