# Expedition movement timing investigation

The user reports fast movement in jungle, mountain, cave and safari. This is an
open fidelity defect; no speed adjustment has been accepted. Per-input movement
regressions and complete port campaigns do not prove real-time pacing.

## First measured mountain discrepancy

The retained original walk in [mountain-movement.json](../reference/mountain-movement.json)
has 15 separately captured input reads. Its relative driver counters are:

```
0, 3, 7, 10, 13, 16, 19, 22, 25, 28, 32, 35, 38, 41, 44
```

Using the independently established driver rate, 1193182/(1365*12), that spans
604.032ms from the first read to the last. The current Mountain component,
advanced with the browser's separate 72.844Hz driver and 70.086Hz retrace clocks,
consumes the same 15 joystick values in 199.755ms. Named actor/action/location
and RNG values match every post-update capture. The elapsed cadence differs by
about 3.024×. The original first input is neutral, followed by thirteen Right
samples and a final neutral sample. Expected output never chooses these inputs.

This is conditional evidence: its initial memory/stack comes from the original
entry, and an earlier setup changed the requested destination before travel.
No intermediate state, deadline or timer is injected. Both sequences subtract
only the first input's clock origin. Native timer readings are quantized; the
one-counter comparison tolerance allows that phase uncertainty, not a per-frame
fit. The discrepancy is much larger than the tolerance.

The source explains why this needs investigation. `mountain.js` waits for one
retrace per presentation and represents its drawing work synchronously. The
original has a deadline at life entry, but no additional fixed per-update driver
wait. Original execution/drawing before the page flip takes time. Adding a
three-frame sleep merely because this one case is near 3× is not a faithful
translation of that work. More scene/workload measurements are needed.

## Fresh pause-clock control

A fresh isolated original launch, source `aaf33a9`, used the exact supported
22-file pairing, read-only originals, port8387 and its own process/instance.
The complete relocated office overlay matched before any observation. The
resident timer stayed at733 across a 1026.222ms host pause at the same CPU stop;
all64K DS bytes and CPU registers remained exact. After resuming, the timer
advanced to739. No guest writes, state restore or shared emulator was used.

The engine reports DOSBox0.84.0-vc1(f6d9b), protocol1.14, effective normal core,
3000 configured cycles,16MiB and svga_s3. The retained mountain metadata names
the same version/configuration. It lacks an engine-binary checksum, so the pause
control supports the interpretation of those observations but is not a new
unpaused mountain benchmark. No timing conclusion is yet established for jungle,
cave or safari.

[Investigation manifest](../reference/expedition-timing-investigation.json) pins
original build, retained mountain references, capture recipe revision, fresh
runner, Git ZIP/source hashes, complete pause states, engine/configuration,
startup input and final completion records. Proprietary artifacts remain local.

## Fresh counted mountain capture

Source `899f219` completes a fresh original scenario at 3000 cycles on an owned
instance: natural map controls select **El Capitan at36,61**, a naturally
nonracing flight crashes, and the actual mountain overlay is checked against all
12002 bytes after68 relocations. No target, race, register or memory value is
changed. Initial setup is separate from the measured held-Right interval.

The first and fifteenth read endpoints have driver counters5039 and5083: again
44 counts /604.032ms across14 intervals. The conditional port replay initializes
only from this fresh native ENTRY memory/stack and original assets. Its two
pre-action endpoints match all eight named actor/action/RNG words, while its own
clock still spans199.755ms. No native timestamp chooses a port input or deadline.
Intermediate native AL values are inferred from the held Right key and mode0;
they were not individually captured, so this is not15 full native checkpoints.

An engine-side `ignore_count=13` counts14 subsequent reader hits after a distinct
post-update barrier. The bridge internally stops/resumes ignored hits; this is
not an uninterrupted scanout capture. Its reported host duration begins after
the first-body boundary and is not compared as the14-interval wall-clock time.
The original driver counters are the measured quantity. Both endpoint pictures,
code, complete DS/CPU captures, input setup, completion, source ZIP and runner
are pinned by [mountain-pacing.json](../reference/mountain-pacing.json).

