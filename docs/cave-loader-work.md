# Original cave transition loading work

The original first Right passage in Carlsbad spends84 resident driver counts
inside the sprite10 loader call. This is about1153.152ms at the supported timer
rate. Unknown counter phase brackets this conditional call by83..85 periods,
1139.424..1166.880ms. No observed time becomes a port scheduling input and no
fixed delay is added.

[Manifest](../reference/cave-loader-native.json) pins225 artifacts from
`.local/cave-loader-native-01`,capture source2709589. The natural fresh original
setup is the same read-only Carlsbad/nonracing flight route as the uninterrupted
[cave observation](cave-native-cadence.md). The authored Right+Space make at0 and
both breaks at10 rendered intervals are all consumed before completion. The
private portable emulator uses normal core3000 cycles/ms,svga_s3,16MiB and
vmem_delay off. It closes with return0;HOME and the shared emulator are unchanged.

This experiment stops before the original call at overlay0fc5 and after it at
0fca. Stack arguments independently identify resource10,destination54fc. The
room is already46,the entry flag1,and torch1. The actual302 caller bytes and585
resident loader bytes match the original executable after source relocations.
The original executable and all22 assets,source archive,actual engine binary and
configuration are pinned. This is a debugger-bounded routine measurement,not an
uninterrupted timing replay or machine checkpoint. Debugger stops discard CPU
budget,and the delta includes original interrupts,DOS I/O,allocation and decoding.

Sprite10 is136×112 with4 horizontal frames,8585 packed bytes and30464 decoded
bytes. Its native descriptor has17 bytes/frame row,68 bytes/all-frame row and7616
bytes/plane. The actual38080-byte allocation matches all four independently
converted color planes and the shared opacity plane exactly. Transparency is
the first decoded pixel,as in the original converter;no bytes are excluded.

The returned state records graphics mode204a=1,planar flag2043=1,and resource
compression26e6=0. Resident175c selects the LZW path0efd and emits each decoded
packed pixel byte through10e8. The first converter call selects its mode1 branch
12f0..13cd,not the other display-mode branches. Ghidra `CAVE_CODE.EXE` supplies89
contiguous instructions/222 bytes for this branch;all match original resident
bytes. That disassembly and native output support the conversion rule. This
capture does not independently retain the live LZW/converter code or its
self-modified dispatch word;those paths remain statically inferred from the
original loader/captured mode and exact payload. It does not trace each nested
decoder/allocator/DOS call or prove waveform/IRQ/cycle phase parity.

```sh
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-security.py \
 --cave-page-observer --cave-loader-profile --port 8404 --output .local/cave-loader-native-FRESH
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_loader_profile.py
```

The saved checker fails for missing/corrupt fixtures,zero declared cases,
changed code/payload/clock,input incompletion or an unclosed owned process.
Three negatives reject changed planar output,one altered timer count and a
missing consumed input. The original full cave body,caller/loader bytes,converter
source bytes and complete native sprite are checked independently of port timing.

The browser decodes assets up front and retains their original packed bytes.
Runtime cave `load` now yields for counted decoder/converter work. The measured original work is therefore a concrete omitted
boundary. Next:count the original LZW and mode1 conversion work from the packed
resource and decoded bytes,validate that work against this conditional bracket,
then schedule it at the actual cave load calls. Preserve payload/state ordering;
do not fit a delay to84 counts or build a general CPU emulator.

## Source-counted decoder and graphics conversion

`src/game/sprite-load-work.js` now implements the original prefix/suffix LZW
path and mode1 RAM picture/sprite conversion as pure functions. These functions now supply Cave runtime load budgets. They accept original packed bytes/header
size or decoded sprite pixels;they have no clock/native-output access. Supported
scope is all47 EXP.ARC resources:46 sprites and one picture,LZW,type1/2,four/five RAM planes below64KiB. Other modes,
oversized planes,malformed/unfinished streams and unsupported dictionary paths
stop with diagnostics. Complete loader/system timing remains outside this model.

```sh
node scripts/verify-sprite-load-work.js
```

[Source declaration](../reference/sprite-load-work-source.json) pins294 Ghidra
instructions/780 original bytes:LZW0efd..1070,bit reader1071..10e7,converter
dispatch10e8..112a,and mode1 conversion12f0..13cd. Instructions are checked
contiguously against unpacked original bytes after analysis relocation1000.
The Ghidra text at1075 reverses the operands of8ec0;the verified opcode is
MOV ES,AX,and the model follows that opcode. No decompiled C is recompiled.

The model counts each original code read,clear,literal,special code,prefix link,
width transition,buffer refill,REP residual byte,packed-pixel conversion,opacity
branch and plane write. An independent whole-string dictionary oracle checks
the prefix-chain implementation's work events. Both decoders match the existing
authoritative archive decoder for all46 sprites and the picture. Converter counts are recomputed
from the independent instruction inventory and pixel values. Sprite10 still
matches all38080 original planar bytes exactly;picture0 matches all32000 native color-plane bytes.

For sprite10,the accounted work is904484 LZW instructions plus2476371 converter
instructions,eight REP opcodes/nineteen residual iterations,nine DOS reads and
zero port writes to this RAM destination. At3000 cycles/ms this is1126.955ms.
The source backedge134a repeats LEADI1301 for both packed nibbles;an early draft
missed its second execution. The checker now rejects that exact missing-opcode
count as a negative control. Ten controls now include missing/corrupt packed-byte contracts and reject omitted converter instructions,changed planar output,an incorrect picture opacity plane,an invalid/truncated stream and unsupported geometry.

This accounted subtotal is below the native whole-call phase bracket and is
not admitted as complete loader timing. Archive lookup/header/seek,allocation
and caller bodies,DOS read bodies/budget clamping,IRQ/audio/BIOS execution and
original CPU phase are explicitly omitted. Emulator source `dos.cpp` confirms
that DOS reads can consume/clamp remaining CPU budget and has configurable disk
delay providers;this experiment has not reconstructed their consumption values.
There is no residual delay fitted to make the count reach84 timer periods.
Next:restore initial preparation timing and required environment costs,then
repeat whole-campaign browser acceptance.


Picture0 accounts for1073542 LZW and2376019 converter instructions,or1149.859ms
at3000 cycles/ms. The separate whole-call native measurement is85 driver counts.
That observation remains an output,never a scheduling input. The model is now
integrated into Cave runtime load scheduling. Initial preparation remains
untimed;complete loader/system timing is still open. See [runtime scope](cave-counted-loading.md).
