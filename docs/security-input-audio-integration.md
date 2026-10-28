# Security-aware input and Tandy routes

The development branch passes a combined six-case browser run for cave input,
flight input, photography input and all three in-game Tandy cases. Zero cases
were skipped or retried. Main remains054ac66; the full branch gate is pending.

Camera input now reaches Yellerstone by the already verified external feedback
pilot after real security. Its first Easy departure races, so the scenario
requires a genuine landing before testing entry/shutter key deferral, pause
pixels, continuing clocks, quit cancellation and sound toggling. It is adaptive
browser acceptance, not a fixed-stream native replay.

Cave and Tandy input cases use the same two actual Macaroon bank/office round
trips as the verified non-racing crash-repair scenario. The fixed player route
is shared in `tests/browser/helpers/bank-trips.js`; its returned checkpoints
are used only for comparison. Callers require day7/seed62042 and
day13/seed19313, then require a non-racing departure. No RNG or game memory is
injected. The flight-input regression also passes after extracting this helper.

The cave case retains original pause-popup pixels, frozen actors with continuing
driver clocks, deferred keys during entry, room-entry flush, the room18 pickup
and the requirement for a fresh key after a held-key flush. The Tandy route
retains the persistent processor across security, banks, flight mute/unmute and
cave entry/failure. It requires varied engine-speed words, contiguous request
acknowledgements, a busy entry cue with its matching completion token, nonzero
signal samples and consistent interrupt accounting. The adjacent real-clock
device-switch/mute case and visible module-failure case also pass; failure must
close the Tandy context rather than substitute speaker audio.

No runtime, RNG, renderer or audio implementation changed in this step.
Hardware waveform/filter/gain and original IRQ-phase parity remain unproven.

## Reproduce

```
npx playwright test tests/browser/photography-input.spec.js tests/browser/tandy-game.spec.js tests/browser/cave-input.spec.js tests/browser/flight-input.spec.js
npm run verify:tandy-game
npm run verify:system-controls
npm run verify:cave-input
node scripts/verify-photography-runtime.js
```

The original comparison fixtures and supported originals must be installed.
All four focused commands pass. Tandy provider verification covers three carried
routes,13 requests,16 exact checkpoints,six completion events,11 static flight
word boundaries and seven negative controls. Cave input retains eight original
checks,one carried controller replay and five negatives. Photography retains
its conditional animation/pixel comparisons,carried replays,resource cases and
11 negative controls. These scopes remain separate from the fresh browser run.

Private run results, four pictures, four focused verification logs and122 frozen
source files are retained in `.local/security-input-audio-integration-20261029/`.
Remaining focused expedition and lightning recordings must still be migrated
through the security RNG change. The complete branch gate must pass before
security is merged into main.
