# Original transparent text work

This records the original transparent text work investigation. Its frozen
analysis counter remains evidence; the runtime now includes formatter and text
work in jungle redraw deadlines. [Current integration](jungle-text-timing.md).
Hard campaign work remains deferred.

The supported 22-file build is unchanged. `IT.DRV` resource 1's vector at byte
001a selects 081f for the transparent text API (resident pointer DS2008).
Ghidra program `ducktales-ega-driver.bin`, x86 LE16 real mode, supplies the
081f..0908 instruction path. `DUCK_UNPACKED.EXE`11c4:0227..02a6 supplies the
numeric formatter; its complete 128 bytes match the unpacked original after
applying the executable's own EXEPACK relocation stream at load bias1000.
The analysis program is not executed. Asset hashes and exact instruction
artifacts are pinned in [the static manifest](../reference/ega-text-static.json).

Original jungle HUD 1e4c:0144 calls the numeric formatter twice, using MAIN42's
original 8x8 font. The formatter calls DS2008 with callee-pop arguments, in BP+6
order: color, y, x, text offset, font offset, font segment. RETF pops12 bytes.
It constructs digits using resident long remainder/division helpers and applies
right alignment to money. Those formatter/helper costs were recovered separately and are now counted in
the runtime. [Formatter evidence](hud-number-work.md).

The transparent driver consumes a NUL-terminated byte string. It configures EGA
registers even for an empty string. Aligned glyphs issue one mask OUT per row;
unaligned glyphs issue two, including zero masks. Glyph height zero means256
rows because CH decrements after drawing. X advances with 16-bit wrap. The first
glyph includes the surface offset when calculating alignment; later glyphs reset
DI from the updated X argument, dropping that initial offset. The counter keeps
that quirk. No clipping is invented. Unicode outside the original byte range and
invalid provider values fail explicitly. Ghidra's operand rendering for raw
8ec3 at083f is reversed; raw bytes require MOV ES,BX. The counter uses validated
instruction addresses, not the misleading operand string.

## Native experiment and strict command

```sh
node scripts/inspect-jungle-text-work.js
node scripts/verify-ega-text.js
```

The first command validates original bytes,242 static control-flow cases and
three comparator failure controls. It reconstructs six preserved original jungle
BEFORE states, consuming all four HUD text calls. In each of the two HUD redraws,
`44` at159,180 and `24` at14,185 add642 driver instructions and72 OUTs, or0.262ms
under the existing declared cycles3000 cost model. That estimate excludes the
formatter and does not establish whole-game speed.

The native verifier requires two independently launched private captures,
`.local/ega-text-native-04` and `-05`, with14 carried calls each. Each capture
matches2,963 executed addresses,312 port/value writes and all2,599 driver bytes.
Cases cover all eight alignments, empty input, both actual HUD numbers, a nonzero
surface offset, back-page selection and embedded NUL. Five negative controls
reject an altered address, port word, input, missing case and modified driver.
The [native manifest](../reference/ega-text-native.json) pins38 local artifacts.
Missing artifacts fail as setup errors; zero/unfinished/skipped cases cannot pass.

To repeat, use the existing DOSBox MCP package and a fresh local directory:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp \
/path/to/dosbox-mcp/.venv/bin/python scripts/capture-ega-text.py \
  --output=.local/new-ega-text --port=8397
```

The recipe refuses the shared8386 port and an existing output directory, checks
that its private port is unused, creates its own emulator, pauses real mode,
allocates one owned64KB block and copies the unmodified original driver/font.
A private wrapper clears IF/DF and calls081f with independently authored inputs.
Single stepping records each instruction and every OUT's DX/AX. Each call returns
to the wrapper with the original stack pointer. The recipe closes its owned
instance in `finally`; neither successful instance is left running. The shared
8386 session is untouched.

The RAM surface uses a separate segment within that allocation. Its zero offset
is necessary: the text driver shifts the initial surface offset with X and drops
it after the first glyph. Private capture01 used the earlier line experiment's
byte-offset surface layout; its writes touched the driver and the all-byte check
rejected it. Capture02 stopped on a stack precondition before producing a complete
record; its cause is unknown and it is not evidence. Capture03 failed the port
availability precondition without launching; no listener remained. These failed
folders are preserved. Captures04/05 independently pass the corrected recipe.

This is conditional native instruction/port evidence with a RAM write stand-in,
not original screen pixels, natural IRQ/scanout timing, a complete checkpoint,
or an original whole-game run. No partial machine state is restored. Only the
private caller arguments, code/data allocation and IF/DF preconditions are set;
subsequent calls carry their state. The combined formatter/text work now passes the separate component and browser
gate linked above; this native fixture alone does not establish that acceptance. Opaque text0909 is a separate path.
