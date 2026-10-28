# Linked Hard campaign

Build `dos-fb658562`; executable and original resource identities are pinned by
`reference/build.json`. This is an independent browser scenario and a closed-loop
port regression. Expected states and pixels come from the port, not an original
DOSBox campaign. Original whole-campaign parity and arbitrary-route finishability
remain unproven.

The route selects Hard, flies to Bermuda Triangle, completes its jungle, banks
2050, photographs nine target animals at Yellerstone, collects the cave treasure
at Klondike, climbs El Capitan with three lives, and travels between bank and
office until the final result. All four collected-location flags carry through
one campaign: `[2,30,31,32]`. The last bank journey crosses the deadline and ends
on day33 with19600 banked against Glomgold's44000. This is a completed losing
campaign. The existing mixed Easy route covers a winning campaign.

The third flight's fixed corridor is45..60 in screen coordinates; other Hard
flights use the authored policies in the shared browser helper. The fourth
flight crashes after382 actions, then follows the original repair/arrival path
before mountain entry on day17. The route does not bypass that consequence.
Frame255 of the visible landing flag uses the original decoded-buffer alias;
see [native conditional comparison](flight-flag-alias.md).

Hard gives hook projectiles9 updates instead of Easy's12. The671-action mountain
stream in `reference/hard-campaign-inputs.json` changes the throws accordingly.
`scripts/explore-hard-mountain-route.js` preserves the bounded exploratory route
search. It replays every candidate input prefix from a fresh conditional mountain
contract; that search is not acceptance. The final route was then exercised from
the campaign's carried memory, without resetting or injecting mountain state.

## Reproduction and verification

`npm run test:hard-campaign` replays the independent captured event stream using
real keyboard, canvas and mouse input from a fresh browser context. The opening
enables skipping before the recorded Space, Up, Enter.
Original files load from `game/`; sound is explicitly disabled and BIOS seed0 is
the browser environment provider. Driver/retrace scheduling stays separate from
the8ms test display clock. Jungle444 and mountain671 samples are independently
authored inputs. The feedback controller is retained only for explicitly marked
exploratory capture (`DUCKTALES_CAPTURE_HARD_CAMPAIGN=1`). Strict acceptance reads
no expected state to choose controls. It delivers and checks all3284 DOM events.

The shared helper captures DOM events before target handlers, so focus scrolling
cannot alter recorded logical canvas coordinates. It records input times and
checkpoint times/counts separately from expected simulation snapshots and decoded
320x200 pixel hashes. It fails on rendering errors, unsupported paths, unfinished
input streams, wrong ownership, missing checkpoints and unreleased controls.

The external observation/display clock is in a separate `timeline.json` input,
not taken from expected simulation values. The application entry module is held
until the clock provider is installed on the actual document. Public clock APIs
pause timers; a relative performance origin is declared before any Game exists.
The pre-application setup margin is not simulated game time. Two browser clock
contract cases exercise blank and application documents, host latency and the old
install/pause setup as a negative control. No running game is reset or restored.

`npm run verify:hard-campaign` verifies every hash-pinned local fixture, then
starts a fresh Game from the original executable/assets and consumes all3284
recorded events. All24 published Game snapshots must match exactly. These expose
semantic state, not every private memory byte or input-reader stack field. It
renders1474 flight presentations, including the visible flag alias, and checks
that every required event is consumed and the ending is ready. A separate browser
checkpoint receipt must match all24 state and pixel hashes. Wrong difficulty,
altered expected state, missing checkpoint, altered browser pixels and missing
browser checkpoint are required negative controls. A sixth control omits a real
browser difficulty key and must fail at campaign checkpoint0, not at setup or a
timeout. The browser transcript compares times, types, keys and targets exactly.
Canvas pointer-down coordinates are compared at Campaign.point's consumption
boundary (clamped and truncated logical pixels); raw coordinates remain captured.
Pointer-up coordinates do not enter game logic. There is no pixel tolerance.

The versioned manifest is `reference/hard-campaign.json`; private captures remain
in ignored `.local/`. Missing or corrupt required captures are explicit setup
failures. The reference capture is frozen separately from the browser test's
output directory. It contains no fitted timer values, state injections, partial
restores or expected-output-derived input events. Audio completion, real hardware
waveforms and original CPU/IRQ pacing are covered only by their separate evidence.

For integration use `npm run verify`, which runs browser cases serially before
checking the independent Hard receipt. The complete gate now passes117 unit,70
development browser and2 production browser cases, zero skips. Its immutable
receipt/log are at `.local/hard-campaign/accepted-full-gate-20261028/`; final
Hard browser checkpoints, raw actual DOM events and source identities are at
`.local/hard-campaign/accepted-browser-replay-final-20261028/`. Reference
checkpoint bytes are unchanged from capture09. The earlier full attempt recorded65
browser passes, a ten-minute feedback-controller timeout and an interruption
before its final two cases. It is not a passing full gate. Recorded browser replay
completed twice with all24 state/pixel checkpoints before the final full gate.
The final run also checks actual pointer coordinates at consumption boundaries
and completes both the Hard losing and Easy winning campaign routes. The earlier
exploratory `--diagnose` replay mode permits an incomplete capture and a declared
100ms tail; it cannot satisfy strict acceptance. Successful reference-capture
creation also does not establish original-game fidelity by itself.

The exact full working tree of the initial exploratory reference09 producer was
not archived. Historical preparation hashes remain labelled as such. Strict
reproduction uses its independent input stream with the currently pinned replay
source and archived final browser receipt; no stronger producer provenance or
original-game campaign fidelity is claimed.
