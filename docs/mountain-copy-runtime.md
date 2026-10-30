# Mountain restoration runtime integration

The browser now runs the native-checked mountain erase call planner and charges
its signed EGA copy work before the existing retrace wait. `mountain-erase.js`
retains original DS effects; `ega-copy-work.js` retains unsigned clipping, signed
flags and REP/low-byte quirks. Both are exact copies of their independently
verified analysis models. They do not rasterize background copies: Canvas still
reconstructs the screen, without charging that reconstruction as original work.

`Mountain.eraseEffects()` invokes the source planner and `chargeCopy()` collects
its primitive work. The next `frame()` transfers this pending work exactly once.
`present()` combines it with sprite work, including REP iterations and OUT costs.
The separate `spriteWork` diagnostic retains its prior sprite-only meaning;
`drawingWork` reports the actual combined budget. No RNG, integer movement,
driver/audio clock, or input provider is replaced.

## Focused acceptance

```sh
node scripts/verify-mountain-copy-integration.js
```

This strict command checks all 22 supported files, both native comparison
boundaries, all 34 production erase/charge adapter cases and DS effects, 15
conditional native movement checkpoints, and an independent closed-loop summit
route: 764 consumed inputs, 26 state checkpoints, 870 rendered presentations,
award and all three lives. Route inputs and expected states remain the separate,
unchanged `reference/mountain-ascent.json` streams. They are port regressions,
not native ascent observations. Missing checkpoints, unsupported calls, zero
copy work, unfinished sequences and rendering failures fail the command.

It also requires all 180 unit tests, one actual-browser route and an actual-browser
negative control, then the production build. The browser traverses startup,
security, map, departure and flight into mountain; checks opening pages, pause
pixels, cancelled Quit, a fixed 600 ms physical Right hold, release-edge input
and natural life reset. It asserts live copy charging. The omission control
replaces only the browser's `chargeCopy` call and must fail specifically at
`Original mountain copy work`. The source files remain intact. Component controls
also remove copy work/fire/checkpoints and must fail.

The older browser test held acceleration across flight's matrix initialization,
which clears that physical key from the emulated matrix. It could stall before
mountain. The route now waits for the first flight read and refreshes the hold,
as the current flight replay helper does. The first failed attempt is an input
setup failure, not mountain acceptance; later runs use the explicit boundary.

The focused gate writes fresh browser output directories and fails on any
required nonzero command. Its expected negative browser exit is checked for both
the intended assertion and exactly one failed case; unrelated failures are not
accepted. Test timeout bounds do not advance game time.

## Remaining work and historical receipts

This is not complete original timing. The scheduler still rounds the combined
duration into retrace counts without accounting for the starting retrace phase.
Mountain HUD text/lines, opening/scroll composition copies, caller CPU/device work
and full native scanout remain missing. Cloud 3/invalid state and arguments outside
the primitive's supported width/height domain fail explicitly.

The retained natural walking benchmark still compares 599.264 ms for 14 port
intervals with 604.032 ms from 44 original driver counts. This is unchanged by
these copies at that phase because the rounded retrace count stays three. It
does not establish whole-level speed; omitted work and rounding may compensate.

The full text-inclusive Easy campaign receipt at `a54c8ec` and the previous
ascent input bridge are historical and unchanged. Their source guards reject the
new mountain module; they have **not** been refreshed for this integration.
`npm run verify:current-campaign` must not be reported as passing current source.
The new focused route excludes only tick/work diagnostics from the old final
gameplay object; it preserves every gameplay field and all 26 input-boundary
checkpoints, and separately checks the new budgets against original cases.

Next connect HUD text/lines and absolute graphics deadlines, then produce an
independent full browser campaign and refresh complete acceptance. Hard campaigns
remain deferred. No original file, proprietary fixture or old manifest is changed.
