# Difficulty menu browser integration

This work is on `codex/difficulty-menu`, based on `6f7867b`. It is not yet
integrated into the main checkout's verified campaign milestone.

The application now uses `DifficultyMenu` with original MAIN.ARC32 and executable
strings. Entry fills/flips to black, reveals five interleaved row groups, and
flushes queued keys before polling. Selection wraps, waits seven driver counts
between reads, emits sound36 when enabled and tests Fire before movement.
Confirmation reads the explicit BIOS seed provider before the25-retrace closing
wipe; campaign initialization follows cleanup. Replay from the ending uses the
same menu and retains the original post-return sound reset.

Input, audio settings, system dialogs, driver ticks, display retraces and BIOS
seed values enter through explicit interfaces. The component has no wall-clock
or host RNG access. Queued button/key taps are distinct from the held digital
joystick provider. Entry flush discards taps; global-dialog resume also releases
controls. The browser's keyboard-as-joystick mapping remains an explicit adapter.

## Focused verification

`node scripts/verify-difficulty.js` checks four exact original menu pictures,
nine consumed inputs, five native sound calls, fresh relocated code identity and
the BIOS consumption/write boundary, then carries a component replay through the
source-derived lifecycle. See [native recipe and scope](difficulty.md).

`playwright test tests/browser/difficulty.spec.js` exercises real keyboard and
visible buttons, four exact original pictures, reveal-key flushing, wrapping,
Fire+Up priority, confirmation/office return, pause/resume and actual Tandy cue36
acknowledgements and sample output. The pixel comparisons have no tolerance.
`node scripts/verify-difficulty-browser-negative.js` omits the required Up action
and must reject the missing Hard selection, rather than timing out or failing
setup. Private originals are required; missing files fail explicitly.

The existing money-bin/banking/restart route and earned-cash winning-ending/replay
route also pass after waiting for menu readiness and cleanup. The117 unit tests
and production build pass. Four combined browser cases and the negative-control
log, unit/build logs, screenshot and exact source identities are archived in
`.local/difficulty-browser-accepted-20261028/`, pinned by `reference/difficulty.json`.
The native verifier rejects missing/corrupt receipts as well as native fixtures.
These are focused results, not a passing complete application gate for this branch. Neither browser clock waits nor native captures
establish original CPU/file costs or complete elapsed-time/waveform parity.

## Startup and campaign migration

Startup scripts now wait for `difficultyMenu.ready`, the visible selection and
cleanup/office boundaries. Fast Up+Enter must not override the original Fire
priority by silently forcing a selection. Eleven targeted startup/travel/audio
cases pass, as does the complete Easy winning campaign with its existing19
summary checkpoints. All117 unit cases pass after the migration.

Flight frame counts precede input consumption. The new read-only `inputReads`
and `lastInputCode` observations support real keyboard replay at input boundaries;
[the independent control streams and their scope](flight-input-boundaries.md)
retain the established flight outcomes and expedition actor checks. No physics,
RNG, game clock rate, reveal or closing wipe is shortened to recover a test result.

The new Hard capture completes all four families and ends on day33 with19600
against44000. It includes a legitimate Glomgold report before mountain return,
which is acknowledged through existing controls and recorded as an additional
checkpoint. All3350 DOM events and25 exact published snapshots match in a fresh
Game replay. An independent actual browser replay matches all25 state/pixel
checkpoints, checks the actual submitted input transcript and stays on one page.
The previous accepted24-checkpoint/3284-event capture remains separate. The new
source/dependency snapshot pins85 files, all unchanged during capture.

One earlier exploratory run loaded a fresh title document and lost its window
recorder state; its cause was not established and it is excluded from acceptance.
Captures now log main-document navigation and Vite messages, reject any unexpected
navigation and preserve the prior document's captured prefix. The accepted run
used a fresh owned server with exactly one navigation. Ordinary browser tests
also own a fresh server rather than reuse an editor session.

`npm run verify:flight-input-stream` checks all four source profiles and verifies
that dropping a real turn fails at consumed input18. A separate pending-receipt
control confirmed that a new capture cannot be accepted without a new independent
browser receipt. The full branch gate must still pass before integration into
main; focused or exploratory results do not replace it. No original whole-campaign,
CPU/file cost, elapsed-time or waveform parity is claimed.

The first full integration gate stopped at a historical route-helper identity
check after its native comparisons and input-stream controls passed. The four
Hard route manifests now preserve their historical capture identities against
Git57beb92 while pinning the current startup/input replay tools separately. No
expedition controls, actor expectations or required divergence checkpoints changed.
The full gate must pass on this revision before integration.
