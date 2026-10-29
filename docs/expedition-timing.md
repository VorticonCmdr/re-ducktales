# Expedition movement timing investigation

The user reports fast movement in jungle, mountain, cave and safari. This is an
open fidelity defect. Mountain sprite work and jungle sprite/copy work are now
charged before presentation; other graphics and CPU costs remain incomplete. Per-input movement
regressions and complete port campaigns do not prove real-time pacing.

## First measured mountain discrepancy

The retained original walk in [mountain-movement.json](../reference/mountain-movement.json)
has 15 separately captured input reads. Its relative driver counters are:

```
0, 3, 7, 10, 13, 16, 19, 22, 25, 28, 32, 35, 38, 41, 44
```

Using the independently established driver rate, 1193182/(1365*12), that spans
604.032ms from the first read to the last. Before scheduling integration, the Mountain component,
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
unpaused mountain benchmark. At this initial investigation stage, no timing
conclusion had been established for jungle, cave or safari. The later jungle
work and runtime evidence is described in [jungle-timing.md](jungle-timing.md).

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
clock initially spanned199.755ms. No native timestamp chooses a port input or deadline.
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
execution and graphics I/O consume emulated time, while the initial port treated
drawing as immediate before waiting for the next retrace. The loop has no
ordinary per-frame delay beyond the flip. A fixed tick multiplier would not
represent the observed workload dependence.

These are breakpoint-section observations, not uninterrupted scanout. The timer
resolution is about13.728ms, so individual section charges include timer phase
uncertainty. Aggregates identify the dominant section without assigning exact
per-call costs. Jungle, cave and safari were unmeasured at this mountain
profiling milestone; jungle work has since been measured and integrated.

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
not connected to scheduling at that milestone. The integration below now charges
sprite work; the copy model remains unconnected.

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

The work module also translates the copy primitive01ef..035c for bounded
nonnegative rectangles. It preserves the320-pixel contiguous path and accounts
for REP iteration budgets separately from opcode counts. Fourteen captured
pre-erase states yield the ordinary actor rectangle56x37; its inferred copy work
is0.611ms at3000 cycles. A320x168 restore uses13,440 word iterations and predicts
4.549ms. These are static work calculations; individual copy arguments/times
were not observed. Ten more basic blocks are checked against original bytes,
and a changed REP opcode is a required negative control. Copy work remains unconnected to scheduling; no full timing acceptance is claimed.

Detailed capture02 is excluded because its recorder cleanup used an unsupported
Python client argument. Capture03 failed port preflight before launch; no listener
remained, but recent socket state prevented immediate reuse. Capture04 uses the
separately preflighted owned8388 endpoint and completes with real release3 then
neutral0. No partial capture is accepted and no other session was stopped. The retained
legacy timing-summary text still describes the counted mode and says four
observed boundaries. The profile and raw snapshots independently validate all15
measured reads plus two cleanup reads; producer metadata is corrected for future
runs. Retained artifacts are never rewritten to repair a summary.

## Observation without intermediate execution stops

The completed page-observer scenario, source `49cdb28`, takes80 read-only Lua
memory samples on consecutive emulator render callbacks. An independent fixed
input schedule presses Right at relative render frame0 and releases it at40.
No input is chosen from actor position, page count or expected final state. The
actual relocated mountain overlay and EGA flip, retrace-wait and sprite code are
validated. A fresh owned session has no breakpoints during measurement; stop IDs
advance only once, for the final manual pause after all samples. Both required
source events finish, the physical release is consumed, and all three lives
remain. Original artifacts stay local and unmodified.

This observer records26 page transitions, detected at sample indices3,6,…,78.
The80 samples span79 render intervals and82 resident timer counts, consistent
with70.086Hz within one resident counter phase. Between the first and last
transitions,25 update intervals are bracketed by74–76 display frames: mean
42.234–43.375ms per update in this scene. The previous port instead permitted one
presentation per display frame,14.268ms. This independently supports the pacing
defect without per-update debugger pauses. It is not a native/browser timing
match or proof of the rate of another scene or machine configuration.

