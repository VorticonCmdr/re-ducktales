# Mountain drawing deadlines and display phase

Mountain now waits until its counted drawing work completes at an absolute
simulation time, then waits for the next display-start event. It no longer
releases input after a separately rounded number of retraces. The legacy
`spriteWork.retraces` and `drawingWork.retraces` fields describe rounded budgets
only; `drawingWork.startedAt/until` identify the actual scheduled work boundary.

## Source and retained observation

`reference/mountain-phase.json` pins three original disassembly artifacts, one
retained original DS snapshot, parent manifests and verification source hashes.
The executable/body/driver hashes identify the supported22-file build. All code
ranges match original bytes contiguously:

- Overlay `1436..1569`: page histories update, then `145d` calls vector `1fd4`.
- EGA `00e5..0100`: BIOS active-page change, page flag/address toggle, call0064.
- EGA `0064..0071`: poll3da bit8 until clear, then until set, then return.

The retained mountain BEFORE-state has `1fd4 = 2ed8:00e5`. The existing original
page-observer verifier separately checks live relocated overlay/driver bytes and
all80 fixed-input samples without intermediate execution stops. These are
preserved observations, not a newly run emulator or precise scanout timestamps.
Ghidra results are checked by actual instruction ranges; irrelevant surrounding
instructions and requested-byte summaries are not treated as coverage proof.

## Runtime boundary

`Mountain` accepts an injected monotonic millisecond clock and exposes a graphics
deadline through its existing wait interface. `Game.nextSimulationWake()` and
`advanceSimulationWake()` now route mountain to the existing Scheduler. The
Scheduler reaches that deadline even between driver/retrace events and preserves
the current display phase. No new wall-clock timer or background process is used.

Direct component callers retain an explicit zero-phase clock derived from their
independently advanced driver/retrace counters. Their coarse clock events may
observe work that finished earlier and use the current display edge. A completion
exactly on the edge instead waits for the following edge:0064 first waits out an
already-active retrace. An explicit graphics wake finishes work without publishing
or consuming a display event. Invalid/backwards clocks, rebasing active deadlines
and early/unsupported wakes fail with diagnostics.

The driver-first Scheduler tie order remains unchanged. Hidden-page scheduler
pauses exclude elapsed time; the game's own Pause overlay continues its original
driver/retrace clocks while withholding action updates. Existing browser checks
exercise Pause, cancelled Quit, held-key release, life-reset flush and Restart.

The renderer still publishes its discrete completed presentation at the wait's
end. Actual00e5 changes the video page before calling0064; this is not proof of
matching partial scanout. BIOS/page-flip execution, finite hardware pulse details,
resident/color/caller/device work and opening/scroll composition copies remain
outside the accounted primitive work. No fitted slowdown or native clock value
is used as an input.

## Verification

```sh
node scripts/verify-mountain-phase.js
node scripts/verify-mountain-phase-integration.js
node scripts/verify-mountain-phase-receipt.js
```

The clean combined gate passed for `5eca408`. Its
[saved record](../reference/mountain-phase-runtime.json) pins735 current source
hashes and five immutable local artifacts: source archive, inventory, log,
completed result and runner status. The receipt command validates that saved
result; the integration command repeats actual browser acceptance.

The phase verifier requires the original page evidence and six executable tests:
off-phase starts0/7ms; batch-versus-one-millisecond catch-up with fixed controls;
early/coincident-edge handling; invalid clocks; actual Game→Scheduler routing;
and rejection of the previous rounded scheduling policy. The fixed input schedule
uses150/350/420ms over500ms. All consumed events, game state and rendered pixels
match exactly between batch/chunk runs. No expected state selects an input.
The early/coincident and Game-routing probes deliberately query the component's
declared drawing boundary: they are conditional API checks, not independent
native timing replays. Published snapshots/pixels and final DS are compared for
the independent batch/chunk scenario.

At the declared7ms start, the counted opening work ends48.994333ms. The42.804555ms
display edge is too early; the first later edge is57.072740ms. A zero-phase start
can use the earlier edge. These are model/scheduler contract values, not measured
native frame durations. Two static controls reject altered/missing instructions.

The combined gate requires clean committed source, exact native HUD/copy/line/
formatter checks, the complete764-input/26-checkpoint/870-presentation ascent,
all186 unit cases, one actual browser route, four targeted browser omissions
(copies, HUD lines, HUD numbers, graphics deadline), and a production build.
It saves source archive/inventory, log, result and runner status in a fresh ignored
directory and rejects edits during the run. Missing local evidence, skipped cases,
unsupported behavior and failures outside the intended omissions stop acceptance.

The subsequent [whole Easy campaign](mountain-phase-campaign.md) now completes
independent headless/browser replay and clean combined acceptance with this
runtime. The old text-inclusive Easy and copy/HUD receipts remain historical.
This phase milestone does not establish arbitrary-route finishability, native
whole-level timing or whole-game completion. Hard campaigns remain deferred.