The cleanup also observes an original input quirk: after physical Right release,
the raw key flag becomes64. Mode0 deletes that flag but still returns Right3 once;
the following read is neutral0. The recipe requires both reads and completion of
the real release event. The current expedition browser adapter uses held controls
and releases immediately, so this is a separate input-fidelity gap to address.
The existing ordinary-key reader already represents the delete-then-use rule.

Earlier captures01..06 are excluded:01 stopped at a destination CS alias mismatch;
02 ended at its older observation timeout;03 followed a reused Klondike Mines
flight setup into a cave;04 lost its racing flight and correctly returned to the
map;05/06 reached the mountain but rejected cleanup because they incorrectly
expected immediate neutral after release. Their source archives and raw partial
observations remain local. Only07 has a successful complete runner and required
release/neutral cleanup. No partial run is promoted into acceptance.

Reproduce with the same prerequisites as the pause control:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/site-packages PYTHONDONTWRITEBYTECODE=1 /path/to/bridge/python scripts/capture-security.py --pause-clock-test --mountain-timing --port 8387 --output .local/new-mountain-pacing/capture
```

The crash-to-mountain setup explicitly rejects a naturally racing launch. It
never changes the race flag to force entry. A different startup RNG requires a
new retained scenario; a setup rejection is not movement acceptance.

## Original frame sections

The completed original-only profile at source `ff0554c` observes all15 input
reads and four internal boundaries for each of14 frames. Its exact relocated
mountain code and engine binary are pinned. The run uses the same normal core,
3000 cycles,16MiB and svga_s3 configuration and finishes release3 then neutral0.
No guest memory or register writes, partial restore or fitted timer inputs occur.

| Section | Driver counts across14 frames |
| --- | ---: |
| Movement logic,031c–1320 | 1 |
| Erase previous graphics,1320–132a | 5 |
| Draw new graphics,132a–1436 | 33 |
| Update history,1436–145d | 1 |
| Flip and next input,145d–031c | 4 |
| Total | 44 |

Drawing accounts for33 of44 observed counts. This localizes the missing work;
it does not establish an instruction-cost model or a runtime correction. The
walking path skips the full HUD helper at1744; its draw section includes the
cash footer, money text, hazards and actor graphics. Original normal-core CPU
execution and graphics I/O consume emulated time, while the current port treats
drawing as immediate before waiting for the next retrace. The loop has no
ordinary per-frame delay beyond the flip. A fixed tick multiplier would not
represent the observed workload dependence.

These are breakpoint-section observations, not uninterrupted scanout. The timer
resolution is about13.728ms, so individual section charges include timer phase
uncertainty. Aggregates identify the dominant section without assigning exact
per-call costs. Jungle, cave and safari remain unmeasured.

`npm run verify:mountain-frame-profile` checks all70 internal/next-input captures,
initial input, original code, build, capture/source archive and completion. It
also requires two negative controls: an omitted frame and an altered section
counter must fail. Missing/corrupt local artifacts are setup failures. The
[manifest](../reference/mountain-frame-profile.json) preserves hashes and the
capture recipe; proprietary observations remain ignored local files. This
command verifies evidence only and explicitly reports timingAcceptance:false.

## Detailed work model and debugger limitation

A second completed original profile, source `79ed82f`, uses eight boundaries per
frame, records all15 input reads, and proves that the recorder's cached PIC clock
is unchanged during a150ms host pause with identical CPU/DS. The independent
resident counter checks every PIC sample within one resident period plus one
cached millisecond. The initial cached duration is negative; only differences
are meaningful. Recorder completion requires zero recorded external events and
no truncation. Actual graphics-memory delay is queried and is `off`.

The denser observations change the measured14-frame duration from44 to54 driver
counts. **Debugger stops perturb emulated execution even though host pauses do
not advance the clock.** Accordingly, the earlier3.024× figure describes that
captured breakpoint benchmark, not a precise uninterrupted gameplay ratio. This
also means section totals should not be extrapolated into a fitted global delay.

The read-only emulator source checkout `7ae3dbe` identifies the likely mechanism:
`src/debugger/debugger.cpp` has `DEBUG_EnableDebugger()` clear both `CPU_Cycles`
and `CPU_CycleLeft`. `DEBUG_Resume()` calls `DEBUG_Run(1,false)`, which replaces
the cycle budget. Conditional/ignored hits also traverse the debug callback.
The normal core consumes its budget in `src/cpu/core_normal.cpp`; PIC time uses
the remaining cycle budget. The checkout is not asserted to reproduce the exact
installed binary; the observed stop-density effect is the runtime evidence.
The installed binary SHA is pinned in both profile manifests. No emulator source
or operator configuration has been changed.

A focused tool correction should preserve the unspent CPU/PIC slice across
pause/resume, evaluate ignored/conditional hits without a debug callback, and
expose a bounded read-only address trace with precise PIC time and instruction
count. Verify it using the same known instruction loop with zero, one and many
observation points: elapsed emulated time must remain equal. Keep breakpoint
counts, stop IDs and scheduled keyboard delivery covered. A general emulator or
compiler is not required for this correction. Until then, dense breakpoint
captures are routine/workload evidence, not uninterrupted timing references.

`src/game/ega-work.js` now translates the work of the original sprite primitive
035d..0514 into opcode and port-write counts. It handles alignment, transparency,
left/right/top/bottom clipping and source-frame selection, independently of the
DOM and clock. Its normal-core conversion is explicitly configured by cycles
per millisecond and excludes interrupt work and budget-end I/O clamping. It is
**not connected to browser scheduling yet**. No movement or audio rate changed.

`npm run verify:ega-work` validates original opcode bytes and15 counted basic
blocks, then exercises98 sprite operations across14 native segments. Each
hazard segment starts from its original captured input memory; descriptor/table,
actor and RNG outputs compare exactly. These are conditional routine comparisons,
not a closed-loop replay. The sample includes aligned and shifted sprites,
negative-Y clipping and changing player frames. Other branches are statically
inferred, not independently runtime-validated. Footer work predicts8.694ms versus
8.834ms in the final captured call; five hazard sprites predict21.293ms versus
22.557ms including original hazard logic and debugger overhead. These are
reported residuals, not accepted timing tolerances. The checker enforces opcode
lower bounds only, with one cached millisecond of phase allowance; it does not
claim timing equality. Three controls reject a changed descriptor, invalid frame
and truncated sprite; the profile checker separately rejects omitted/altered
checkpoints. [Detailed manifest](../reference/mountain-draw-work.json).

Detailed capture02 is excluded because its recorder cleanup used an unsupported
Python client argument. Capture03 failed port preflight before launch; no listener
remained, but recent socket state prevented immediate reuse. Capture04 uses the
separately preflighted owned8388 endpoint and completes with real release3 then
neutral0. No partial capture is accepted and no other session was stopped. The retained
legacy timing-summary text still describes the counted mode and says four
observed boundaries. The profile and raw snapshots independently validate all15
measured reads plus two cleanup reads; producer metadata is corrected for future
runs. Retained artifacts are never rewritten to repair a summary.

## Commands and outcomes

```sh
npm run verify:expedition-timing-evidence
npm run diagnose:expedition-timing
npm run verify:expedition-timing
```

The first checks the evidence and reports the mismatch; it is not timing
acceptance. The strict diagnostic and verification commands deliberately exit1 on the
unresolved cadence difference. The full `npm run verify` requires this check
after original-build validation; it cannot silently accept the known fast cadence.
Missing/corrupt inputs or zero cases fail before a timing result. Two checker
controls reject an altered native timer sample and an omitted sample. Original
fixtures are never modified. The complete12002-byte/68-relocation mountain
code is revalidated against the original executable, avoiding Ghidra's known
invalid entry decompilation and segment aliases.

Reproduce the pause control from a clean committed source using the installed
bridge's Python environment and its site-packages path:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/site-packages PYTHONDONTWRITEBYTECODE=1 /path/to/bridge/python scripts/capture-security.py --pause-clock-test --port 8387 --output .local/new-pause-control/capture
```

The recipe refuses the unrelated8386 endpoint, preflights its own port, verifies
process/instance identity on every state and stops only its own process. Its
normal security segment still completes after the pause experiment.

Next: distinguish original per-frame execution/drawing cost across workloads,
measure jungle, cave and safari, and connect the original expedition key flags.
Implement the execution-time boundary without changing integer movement, RNG or
music clocks. A constant three-frame delay fitted to this one walk is not an
accepted correction.
