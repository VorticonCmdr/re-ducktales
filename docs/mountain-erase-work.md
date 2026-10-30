# Mountain background restoration

The original mountain erase path is translated in
`scripts/lib/mountain-erase.js`. **This record establishes routine evidence, not
complete original speed.** The subsequent
[runtime integration](mountain-copy-runtime.md) uses this planner and the signed
primitive model. Hard campaigns remain deferred.

## Identity and source

Only the supported `reference/build.json` pairing applies. `DUCKTALE.EXE` SHA-256
is `fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Overlay 5 begins at file offset `0x17600`: 12,514 bytes with a 512-byte MZ header.
Its 12,002-byte body SHA-256 is
`b50591460d43e848d52b49ee7b843065413d877dca8dc75455ce7dca2a7f2bd0`.
It is x86 16-bit real-mode code, loaded at unpacked-image offset `0xc170`.
The combined Ghidra image maps this to `1c17:0000`; the secondary CS alias starts
at body offset `0x1890`.

The translated dispatcher is body `156a`, actor restore `15c5`, and hazard/cloud/
rock restore `282a..2d08`. Six checked source ranges also retain the drawing/HUD
callers at `1320..1435` and `1744..189d`. They contain 2,097 contiguous bytes with
exact original instruction bytes. Embedded jump tables at `2a30..2a43` and
`2b80..2b8b` are checked separately, not disassembled as instructions.

The old combined Ghidra listing has an overlapping instruction at `288f`,
omitting original byte `288e` (`f7 e9`, IMUL CX). Its apparent JMP and resulting
decompiled flow are unsuitable evidence. Clean raw imports of the exact body,
split around both tables, supply the accepted listing. No analysis executable
was run or original file changed.

## Rules retained

- Forced/old-action page restoration copies the whole 320×168 viewport and wraps
  the signed restoration counter exactly.
- Actor restoration uses the previous page's position and pose, including the
  128×128 wide-pose path, original asymmetric clipping and signed coordinates.
- Five visible hazard rows retain distinct restoration sizes, facing/state
  branches and pickup state changes.
- Cloud states 0, 1, 2, 4 and 5 retain their extra copies. State 3/invalid states
  fail explicitly: original width/height locals are uninitialized on those paths.
  Inspected transitions do not produce 3; universal reachability is unproven.
- Inactive rock restoration deliberately reuses the cloud's coordinates. Rock
  movement, fixed bottom edge copies, top/bottom clipping and right-edge X=287
  behavior remain distinct.

## Repeatable conditional experiment

`reference/mountain-erase-work.json` pins 61 local artifacts, source hashes,
capture recipe, original identities, input patches, exclusions and this command:

```sh
node scripts/verify-mountain-erase.js
```

The fresh capture is `.local/mountain-erase-native-02/`. It records emulator binary
and bridge-file hashes, launch arguments, protocol 1.14, normal CPU core, dummy
video/audio and isolated configuration. Its private port was 8399; the owned
instance stopped in `finally`. Shared port 8386 was untouched. The preceding
capture remains preserved in `.local/mountain-erase-native-01/`.

Reproduction needs the pinned original files and prior BEFORE-state artifacts
from `reference/mountain-draw-work.json`. Set `DUCKTALES_DOSBOX_MCP_ROOT` to the
local bridge checkout and use its Python environment to run
`scripts/capture-mountain-erase.py --output .local/mountain-erase-native-NEW --port 8399`.
Use a fresh output directory and unused private port. A new capture is exploratory
until its independent artifacts are registered and verified; it does not replace
existing evidence automatically.

The recipe loads original unpacked resident bytes and the mountain body into
private conventional memory, applies original resident and 68 overlay
relocations, and calls the original routine with private DS=SS and stack.
IF/DF are cleared and the stack threshold is explicitly zero. It supplies 14
captured walking BEFORE states and 20 separately declared synthetic variations.
No expected final value selects an input.

**The graphics vector is an explicit register-preserving, callee-pop RETF16
observer.** The original copy primitive is not executed. Every ordered eight-word
copy argument is observed at this boundary. Each case starts independently;
this is neither a complete machine checkpoint nor a continuous game replay.

All 34 cases complete with 191 exact copy calls. Each case checks all 61,522
relocated code bytes and DS `0000..fffe` except 64 declared private stack-scratch
bytes `feb0..feef`: 65,471 compared bytes. Byte `ffff` is not read; this routine
does not address it. Required cases, instruction traces, supported instruction
ranges, copy observations and returns are strict. Eight failure controls detect
bad listing coverage, copy coordinates, DS, code, case count, input, empty trace
and unsupported trace. Cloud 3 also has an explicit domain rejection.

Separately, named game-state ranges match 14 original BEFORE→AFTER frame
segments with the real graphics vector. This compares hazard records, cloud/rock,
restoration counter, previous actions/page, RNG, money and day. It excludes IRQ
clocks, stack, EGA pixels and elapsed time; dense breakpoint traces are not natural
cadence measurements.

## Work estimate and next integration

Each retained walking frame has six source copies. The existing bounded EGA
copy model counts 7,400 instructions, 48 OUTs, 1,392 REP opcodes and 2,332 REP
iterations: **2.812 ms at cycles=3000**. This is derived primitive work, not a
measured original frame duration. Work-only X coordinates are normalized to zero
because that primitive has no X-dependent control flow; original call arguments
remain compared unchanged. Synthetic signed/overscan rectangles are preserved as
arguments, but are outside that bounded cost model.

The [new native primitive comparison](ega-signed-copy-work.md) now covers signed
coordinates and identifies two omitted instructions per copy in that older
counter. Its composed command covers all 191 calls with actual coordinates; the
corrected walking-copy estimate is 2.816 ms. The original receipt above remains
preserved, not rewritten as stronger evidence.

Runtime now connects these erase copies. Next connect
HUD text/lines to mountain scheduling, and correct graphics-deadline/retrace
phase. Recheck natural walking, ascent, actual browser controls and the full Easy
campaign. Avoid charging reconstructed Canvas terrain as source drawing.

Focused Ghidra MCP improvement proposed: disassembly results should expose actual
covered byte ranges, gaps, overlaps and end overrun. A successful request and
requested byte count currently do not establish contiguous decoding. The local
checker enforces these properties independently.
