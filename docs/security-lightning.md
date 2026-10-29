# Security-aware natural lightning

The browser now reaches a generated storm through the actual campaign:
opening skip → Easy → office departure/security → three bank/office trips →
Bermuda Triangle departure → flight → lightning → fresh-key recovery → restart.
The departure occurs on day19, seed27866, raceRoll66, nonracing. No random seed,
course, actor state, device clock result or collision outcome is injected.

The original111-control pre-security recording remains in
`reference/lightning-flight-inputs.json`. Its inputs crash on the new two-bank
course, which has no generated storm objects. A third ordinary bank trip changes
the carried random state and generates storm objects42/43 on tile2. The existing
altitude0..15/heading2 player policy finds this route. This is player-route planning
from the port, not a native flight input recording.

`reference/security-lightning-inputs.json` contains35 external consumed controls.
The browser then makes Down while retaining Space and issues no further input
through strike36 and three further frames. Input36 is internally neutral; it is
not supplied as an external zero event. Original collision code clears the custom
keyboard state and turn requests. This strike sets heading8, so fresh Space+Up
steers towards heading7 and climbs left. The plane accelerates after three frames.
Both keys are released, and recording waits for the next neutral flight-input poll.

The six named checkpoints are departure, before-strike, strike, slowed, recovery
and released. Complete application snapshots and exact decoded320×200 RGBA pixels
match between the capture controller and independent timestamped DOM replay.
Independent Game replay consumes all164 events and43 flight presentations, with
no retained keys, queued events, tail time or skipped checkpoints. The final
flight is still active, input43 is neutral, and seed8907 is carried naturally.
Restart is exercised separately by the controller browser case.

The first recording ended8ms after release, before the releases reached a device
edge. Strict replay rejected its two queued events. It remains excluded. The
accepted recording waits for the actual input-consumption boundary; no tolerance
or fitted delay was added. Raw captures declare completed=false and deliberately
fail after saving. Browser reproduction and strict replay are separate evidence.

Omitting the fresh throttle make is rejected at recovery checkpoint4. Changed
expected state, missing checkpoints, changed pixels and omitted browser checkpoints
are also rejected. Missing/corrupt pictures are explicit setup failures. Source
archives and original build identities are checked against pinned local Git commits.

The existing source checks in `scripts/verify-flight-lightning.js` independently
validate the original overlay switch, collision branch and resident flush bytes,
and reject a removed flush callback. Its conditional component fixture is separate
from this campaign route. No whole-original flight timing, IRQ, typematic or
framebuffer comparison is claimed. See [original input boundaries](../reference/flight-lightning-input.json)
and [current status](STATUS.md).

Private pictures, states and DOM recordings stay under ignored
`.local/security-lightning-*`. Reproduction starts with the supported originals in
`game/` and the public input recipe above. A new exploratory capture can be made with:

```
DUCKTALES_CAPTURE_LIGHTNING=.local/security-lightning-new npx playwright test tests/browser/flight-lightning.spec.js
```

This exits nonzero after saving and does not replace accepted evidence.

```
npm run verify:security-lightning
npm run verify:flight-lightning
```

The focused command checks retained receipts, reruns both browser modes, requires
the missing-throttle negative, and checks missing/corrupt fixture rejection and
restoration. The second command additionally checks original collision/flush code
and the conditional input-ordering regressions. Full branch integration is pending.
