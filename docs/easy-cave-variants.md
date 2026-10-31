# Easy cave destinations

This check broadens the accepted Easy campaign's one cave layout to all eight
original map variants. It is port regression evidence, not eight native-game
comparisons. Hard remains deferred.

Accepted from clean source `d7257c1`: eight component routes, 2,696 exact
state/pixel presentations, twelve browser checkpoints, 82 DOM events, Restart,
and all four negative controls. Capture `.local/easy-cave-variants-02` was replayed
independently into `.local/easy-cave-variants-replay-02`. The earlier first replay
failed because the harness did not await resource loading; it is unaccepted.
The corrected harness waits for application readiness with simulation time frozen.

The component driver plans safe paths directly from original map exit/pit flags,
then saves its ordinal input stream before capturing any expected state. A fresh
instance carries its own state through every rendered presentation, the treasure
outcome, coin reward and torch count. Its clock advances one driver tick and one
retrace per step; this synthetic provider does not establish native cadence.

The browser route was explored interactively before authoring the harness:
startup, Easy, security, two bank trips, Carlsbad Caverns selection, transport,
flight, rooms45→37→29→21→13→12→11→19, treasure award, map and Restart.
The harness uses actual DOM controls, original assets and an owned temporary
Vite server. Twelve exact full-state/pixel checkpoints are compared against an
independent, timestamped DOM event stream in a fresh browser. Expected outputs
never choose replay inputs. Fixed BIOS seed0, UTC and a controlled monotonic clock
are explicit environment providers. Audio is disabled for this scoped check.

Three component negative controls remove an input, change a state digest and
remove a checkpoint. A fresh browser negative omits the first cave movement and
must diverge at room37. Missing/corrupt fixtures, unfinished paths, unconsumed
inputs, skipped presentations and page errors fail verification.

Run registered acceptance with:

```
node scripts/easy-cave-variants.js verify
```

Local proprietary fixtures are required. Missing files are a setup failure;
verification never regenerates expected outputs. To establish a new record from
clean committed sources:

```
node scripts/easy-cave-variants.js capture --output=.local/easy-cave-variants-fresh
node scripts/easy-cave-variants.js verify --capture=.local/easy-cave-variants-fresh --output=.local/easy-cave-variants-fresh-replay
node scripts/easy-cave-variants.js register --capture=.local/easy-cave-variants-fresh --replay=.local/easy-cave-variants-fresh-replay --manifest=reference/easy-cave-variants.json
```

Capture deliberately exits1 after saving successful exploratory output; it is
not acceptance. Replay must exit0 before registration. Registration refuses to
overwrite an existing manifest and pins the replay to its exact capture inventory.
The manifest records original build pairing, source archive, input and expected
JSON checksums and replay result. PNGs are optional illustrations: required exact
pixel digests are stored in checkpoint JSON. Originals and captures stay ignored.

This does not prove arbitrary cave paths, complete native timing, Hard behavior,
all destinations in one campaign, or the remaining expedition families' variants.
