# Office investment departure

The port connects real Left+Fire or the Investments button to the original
office animation,then trading,office return and Restart. Office entry/reveal
and selection are also connected. The complete d34d194 gate passes117 unit,91
development and2 production-browser cases,zero skips;the receipt is separate
from this focused evidence. See [current status](STATUS.md) for unfinished work.

## Rules and original evidence

Only the22-file pairing in `reference/build.json` is supported. The original
DUCKTALE.EXE SHA-256 is
fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981.
Ghidra `OFFICE_MAP.EXE` uses x86 LE16 Real Mode and contains original overlay2,
not just a loader. Fresh capture verifies all8368 original overlay bytes after
180 relocations, and independently establishes live CS/DS/SS.

Overlay2:0561 loads MAIN19 at9,16 and draws MAIN5 at33,48 on top. After an initial
flip, sound3 begins when enabled. The ordinary MAIN5 draw is suppressed while
explicit frames0,1,2,3 each flip and wait14 driver counts. Frame3 is drawn,
flipped and held14 counts again; a final extra flip precedes cleanup. This is
seven logical flips and70 explicit driver counts. Common06bf clears the input
queue/key table; the overlay returns39. The simulation keeps driver and retrace
advancement separate and does not consume randomness in this transition.

`reference/office-investments.json` pins26 local artifacts, the recipe and its
Git producer84f8ae7. The original scenario uses fixed hardware Left+Space,
releases those keys after the first flip, holds P during the uninterruptible
animation, and observes all128 key-table bytes cleared at exit. Return39 and
unchanged RNG are observed; there is no memory injection or partial restore.
The owned emulator process was confirmed absent after capture.

The initial capture01 exposed the raw screenshot surface's one-flip delay.
At05cb its picture exactly matches the previous selected office; subsequent
immediate post-flip pictures exactly match the preceding pose. Capture02 is a
fresh launch that stops after the original14-count waits at0635, and before the
last flip at067a. Every current-pose picture then matches exactly. Both captures
remain local and unchanged. This is a declared capture alignment, not a pixel
tolerance. The initial two newly composed pages are pixel-identical and both
match the first waited pose; initial.png explicitly tests the old selected page.

## Verification scope

The core verifier checks seven original pictures, every represented sprite
position/frame, source wait/loop/return/flush instructions, seven logical flips,
70 driver counts, sound enable/disable, held-key clearing and no RNG consumption.
It rejects altered code/pixels and missing/zero cases. Separate setup controls
remove/corrupt a required PNG, restore its original bytes and require a positive
rerun. Missing local artifacts are setup failures.

Pinned browser receipts retain131 exact runtime/test sources, all individual
results and six actual canvas pictures. The checker rejects skipped, failed,
flaky and missing-case reports independently of the native pixel controls.

Five focused browser cases pass: two existing trading routes, two existing
money-bin office routes, and the new departure/flush/Tandy/return/restart route.
The latter compares all six observable office presentation states byte-for-byte
with original320x200 pictures. The seventh logical flip repeats the final picture
and hands off to investments in the same simulation boundary; the component
checks that flip rather than claiming a separate browser observation. Queued P
and held Left/Fire must not operate the portfolio after the common exit flush.
Tandy receives0,3 and produces nonzero samples. Omitting real Left fails at the
required departure entry. All117 unit cases also pass.

These are original segment comparisons and browser acceptance. They do not
establish original whole-office/whole-campaign CPU, IRQ, file-loading or audio
waveform timing parity. Rendering uses original assets; no generated expected
picture is substituted for a native fixture.

```
npm run verify:office-investment-core
npm run verify:office-investments
```

To reproduce, use the installed DOSBox MCP Python environment with
`DUCKTALES_DOSBOX_MCP_ROOT` pointing to the directory containing `dosbox_mcp`:

```
python scripts/capture-office-investments.py --output .local/office-investment-new --port 8387
```

The output directory must be new and ignored. The recipe preflights an isolated
port, mounts the exact original folder read-only, uses one session owner, batches
CPU/memory reads, waits on current stop IDs and stops its own process in finally.
It never attaches to8386 or changes shared bridge settings. Configuration and
input schedules are retained with checksums in the local capture.
