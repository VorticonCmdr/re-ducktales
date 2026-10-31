# Current Easy Safari variants

Scope: all six supported Safari resource variants, starting fresh with actual
browser controls. Yellerstone Park, Duckbill Island, Ronguay, Kenya Game Reserve,
Xanadu and Borneo each must reach a target photo, finish the film, display results,
return with cash/ownership/day consequences and Restart. Hard remains deferred.
This is port browser acceptance, not native whole-route or cadence parity.

Accepted from clean source `f36dd7d`:48 exact state/image checkpoints,2,714 DOM
events, all six shutter negatives and all six Restarts. Producer:
`.local/easy-safari-variants-02`; independent consumers:
`.local/easy-safari-variants-replay-02`. The29-artifact record includes actual
comparison digests and the negative state divergences. The15 existing photography
input/timing tests also pass. The first capture's film-1-only setup assumption
was rejected; that run remains unaccepted. No gameplay code was changed.

| Variant | Destination | Score | Final film | Return day |
| --- | --- | ---: | ---: | ---: |
|1|Yellerstone Park|1550|-1|3|
|2|Duckbill Island|550|0|3|
|3|Ronguay|1500|-1|3|
|4|Kenya Game Reserve|550|0|5|
|5|Xanadu|1050|-1|4|
|6|Borneo|500|-1|3|

Borneo was explored with actual browser controls before authoring this harness.
The common interaction path also uses the existing photography browser scenario.
A visible target at frame0 selects the aim column; a real key make aims and a real
Space make takes the photo. Capture may retry a missed target, up to eight times.
Every aim/photo attempt is recorded. Expected outputs never choose capture input.
Strict consumers do not call the player controller: they replay only the separate
recorded DOM event stream from a fresh application.

After a target is photographed, explicit external Space repeat makes consume the
remaining film: first after250ms, then every32ms. These are authored device inputs,
not native typematic evidence or fitted game timers. Source mode1 clears ordinary
key slots at reads; browser key holding alone does not synthesize repeats. Sound
is disabled for this scoped run. Target pictures pay500, ordinary pictures50 and
misses0. Results must show all12 pictures. The original normal exit can leave film0;
a further accepted shutter exits at film-1 before adding another picture.
Both branch outcomes are allowed by the semantic setup check; each captured
case and its consumer compare the exact film value without exclusions. The shared campaign return
clears the score workspace but preserves the outcome score, adds no separate loot
reward and spends the original two days (activity plus caller). These assertions
use the existing source/native component evidence; no new native run is claimed.

Exact full-state/pixel checkpoints cover office, departure, Safari entry, every
aim/photo attempt, film exhaustion, fully revealed results and map return. The
consumer checks all required events and checkpoints, independent score arithmetic,
claimed destination and Restart clearing actors/cash/claims. Each variant also
omits its first shutter make and must fail specifically at `photo-1` with different
game-state digests. An event-only mismatch or setup error cannot satisfy that
negative. Actual comparison digests and the negative divergence are saved locally.

The manifest pins all22 original identities, complete source/capture inventories,
inputs, expected checkpoints, environment/timeline, producer status and consumer
result. Original assets and screenshots remain ignored/local; PNGs are optional
illustrations, while exact pixel digests in required JSON are authoritative.
Missing/corrupt fixtures, zero cases, skipped checkpoints, unconsumed events,
unsupported paths, rendering/page errors and unfinished sequences fail.

Environment: Easy, explicit BIOS0, UTC, monotonic origin1 and8ms display callbacks,
audio disabled, declared external repeat profile. Each capture/replay owns its
Vite server and browser and closes them in finally blocks. No shared emulator or
server is modified; no memory restore, RNG/actor injection or fitted device result
supplies a replay input.

```
node scripts/easy-safari-variants.js verify
node --test tests/photography-input.test.js tests/photography-timing.test.js
```

To create a new record from clean committed sources, use fresh ignored paths and
a new manifest name (registration refuses overwrite):

```
node scripts/easy-safari-variants.js capture --output=.local/easy-safari-fresh
node scripts/easy-safari-variants.js verify --capture=.local/easy-safari-fresh --output=.local/easy-safari-fresh-replay
node scripts/easy-safari-variants.js register --capture=.local/easy-safari-fresh --replay=.local/easy-safari-fresh-replay --manifest=reference/easy-safari-variants.json
```

Capture deliberately exits1 after completed exploratory output. Acceptance requires
verification exit0, all six positive consumers and all six shutter negatives.
Other seeds/difficulties, arbitrary player routes and full native timing remain
unproven. Gameplay source has not been altered for this harness.