The original EGA flip at00e5 changes the page, then calls0064, which polls3da
until vertical retrace ends and the next retrace starts. Thus it does synchronize
to display refresh, but drawing work can consume multiple refresh periods before
that wait. A constant three-retrace sleep would still misrepresent other workloads.

Samples bracket page changes; their actor memory may already belong to the next
update. They are not exact input/CPU or completed-scanout checkpoints. The page
flag is one bit, so a missed pair of flips could alias. The verifier scopes this
risk to the fixed scene: the translated initial hazard draw shapes and minimum
over every sprite pose require at least32.560ms of opcode budget alone, exceeding
two14.268ms sample periods. It checks the original geometry and bounded actor
positions; this static bound is not generalized to another scene. No expected
page timestamp schedules the port.

`npm run verify:mountain-pages` validates all80 samples,26 transition brackets,
complete source/archive/engine identities,22 original files, two input events,
zero intermediate stops and completion. It rejects an omitted sample, changed
page and omitted release. [Manifest](../reference/mountain-pages.json). Both the
evidence command and required timing gate include it. The gate now includes the sprite-work scheduling integration described below.

Observer capture01 is excluded: its Lua load used JSON where the installed
bridge requires raw text and a separate start call. Capture02 correctly rejected
a naturally racing flight during setup. Capture03 completes with the unchanged
nonracing prerequisite; no flag, destination or guest state was overwritten.
Reproduce using the installed bridge Python and site-packages environment:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/site-packages PYTHONDONTWRITEBYTECODE=1 /path/to/bridge/python scripts/capture-security.py --pause-clock-test --mountain-timing --mountain-page-observer --port 8387 --output .local/new-mountain-pages/capture
```

## Commands and outcomes

```sh
npm run verify:expedition-timing-evidence
npm run diagnose:expedition-timing
npm run verify:expedition-timing
```

The first checks the evidence and reports the selected comparison; it is not
whole-original timing acceptance. The strict diagnostic and verification commands fail on a cadence difference
outside the declared native-counter phase tolerance. They now pass the selected
walk, and the one-retrace bypass must fail. The full `npm run verify` requires this check
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
complete jungle verification, measure cave and safari, and connect the original expedition key flags.
Extend the execution-time boundary without changing integer movement, RNG or
music clocks. A constant three-frame delay fitted to this one walk is not an
accepted correction.

## First scheduling integration

Mountain now accumulates the original035d sprite opcode/port work at its actual
source calls, then waits for the corresponding next retrace. It does not charge
the synthetic full-HUD reconstruction used by Canvas: ordinary frames charge
the cash footer, actual hazards, actor and hook; opening and scrolling pages
charge their real HUD sprite calls. `timing.js` provides the explicit3000-cycle
normal-core target and70.086Hz retrace clock independently of host rendering.
No movement integer, RNG rule, input sample or music-clock rate changes.

This is a partial graphics timing boundary: copies, text, lines, asset-loading
and other CPU execution are not yet charged. It is not full original timing
acceptance. The measured14-interval component walk now spans599.264ms, within
one resident counter of the retained/fresh604.032ms benchmark. The read-only
page observer independently brackets the scene's mean update at42.234–43.375ms.
A required isolated process replaces presentation with the old one-retrace path;
the elapsed-cadence checker must reject it. No production source is patched by
the negative control.

Routine/init verifiers now wait for their declared logical boundaries instead
of assuming one retrace per update. Their original input streams and checked
game fields are unchanged. The764-input summit regression preserves all26
checkpoint values,870 presentations and the final gameplay state. Separate
[clock metadata](../reference/mountain-ascent-sprite-work.json) records the new
work budget without editing the historical fixture. That legacy harness advances
driver/retrace together and is not an elapsed-time reference; the dedicated
pacing check uses separate clocks. Browser integration has a separate new contract and independent receipt:
[sprite-timed-mountain-ascent.json](../reference/sprite-timed-mountain-ascent.json).
The exploratory controller follows the unchanged764-byte movement profile and
records104 actual DOM events. A fresh browser independently replays that fixed
event stream from startup: all27 complete states and320x200 picture hashes match,
with870 mountain presentations, three lives and $8,100 on return. Omitting a
required Right event fails at input-480. Twenty-six pictures also match the prior
route; the entry picture changes while the first mountain page waits for work.
Old captures and contracts are preserved.

The source of that exploratory capture is `b02a64c`; its intentional final
EXPLORATORY exception is kept in the raw failed report. The declaration tool
requires exactly that exception after complete-map, all27 checkpoints and104
events, and the unchanged gameplay outcome. It creates a separate pending
contract. Source `3a99961` then passes the independent fixed-event browser replay
and real missing-input negative. The registration tool audits a provisional
receipt with the strict checker before marking it verified; raw files are never
rewritten. Sources, runner/report, events, full states, pictures and negative logs
are pinned in the manifest.

The actual browser control test additionally holds Right for an independently
authored600ms. It requires13–15 movement updates and43–45 driver ticks, verifies
seven ordinary source sprite calls and a three-retrace budget, and continues
through pause/quit handling and natural life loss/reset. It uses the established
pre-application clock barrier and waits for the original destination readiness;
its old100ms-only dialog sequence sent controls during the original wait. An
isolated response override of presentation to one retrace must fail the600ms
movement assertion. This browser negative never changes production files.

```sh
npm run verify:mountain-sprite-timing
```

This focused command runs original build/clock evidence, the timing-bypass
negative, component/init/movement/climb/palette and system-input checks, actual
browser controls and fixed-event replay, both browser negatives, and strict source
receipt/state/picture/event verification. The combined command passed on `ce112a8`, with both browser cases and both
browser negatives completed. All123 unit cases and the production build also
pass on the same runtime. The [integration receipt](../reference/mountain-sprite-timing-integration.json)
pins the source ZIP,runner and log. The separate required shared-runtime check
still fails its historical runtime-file inventory; the broader gate remains
incomplete.


## Jungle sprite/copy scheduling

Jungle already has a minimum three-driver-count deadline, but original drawing
can exceed it. Six unchanged BEFORE/AFTER presentation cases independently
support the sprite/copy work model: about27ms for two dirty-restore cases,
162–178ms for three full redraws, and45ms for the next restoration. These agree
with the quantized original counter brackets, not an uninterrupted input-loop
measurement. Lines, text and remaining CPU/device costs are still omitted.

The runtime observes actual source effects, then waits against elapsed simulation
time before presenting. The scheduler supplies this explicit provider, excluding
hidden-page pauses. It retains driver/retrace phase rather than rounding every
update to an independent fixed retrace count. Catch-up and hidden-page pause
checks pass. A browser deadline bypass must fail the redraw-duration assertion.

The new complete treasure route has independent Game and fixed-event browser
replays of all27 full states/pictures and70 DOM events, with860 movement samples,
907 presentations, $1,050 returned and one life. Required Right removal fails at
input120. The original exploratory exception remains in its raw report; a
separate declaration and fresh passing browser receipt establish acceptance.
`reference/draw-timed-jungle-treasure.json` records the sources and artifacts.

```sh
npm run verify:jungle-draw-timing
```

This is scoped port/browser acceptance. Both older component contracts now
have an explicit [timing migration](jungle-component-timing.md): historical
expectations remain intact, and the current class preserves all1,616 input-boundary
DS states except three independently checked timer words,1,714 ordered image
payloads/modes/wipe tokens and40 gameplay checkpoints. The shared-runtime inventory guard and older
mountain/browser campaign source receipts also need migration. The broader
required gate, arbitrary-route finishability and complete original elapsed-time
parity remain unverified. [Detailed contract](jungle-timing.md).


The combined jungle gate passed on `cc716c1`; its
[integration receipt](../reference/jungle-draw-timing-integration.json) preserves
the exact source archive, complete runner/log and scoped limitations. It includes
127 unit cases and two passing browser cases with no skips, both required
browser negatives, strict route/source verification and the production build.


The explicit component migration and expanded combined jungle gate passed on
`f6d0f05`. Its [receipt](../reference/jungle-component-migration.json) preserves
both historical contracts and separately checks the new timing; all 1,616 source
input-boundary states and 1,714 ordered presentation payloads/modes are covered.
The game/browser runtime is unchanged, and the remaining broader source-receipt
failures are recorded without waivers.
