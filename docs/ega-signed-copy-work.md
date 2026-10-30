# Original signed EGA copy work

`scripts/lib/ega-signed-copy-work.js` counts original `IT.DRV` resource 1,
`01ef..035c`. This translates primitive work, not rasterization or browser timing.
`reference/ega-signed-copy-work.json` pins the supported executable and IT.DRV
container hashes. Resource 1 has 2,599 bytes and SHA-256
`6ee03bd93f3979546d5b5c1511e377685e2aa5401caaf407c3308bca0b812aee`.

## Source rules

`0207` uses unsigned JBE on wrapped 16-bit destination-Y + height. The clipping
subtraction at `020c` feeds signed JG at `0211`, including its overflow flag.
Negative Y is neither rejected nor clamped. Y special cases compare original
unsigned words. X and width use logical SHR by three, without X clipping.

The row path uses DL as its height counter. Zero DL executes 256 rows; other
heights use their low byte. The flat path uses wrapped 16-bit height×20 words and
falls back to row copying if that count is zero. REP visits with zero CX still
count as opcodes while transferring no data. Widths below eight retain row-loop
work without copying bytes.

The model accepts width 1..320, height 1..255 and signed16 coordinates. Other
widths/heights fail explicitly. Rules beyond the 16 native examples are statically
inferred; this is not exhaustive validation of all input words.

The earlier bounded counter in `src/game/ega-work.js` omits `0249 CMP` and
`024c JNZ`, two instructions on every non-early-return path. It remains unchanged
to preserve source-pinned historical/runtime evidence. The new counter includes
both. Historical estimates are not native timing acceptance.

## Reproduction and evidence scope

```sh
node scripts/verify-ega-signed-copies.js
node scripts/verify-mountain-copy-work.js
```

The manifest pins 23 local artifacts in `.local/ega-signed-copy-native-01/`, source
hashes, capture recipe and parent mountain evidence. Missing/corrupt artifacts
fail. Reproduction needs the local DOSBox bridge Python environment and
`DUCKTALES_DOSBOX_MCP_ROOT`. Use the manifest's recipe with a fresh output directory
and unused private port. New output is exploratory until registered; existing
captures are not overwritten.

The experiment executes the original primitive in private real-mode memory with
IF/DF clear and private CS/DS/ES/SS/SP. Original descriptor identities select all
four video/RAM branches. Their far pointers target private RAM: this proves
instruction, OUT and REP work, **not EGA pixels, natural timing or device parity**.
Each case starts independently. No original game or complete machine checkpoint
is restored. The executable is identity checked but not run.

Configuration records emulator binary and bridge-file hashes, protocol, normal
core, exact launch arguments and isolated dummy video/audio environment. Owned
port 8400 closed after capture; shared 8386 was untouched.

All 16 cases complete: 17,791 logical instructions, 90 OUTs, 3,432 REP opcodes and
39,220 REP iterations. Counts match exactly. Every visited IP must be an original
instruction boundary checked against contiguous Ghidra disassembly and original
bytes. The model predicts counts, not a complete instruction-address sequence.
Ordered OUT ports/words and all 2,599 driver bytes match. The active descriptor
word is explicit setup; four self-modified immediate words are computed from
descriptor strides and plane spans, not excluded. Inputs contain no expected
counts or final state.

Single-stepping this engine executes one REP iteration per step. The checker
validates each CX countdown, normalizes each run into one REP opcode and sums
iterations independently. Zero-CX visits execute once. Unfinished or unconsumed
counts fail. Eight negative controls alter a REP count, port word, code byte,
case count, input, empty trace, unsupported IP and unfinished REP sequence.

## Mountain composition

The combined command verifies both original-code experiments, then applies the
new rules to all 191 calls from 34 independently initialized mountain erase cases,
retaining signed/overscan coordinates. All are in the model's width/height domain.
This is derived composition, not a continuous native frame or browser acceptance.

Each of 14 walking cases has six copies: 7,412 instructions, 48 OUTs, 1,392 REP
opcodes and 2,332 iterations. The corrected estimate is **2.816 ms at
cycles=3000**, replacing the earlier 2.812 ms estimate. It is not a fitted slowdown.

Next connect source calls, HUD text/lines and graphics/retrace scheduling to
mountain runtime; then verify natural walking, ascent, browser controls and the
full Easy route. Gameplay and the saved campaign contract are unchanged here.
