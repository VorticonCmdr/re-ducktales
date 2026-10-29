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

## Runtime boundary and verification

Run `npm run verify:jungle-work`. Missing/corrupt originals, local captures,
changed source files, missing cases, different exact work counts or a cost
outside the declared counter bracket fail. The command also runs the original
presentation and primitive checks. Four added negative controls reject a missing
case, altered sprite work, altered REP work and zero drawing time.

The runtime now wraps actual `presentJungleFrame` effects with this observer.
It charges the resulting sprite/copy work after any pending logical driver wait,
before the page/reveal operation. A graphics wait holds publication and the next
input until completion; the next retrace can then finish the page. The existing
three-count deadline still applies after presentation. The work summary is
available in jungle diagnostic state as `drawingWork`.

`Scheduler` supplies elapsed simulation milliseconds through an explicit clock
provider installed on `Game` and forwarded to `Jungle`. The provider advances
before each driver/retrace event and queued input. Its origin is the scheduler's
start, and hidden-page pauses are subtracted; host rendering time never feeds
back into logic. Direct component callers retain a declared zero-phase provider
based on their independently advanced driver/retrace counts. That synthetic
provider is not evidence of original elapsed-time parity.

Run `npm run verify:jungle-timing` for the focused gate. Four added timing cases
check withheld publication, the next retrace, catch-up batch invariance, a pause
during drawing, invalid time, and a work-bypass negative. The actual browser route
measures the first and second redraws, then checks pause, quit cancellation,
audio and rendering. Its eight-millisecond observation grid and retrace phase
bound the duration checks. A separate real-browser negative removes only the
work deadline and must fail the first-redraw duration assertion; a setup failure
or timeout is rejected as invalid negative evidence.

The six native drawing comparisons remain conditional evidence, with their
original manifest's `runtimeIntegrated:false` describing the earlier evidence
milestone. This new scheduling integration still omits the work listed above.
**A fresh complete treasure route and independent fixed-input browser replay
are pending.** Historical time-based route contracts have not been rewritten to
force passing. Full original input-loop/scanout timing, cave and safari pacing,
and the broader required integration gate remain unverified.
