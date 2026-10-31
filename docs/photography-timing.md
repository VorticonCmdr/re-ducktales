# Safari drawing time

The new [HUD work migration](photography-hud-timing.md) charges the line and
numeric-text calls described below as omitted. The earlier receipt remains a
historical partial-work comparison;current clocks have a separate manifest.

Safari now consumes original source sprite/copy work before continuing. The
seven-driver-count deadline remains unchanged. Drawing and retraces can overrun
it; the next loop then continues without another seven-count sleep. Canvas
rendering speed never supplies the simulation delay.

## Source order and evidence

Only the build in `reference/build.json` is supported. Original overlay7 is
16-bit real-mode code: 7,924 body bytes, 93 relocations, far C calls. The entire
native body matches the supported executable. `reference/photography-draw-work.json`
links 1,293 Ghidra instruction bytes for startup, HUD, shutter and normal loop
sites to that body. Analysis body `1c17:0000` corresponds to native `0e0c:0000`;
helper segment `1d39` corresponds to `0f2e`. The exact load-base adjustment and
one analysis-only stack-probe normalization are checked. Analysis images are
never executed. Native capture recipes, tool revisions, resource pairing and
three earlier map-shortcut injections remain in the unchanged parent manifests.

Main `07df..0803` restores 320×176 RAM pixels to video and draws the HUD **before**
the shutter decision. This work also happens on the final negative-film exit.
Main `09de..0a24` draws four additional shutter frames, each with another
background/HUD and animal/Scrooge pass. Counting only displayed frames would
omit the first, overwritten preparation. Normal `0ad8..0b09` draws animals,
Scrooge and the aiming sprite, flips, then advances the postincremented timer.

The existing eleven native animal-helper captures are conditional routine cases.
Three active cases each draw ordinary23, rare39, foreground8 and foreground7.
The byte-checked EGA primitive model predicts 28.157 ms per pass at normal-core
3000 cycles/ms, consistent with two observed driver counts allowing one period
of phase uncertainty. Eight empty cases emit no sprites; their CPU work is
unestimated. AFTER counters are expectations, never scheduling inputs. No new
original session, partial restore or complete machine checkpoint was used.

This is partial drawing-budget evidence. HUD lines/text, other CPU/interrupt
work, remaining-slice I/O clamping, result-sheet drawing, resource loading and
full original loop/scanout/audio parity remain unverified or omitted. A zero
sprite budget in an empty helper does not imply zero execution time.

## Runtime and input contract

`photography-work.js` counts source masks/geometry and the bounded original RAM
copy. The full-page black command used for Canvas reconstruction is synthetic
and excluded explicitly; other unknown work operations fail. Production splits
background/HUD preparation from actor rendering and waits between source groups.
Even overwritten preparations delay subsequent shutter sound and film decisions.
Animal spawning emits its sound requests before the animal draw pass, as in the
existing translated helper. Instructions within a group remain atomic; no
sub-instruction device or scanout claim is made.

The Scheduler supplies elapsed simulation milliseconds, driver interrupts,
retraces and exact work completions. Input, sound settings and device effects
retain their existing interfaces. Hidden-page time is excluded. Restart cancels
pending work. Direct component checks may use their declared synthetic clocks;
that is separate from actual browser acceptance.

## Strict regression and browser acceptance

Run `npm run verify:photography-timing`. Required originals, local native/static
artifacts and historical source must exist and match hashes. Zero cases, missing
inputs, leftover inputs, unfinished sequences, altered outputs or rendering
errors fail. The focused gate also runs all unit tests, two browser journeys,
an omitted-work negative and the production build.

The unchanged `photography-runtime.json` is first reproduced with only the
historical Photography class from `1dc1285`. All its transitive dependencies
must remain byte-identical. Its four full replays, 20 checkpoints, eighteen
resource cases and prior final clocks remain exact. Current native routine and
PNG checks continue to use current source.

`photography-drawing-time.json` then declares new outputs for the same independent
input/dialogue streams. Current and historical runs preserve 899 complete DS
input boundaries, all stack locals and gameplay, plus 2,234 ordered pixel hashes,
presentation modes and wipe tokens. Exactly twelve DS bytes are excluded from
cross-version equality: wait base `2221..2224`, IRQ clock `2225..2228` and deadline
`27f8..27fb`. RNG `2229`, the interval and page pointers remain exact. The current
clock trace, final full DS/state and event counts have separate exact expectations.
Expected clocks or final state never generate inputs. Eight negatives reject
changed RNG, pictures, mode, missing publication/input, extra input and altered
clock outputs. This is port regression, not a native whole-expedition replay.

The actual browser routes land through the office/security/map/flight path,
take a target photograph with sound, finish the film, return through results
and verify campaign earnings/claim protection. A separate case checks shutter
cadence, deferred Pause, frozen pixels, quit cancellation and sound controls.
Both use the existing explicit browser clock and actual DOM input/rendering.
The isolated negative removes only the served work wait and must fail the
cadence assertion; setup errors and timeouts do not count as a detected defect.

Seven focused clock cases cover sound/film ordering, nine source draw groups
for four shutter publications, catch-up batching, hidden-page pause, Restart,
invalid providers/operations and the final unpresented out-of-film preparation.
These checks do not establish a green complete campaign gate or finish the port.

The combined gate passed on `f14804d` with 139 unit checks, both browser cases,
the cadence negative and production build. No cases were skipped.
[Integration receipt](../reference/photography-drawing-integration.json) pins
the 639-file source archive, runner, logs and browser images. A fixture producer
can write a fresh optional output path:
`node scripts/declare-photography-drawing-time.js .local/photography-candidate.json`.
It refuses to overwrite existing expectations.
