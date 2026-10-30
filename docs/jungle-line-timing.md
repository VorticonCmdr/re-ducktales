# Jungle line-work timing integration

The runtime now charges each actual source line call emitted by
`presentJungleFrame`, before passing the unchanged command to the renderer.
The counter is `src/game/ega-line-work.js`, moved from the analysis tooling;
no duplicate implementation or fixed movement delay is used. Its native
32-case evidence is preserved in `reference/ega-line-runtime-work.json`.
The earlier analysis-only manifest remains historical and is not overwritten.

`jungleWorkEffects` adds the line primitive's opcode/OUT budget to the existing
sprite/copy budget. `lines`, `lineInstructions` and `linePortWrites` expose the
new contribution; `omittedLines` is zero. Fully clipped source lines contribute
no driver call. Unsupported coordinate differences or non-EGA scaling stop
explicitly. Resident dispatch/color instructions, text and remaining CPU/device
work are still outside this partial budget.

The six retained original drawing boundaries exercise60 line calls. The new
counter reproduces the historical sprite/copy totals exactly, adds precisely the
independently verified line work, and preserves every downstream command, color
and game-memory byte. Original native DS/raster comparisons remain required.
Controls remove a line budget, remove an OUT charge and duplicate a line count;
each fails. The32 native primitive cases and their six controls run first.

Longer component comparisons retain both earlier references: all original
historical gameplay/image expectations, and the entire pre-line drawing timing
contracts. The latter are reproduced with the archived pre-line Jungle and work
adapter from`a20ca90`. All other transitive dependencies must be byte-identical;
no whole checkout or state restore supplies an initial state.

The failure route consumes824 independently authored source-read inputs and
publishes875 ordered payloads; the treasure route consumes792 inputs and
publishes839 payloads. Both retain20 gameplay checkpoints and exact DS at every
source input boundary except the three existing separately checked timer words.
Their line-inclusive clock streams contain9,297 and8,881 events respectively,
compared with9,187/8,795 before lines. New expected timing outputs are separate
port regression data, never inputs or original elapsed-time goldens.

```sh
node scripts/verify-jungle-line-work.js
node scripts/jungle-line-timing.js
node --test tests/jungle-timing.test.js
# Author NEW component timing contracts only from a clean committed producer:
node scripts/jungle-line-timing.js --declare
```

Declaration refuses existing files. Missing originals/history/artifacts, zero
cases, omitted inputs/images/checkpoints, unfinished streams, unconsumed events
or changed RNG/page state fail. Timer exclusions stay exactly2221..2228 and
27f8..27fb; no new state/pixel exclusions are introduced. The new component
contracts and browser acceptance must pass independently before claiming the
integration milestone complete. A full campaign needs its own fresh comparison.

This closes one omitted primitive cost. It does not prove native whole-jungle
cadence or resolve every reported speed difference. Hard campaigns remain
deferred at the user's request.

The first actual-browser pass uses the unchanged first1,016 recorded campaign
events and three state/pixel checkpoints to reach jungle entry. It then checks
the drawing wait, frozen actors under Pause (driver/retrace clocks continue),
and cancelled Quit. A browser-only zero-deadline mutation must fail the initial
publication assertion. The earlier direct helper stopped before jungle because
its held throttle was flushed by departure; that attempt is not acceptance.
