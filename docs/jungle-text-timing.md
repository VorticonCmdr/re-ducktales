# Jungle formatter and text timing

The runtime counts original HUD number formatting and transparent EGA text calls
at their source drawing boundary. It uses original signed32 digit generation and
16-bit alignment, including the negative-value remainder-glyph quirk. No fixed
slowdown, guessed duration or browser rendering cost is introduced. Simulation
remains independent of DOM/time/audio providers. `omittedTexts` is zero for this
supported HUD path; unsupported numeric calls/fonts/scales fail explicitly.

The original driver field CS22 points to DS2052, established by resident
140e:0617's driver-table setup. Its alternate-page flag and the drawing surface's
original offset feed the work model. All six captured original drawing boundaries
have flag0 and surface offset0. Native primitive cases also verify alternate-page
and nonzero-offset control flow. The runtime's14 primitive paths match those
captures, and its16 formatter paths match the complete native formatter traces.
[Primitive evidence](ega-text-work.md) and [formatter evidence](hud-number-work.md)
retain their historical captures/prototypes unchanged; production uses the two
modules under `src/game/`.

Six preserved original BEFORE states retain identical game state, color and all
sprite/copy/line/text commands. Four text calls in two HUD redraws add1,105 opcodes
and72 OUTs per redraw:463 formatter/helper opcodes and642 driver opcodes. At the
declared cycles3000 platform this is0.416333ms. Other redraws add no text work.
This is a missing source cost, not an explanation for every speed difference.

## Independent component and browser acceptance

```sh
node scripts/verify-jungle-texts.js
# Recheck the saved source-pinned result without rerunning the browser:
node scripts/verify-jungle-text-receipt.js
# Separate focused mechanisms:
node scripts/verify-jungle-text-work.js
node scripts/jungle-text-timing.js
```

The clean combined gate passes at`a9ce318`, with a782-file Git archive,
36 evidence artifacts and326 protected reference/capture files unchanged.
The [integration record](../reference/jungle-text-integration.json) pins source,
logs, declaration recipe, actual browser report and both browser failure reports.
A later receipt/docs commit does not relabel that archived source.

Declaration used clean`c86d607` and the unchanged independent input streams from
`jungle-runtime.json` and `jungle-treasure.json`. Their new contracts are
[jungle-runtime-text-time.json](../reference/jungle-runtime-text-time.json) and
[jungle-treasure-text-time.json](../reference/jungle-treasure-text-time.json).
The producer archive/status/log/recipe remain in ignored
`.local/jungle-text-component-producer-01/`. Declaration alone is not acceptance;
the separate clean consumer gate reruns both routes and17 failure controls.

The runtime route checks824 consumed input bytes,875 ordered image payloads,
20 exact gameplay/timer checkpoints and9,309 independent device events. Treasure
checks792 bytes,839 image payloads,20 checkpoints and8,881 device events. Original
full DS at reads and final DS remain exact except the same three independently
checked timer words. All ordered image payloads/gameplay checkpoints remain exact.
Current clocks/publication times are separately exact. No new exclusion, fitted
input, timer injection or restore is added.

The original`c406dc4`, pre-line`a20ca90` and line-only`f7baa4d` runtimes are loaded
from their exact Git source graphs. Only Jungle, jungle-work and
jungle-presentation are replaced by frozen modules; every other shared dependency
must remain byte-identical. The original state/image stream and both intermediate
clock/publication/checkpoint streams are rerun unchanged. Historical expectations
are never overwritten to accommodate the new work. Missing source history fails.

The gate also requires all180 unit cases, the production build and a fresh actual
browser route: startup/flight's first3 state/pixel checkpoints and1,016 inputs,
first draw deadline, walking, Pause/resume and cancelled Quit, with all three lives.
The fixed browser prefix's first HUD adds641 instructions/40 OUTs. Its total first
draw budget must be476,996 instructions; this is independently native-counted,
not inferred from expected timer state. Browser-only mutations that zero the draw
deadline or omit numeric work must fail at the declared checks. Setup failures,
timeouts, missing/skipped/retried cases, unfinished streams and unused required
inputs cannot satisfy acceptance. Three saved-receipt controls reject empty
browser coverage, a skipped browser result and a checksum-corrupt artifact.

## Remaining scope

This is closed-loop component regression and actual-browser jungle acceptance.
A fresh complete Easy campaign comparison after text timing remains pending.
The prior line-inclusive full campaign record remains historical and intact;
its current-source check correctly rejects the changed runtime. The older
`npm run verify:current-campaign` still targets that prior source contract and
must not be reported as current text-inclusive campaign acceptance.

Resident dispatch/color, opaque text, HUD caller instructions, remaining CPU/IRQ
and device costs are still omitted. Native whole-jungle cadence/scanout is not
proved by these counts. Other expeditions' missing drawing/input behavior,
arbitrary-route finishability and full original-game parity remain incomplete.
Hard campaigns remain deferred.
