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

## Remaining integration work

The main campaign gate passed before this integration. Its other startup scripts
and recorded campaigns still assume immediate difficulty input/confirmation.
Migrate them to the real `difficultyMenu.ready` and office boundaries, and capture
new independent event streams where restored timing changes the old stream.
Do not shorten the reveal/wipe, inject game state, fit clocks to expected outputs
or silently update state hashes to make the old streams pass. Preserve the
previous accepted campaign evidence separately. Run the full gate after migration
before merging this branch into the main checkout.

The temporary local browser harness uses port5196 and an isolated output folder;
it must not reuse the main verification server on5186. The standard project
configuration remains unchanged. No originals or private captures are committed.
