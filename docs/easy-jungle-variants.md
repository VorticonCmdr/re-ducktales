# Current Easy alternate jungle routes

This scenario covers current Easy Bermuda (variant1) and Boola Boola (variant2)
through startup, security, travel/flight, treasure, collected destination on the
map and Restart. Hard campaigns remain deferred. Gameplay source is unchanged.
This is port browser regression, not a native whole-level/cadence comparison.

Both routes were explored using actual browser keyboard/pointer controls before
recording their acceptance cases. Boola Boola uses the existing421 controls and
returns $1,350 with all three lives. Bermuda's older447-control Hard plan falls
at the crossing with this Easy campaign's carried state. The revised503-control
plan retains three lives and returns $2,200. It changes only three player packets:

- First neutral wait20→32 inputs at the bird crossing.
- Next neutral wait6→38 inputs before attempting the vine.
- Up28→40 inputs to stay on the vine longer before releasing.

`reference/security-hard-expedition-inputs.json` supplies the independent authored
controls. The new helper validates its input-byte digest before applying the
explicit packet changes; no expected state chooses a control. Startup-to-entry
DOM events from the first Bermuda browser attempt were replayed headlessly with
an exact complete state/image match. Every candidate then carried that Game state
from startup; no memory restore, initialized expected state, RNG patch or timer
injection supplied the result. The candidate search is exploratory. Subsequent
actual-browser completion and independent DOM replay establish separate levels
of evidence. Existing original bird/platform/vine translation comparisons remain
scoped to their original captures; no new native observation is claimed here.

Capture uses a player flight policy and the fixed authored expedition controls.
Independent consumers use only timestamped DOM input, with exact full-state/pixel
checks at office, departure, entry, every packet boundary, every40 inputs, award
and map. The first movement is also a mandatory checkpoint. They require exactly
503/421 game reads, all three lives, the proper cash/ownership/day consequences,
and Restart clearing actors, cash and claims. DOM event counts are independent of
game reads because held keys can span many reads.

Each negative replay omits the first jungle Right and must fail at its first
movement checkpoint (Bermuda input4; Boola Boola input2). The initial entry make is discarded by Main00d7's flush before input1; that
flush is retained. Negative-only comparison starts at the input immediately
before the consumed movement, while replaying the complete startup input stream. Positive
acceptance checks every checkpoint, including office/departure, without exclusions.
Missing/corrupt fixtures, zero cases, skipped checkpoints, unfinished sequences,
unconsumed events, diagnostics and rendering/page errors fail.

The manifest records exact original file identities, complete source/capture
inventories and artifact checksums. Originals and captures remain ignored/local.
PNGs are optional illustrations; required JSON contains exact pixel digests.
Environment: Easy, BIOS0, audio disabled, UTC, monotonic origin1 and8ms display
callbacks. Each operation owns and closes its temporary Vite server/browser.

```
node scripts/easy-jungle-variants.js verify
```

For a new record from clean committed source, use fresh local directories and a
new manifest path (registration refuses overwrite):

```
node scripts/easy-jungle-variants.js capture --output=.local/easy-jungles-fresh
node scripts/easy-jungle-variants.js verify --capture=.local/easy-jungles-fresh --output=.local/easy-jungles-fresh-replay
node scripts/easy-jungle-variants.js register --capture=.local/easy-jungles-fresh --replay=.local/easy-jungles-fresh-replay --manifest=reference/easy-jungle-variants.json
```

A completed exploratory capture deliberately exits1. Only verification exit0,
including both targeted negatives, permits registration. Missing local artifacts
are setup failures; verification never regenerates expectations. Arbitrary routes,
other seeds/difficulties and native whole-game timing remain unproven.

The older headless single-treasure verifier assumes collected slot1 (jungle) or31
(mountain). It is not used to accept these alternate slots. Only the exploratory
entry prefix was compared headlessly; complete-route independent acceptance here
is the actual browser consumer. This limitation does not waive any browser check.
