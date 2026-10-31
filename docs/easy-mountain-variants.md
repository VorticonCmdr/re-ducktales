# Current Easy alternate mountain routes

Scope: current port browser routes for Thunderclap Mountain (variant1) and Machu
Picchu (variant2), independently replayed from startup. Hard campaigns remain
deferred. Existing original terrain/action/hazard evidence remains separate;
these routes do not claim native whole-level cadence or arbitrary-path parity.

Both routes were explored with actual browser controls before this harness was
authored. Thunderclap uses the existing 494 authored controls. Machu Picchu uses
its existing 706 controls plus four neutral inputs after input402 (710 total).
The inputs originate in the versioned `*-expedition-inputs.json` recipes; expected
snapshots never choose replay controls. A physical-key flight policy explores the
capture's route; strict replay uses only the independently recorded DOM stream.

Accepted from clean source `72c5d5d`:46/64 full state/pixel checkpoints and440/542
DOM events, both missing-movement controls and both Restarts. The producer is
`.local/easy-mountain-variants-02`; independent consumers are in
`.local/easy-mountain-variants-replay-02`. The first capture's checker incorrectly
required DOM events to outnumber game reads; that run remains unaccepted. Held
keys can span many reads. The corrected contract checks both counts separately.

## Why Easy Machu needs a different player route

The historical Hard controls work through row13/input400 on Easy but are hit by a
projectile at input429 in a conditional fresh-memory diagnostic. Easy uses a
24-update projectile counter; Hard uses8. The supported executable's overlay5
body1927..1941, Ghidra `MOUNTAIN_CODE.EXE` `1da0:0097`, was checked against original
bytes and disassembly: signed-extend difficulty, subtract2, negate, shift left3,
add8, store the word counter. This supports `((2-difficulty)<<3)+8` in
`src/game/mountain-hazards.js`. Ghidra's full helper decompilation has overlapping
flow and is unreliable; the bounded original instruction sequence is the evidence.

The [preserved investigation](../reference/easy-mountain-investigation.json)
can be checked with `node scripts/verify-easy-mountain-investigation.js`.
It validates ten local artifacts and the bounded27 original/Ghidra bytes without
promoting exploratory observations to native or independent-browser acceptance.

A conditional component search used the observed browser-entry seed44031 with
fresh zero-phase memory to plan the neutral wait. That exploratory dependency is
not independent campaign evidence. Actual browser exploration subsequently carries
its own memory/RNG from startup, reaches the summit with all three lives, receives
$2,700 and restarts. No seed, hazard, actor, timer or memory is patched. Four neutral
player inputs change the route; no timer provider is fitted to an expected result.
The production mechanics are unchanged.

## Verification contract

Capture and independent consumers use original assets, Easy, explicit BIOS0,
audio disabled, UTC, monotonic origin1 and8ms browser display callbacks. A source
archive, complete source inventory and capture inventory pin the exact loaded
code and fixtures. Vite/browser instances are owned and closed in finally blocks;
no shared server or emulator is changed.

Full state and pixel digests compare at office, departure, mountain entry, every
control-packet boundary and every40 inputs, award and collected destination on
the map. The routes must consume exactly494/710 mountain inputs, retain three
lives and award $2,100/$2,700 respectively. Restart independently clears actors,
cash and collection flags. Missing/corrupt fixtures, skipped required checkpoints,
unconsumed events, diagnostics, page errors and unfinished sequences fail.

Each negative consumer omits the first mountain Left. It replays startup normally
but starts comparisons at entry, and must fail specifically at input3. This
negative-only expectation prefix is explicit; positive acceptance checks all
startup and expedition checkpoints without exclusions. Output JSON remains
separate from the timestamped DOM inputs. PNGs are optional illustrations; exact
pixel digests in the required JSON are authoritative for regression.

```
node scripts/easy-mountain-variants.js verify
```

Missing local fixtures are setup failures. For a new record from clean committed
sources, use fresh ignored directories and a new manifest name:

```
node scripts/easy-mountain-variants.js capture --output=.local/easy-mountains-fresh
node scripts/easy-mountain-variants.js verify --capture=.local/easy-mountains-fresh --output=.local/easy-mountains-fresh-replay
node scripts/easy-mountain-variants.js register --capture=.local/easy-mountains-fresh --replay=.local/easy-mountains-fresh-replay --manifest=reference/easy-mountain-variants.json
```

Capture deliberately exits1 after successful exploratory output; it is not
acceptance. Verification must exit0. Registration refuses overwrite and requires
both positive consumers, both targeted negatives, source identity and unchanged
capture artifacts. Originals, screenshots and traces remain local.
