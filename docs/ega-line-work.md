# Original line drawing work

This work recovers a missing expedition timing cost. The counted model has
moved to `src/game/ega-line-work.js` and is connected to jungle redraws.
[Runtime integration and its separate acceptance](jungle-line-timing.md).
It does not prove that complete game movement speed is correct.
No fixed slowdown or output-fitted delay has been introduced.

Only the22-file executable/resource pairing in `reference/build.json` is used.
The EGA implementation is `IT.DRV` resource1,2,599 bytes, with its full SHA-256 in
`reference/ega-line-work.json`. Ghidra's explicitly selected raw program
`ducktales-ega-driver.bin` contains the real x86 LE16 code. The resident dispatch
is `DUCK_UNPACKED.EXE`140e:00b0..01a0; all241 bytes match the original unpacked
image. All778 driver bytes0515..081e match too. Analysis images are never run.

## Source rules and native evidence

The resident rejects lines whose endpoints both lie beyond the same screen
edge. It dispatches points and axis lines separately. Diagonals choose X-major
on equal deltas. EGA mode requires DS2046=0; alternate scaling and unsupported
coordinate-difference overflow stop explicitly in the analysis adapter.

The primitives are0515(point),0589(diagonal),069b(vertical) and073f(horizontal).
Their far-call words, in BP+6 order, are `[y,x]`,
`[axis,majorStep,minorStep,count,2major,2minor,y,x]`, `[y2,y1,x]` and
`[y,x2,x1]`. RETF pops4/16/6/6 bytes respectively. These callee-pop instructions
are authoritative; a generic decompiler calling-convention label is not.

Vertical end clipping preserves the original inclusive200 boundary, including
its extra row. Horizontal clipping ends at319. Diagonals omit the endpoint and
advance their minor axis only while the signed16-bit error is strictly positive.
All error/coordinate arithmetic wraps deliberately. The vertical-major path
always advances the major step after correcting X; it does not condition that
advance on the minor correction.

The diagonal code patches its own INC/DEC opcode, X/Y step immediates, error
increments and axis branch. Native memory after each call must match all2,599
bytes, including precisely these input-derived modifications and the declared
private surface/color fields. All other code/data must remain unchanged.

The Ghidra byte listing renders8e c1 with reversed register operands at two
sites, while ndisasm and the native path require `MOV ES,CX`. The work model
uses original bytes and observed control flow rather than that operand text.
A focused tool correction would check the bridge's instruction rendering against
Ghidra's decoded instruction after clearing stale listing state; no replacement
disassembler or general emulator is built for this port.

The successful private capture is `.local/ega-line-native-02/`:32 carried private
far calls with independently authored arguments,3,722 exact executed instruction addresses and140 ordered OUT sites.
All32 input arrays are authored independently of expected output. Native01 is a
valid separate trace with different vertical argument order/coverage; Native02
explicitly covers both vertical X rejection paths and upper/lower Y clipping.
Its successful evidence is registered separately and does not overwrite01.

A private65,535-byte allocation holds the original driver, call wrappers and
surface descriptor. CS1e=2000 and CS24=6 are declared providers. The surface
points to private RAM as a nonbranching write stand-in. This verifies control
flow/work, **not EGA pixels/latches or video-memory timing**. IF/DF are clear;
each original instruction is single-stepped individually through the documented
bridge API. No IRQ budget, original clock or final memory chooses an input.
This is conditional function evidence, not a partial restore or full machine
checkpoint. Static offsets map directly to the allocated live segment; entry,
return, SS:SP, mode and original bytes are checked for every call.

The script owns and stops its separate emulator. The shared Deathtrack session
on8386 was untouched. Config/token handling reuses the installed bridge's
InstanceManager/Client without changing global configuration. The exact producer,
engine configuration, allocation, inputs, all traces and Ghidra listings are
pinned by the manifest. Proprietary artifacts remain ignored locally.

## Commands and limits

```sh
node scripts/verify-ega-lines.js
node scripts/inspect-jungle-line-work.js

DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp \
/path/to/dosbox-mcp/.venv/bin/python scripts/capture-ega-lines.py \
  --output=.local/new-ega-lines --port=8396
```

The output directory and private port must be fresh. Missing/corrupt originals,
artifacts or source revisions fail explicitly. Zero/missing cases, changed input,
missing/reordered trace addresses, missing OUTs and unexplained driver changes
fail. Six comparison controls alter static bytes, omit a case, change a trace,
remove an OUT, alter a work count and remove an input count. Invalid coordinates,
unsupported modes and zero-count diagonal paths are also rejected. The work
counter itself is not a CPU emulator and never runs arbitrary executable code.

The read-only jungle inspection reconstructs six retained original drawing
boundaries and consumes every line effect. There are2/2/27/27/1/1 line calls;
primitive work adds1.140/1.116/1.918/1.918/0.073/0.073ms at the declared normal-core
3,000-cycle target. Existing sprite/copy work is27.190..178.254ms in those
samples. These are scoped opcode/I/O estimates, not uninterrupted measurements.
They do not justify a general movement slowdown. The derived report is retained
as `jungleAnalysis`, not used as a replay input or an original timing golden.
Resident dispatch/color changes, text, remaining game/IRQ/device execution and
normal-core I/O slice clamping remain outside these primitive counts.

Next:finish the new closed-loop timer and browser comparisons, preserving all
historical expectations. The earlier complete Easy campaign receipt predates
this runtime timing change and is not current-source acceptance.
