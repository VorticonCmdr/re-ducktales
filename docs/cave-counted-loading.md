# Counted cave resource loading

The cave now schedules resident LZW decoding and mode1 RAM conversion work at
its runtime sprite loads,torch changes,room background loads,and pit/distance/
trap overlay loads during actual room composition. Original packed bytes are
copied from archive payloads alongside decoded assets;there is no recompression
or timing inferred from an expected outcome. Missing packed bytes,wrong lengths,
unsupported graphics or decoded-payload mismatch stop with diagnostics.

`graphicsLoadWork()` uses the source-counted decoder/converter and the existing
normal-core3000-cycle provider. All47 EXP resources pass independent dictionary/
instruction-inventory checks. Native sprite10 and picture0 plane payloads remain
exact. Ten negatives include missing packed bytes,length mismatch and altered
decoded data. These budgets are partial original work,not full loader timing.

Runtime `load()` initializes the sprite descriptor before its decode wait and
assigns caller coordinates after completion. Source175c..19a4 initializes the
frame/X/Y fields at18ec/18f0/18f4 before decoder call194f. Room picture0 loads at
Main0595 after the room wipe. Composition26bb loads pit2,distance9/8/7 and trap1
only on the original branches;normal input restores the cache without reloading.
[Boundary proof](../reference/cave-load-boundaries.json) checks1075 original bytes
and396 instructions with two negatives. Its composition range begins after the
analysis-only patched stack-probe prologue;all included bytes match exactly.

The conditional Carlsbad comparison now carries four phase states with all nine
fields exact:initial input,room commit,torch advance and entry-flag clear. Its
two consumed reads and four independently authored physical events are required.
Three negatives alter a state,drop a checkpoint and drop an input. The event
serialization comparison allows1e-9ms solely for subtracting the absolute input
origin;game-state fields are exact and native checkpoint times have no tolerance.

**Original timing still fails.** Torch advance is2782.296ms versus the native
2796.564..2810.832ms bracket. Entry clear is5379.106ms versus5421.910..5436.178ms.
Cash remains0 through the retained6834ms window,but final animation/RNG fields
still differ. These times are comparison outputs,never delay inputs. The strict
probe continues to exit1;the phase-state-only check is conditional component
evidence,not timing or final-checkpoint acceptance.

Initial `prepareCave()` loads remain synchronous and untimed. Archive lookup,
headers,seeks,allocation/caller code,DOS read execution/I/O budget clamping,
optional disk-speed delays and IRQ/BIOS/audio execution/phase remain outside the
subtotal. Initialization mutation ordering also needs restoration before any
whole-entry timing claim. No fitted residual or global slowdown is added.

Focused checks currently pass218 units,original entry/runtime checkpoints,four
passage directions/revisit and shortened outcome replays. The actual browser
case02 passes48.7s and observes picture0 and passage10 load waits while exercising
startup,controls,room rewards,pause,key flushing,rendering and Restart. It runs
with its declared clock/input providers;it is not native cadence acceptance.

The reproducible combined command below pins a clean source archive,records
each log/check result,and fails on incomplete required checks. Its browser
negative bypasses only loading waits while retaining their counters;the browser
must reject that at the actual resource-loading boundary.

```sh
node scripts/verify-cave-counted-loading.js --output=.local/cave-counted-loading-FRESH
# Deliberate exploratory native timing failure:
node scripts/probe-cave-native-cadence.js
```

This admission does not replace a fresh whole-campaign replay. Next:restore
initial preparation load boundaries,then account for the next demonstrated
loader/system omission and compare the first remaining divergence.


The source-pinned combined admission01 now passes all nine required checks at
commit dd518f92d5787dcc9d20a2a1e8f4b2e718d92f38. Its [receipt](../reference/cave-counted-loading-admission.json)
pins the source archive,complete runtime inventory,logs and acceptance status.
The final combined browser positive and loading-only negative both pass their
declared outcomes. All required unit cases execute with zero skips. Original
whole-cave timing and the final native animation checkpoint remain failures.
