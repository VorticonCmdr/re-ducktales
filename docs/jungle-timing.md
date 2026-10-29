# Jungle drawing time

The jungle port already uses the original three-driver-count deadline (about
41.2 ms at the resident timer rate). That deadline is a minimum, not a promise
that every update finishes in that time. The original draws before checking it.
Full redraws can exceed the deadline by several times.

## Conditional evidence

`reference/jungle-draw-work.json` uses the six unchanged original presentation
captures in `reference/jungle-presentation.json`. Each starts at main032b and
ends at main047c, before the page operation. The supported executable and assets
are identified by `reference/build.json`. The parent manifest records the original
normal-core 3000 cycles/ms configuration, relocated overlay identity, original
state setup, artifact hashes and resource pairing.

| Case | Sprite/copy work | Original driver counts | Drawing situation |
| --- | ---: | ---: | --- |
| 00 | 27.190 ms | 2 | Dirty restoration |
| 01 | 27.286 ms | 2 | Dirty restoration |
| 02 | 178.254 ms | 13 | First full redraw |
| 03 | 170.195 ms | 13 | Second full redraw |
| 04 | 161.716 ms | 12 | Third full redraw |
| 05 | 44.781 ms | 3 | Dirty restoration after redraws |

These are independently initialized routine comparisons. Counter differences
bracket elapsed time by one timer period because the boundaries have unknown
counter phase. All six model costs lie inside that bracket. Debugger stops
also discard CPU budget, so this agreement is **conditional drawing evidence**;
it does not establish uninterrupted input cadence or exact screen-flip timing.
No AFTER timestamp or state is supplied as a scheduling input.

`src/game/jungle-work.js` observes the actual original presentation effects. It
counts EGA sprite opcodes, copy opcodes, write-port charges and REP iterations
using the existing byte-checked primitive models. Lines, text, caller logic,
interrupt costs and end-of-slice I/O clamping remain omitted. It forwards every
command unchanged to the rendering sink. Original right overscan can cross a
scanline; X is normalized only inside the cost counter because EGA01ef..035c
has no X-dependent control flow. Actual pixel addresses remain the renderer's
responsibility, including its existing per-bit validity checks. General wrapping
or overlapping copies are unsupported.

## Verification and remaining integration

Run `npm run verify:jungle-work`. Missing/corrupt originals, local captures,
changed source files, missing cases, different exact work counts or a cost
outside the declared counter bracket fail. The command also runs the original
presentation and primitive checks. Four added negative controls reject a missing
case, altered sprite work, altered REP work and zero drawing time.

This milestone adds the reusable work observer and executable evidence only.
**Jungle runtime scheduling is not changed yet.** The next implementation must
charge this work against an explicit simulation-time provider before the next
retrace, respecting the three-count deadline and its phase. It must not round
each update independently to a fixed number of retraces. A fresh browser route
and strict input-removal controls are required before claiming acceptance of the
changed jungle pacing. Cave and safari timing remain separate investigations.
