# Rival announcement input

Supported build: the 22-file pairing in `reference/build.json`. This work covers
the shared resident `126b:0008` announcement used by ordinary rival reports and
forced claims after a lost flight race. Hard campaigns remain deferred.

## Statically established behavior

`reference/rival-input-source.json` checks 154 original/Ghidra bytes and declared
loader relocations. Enabled sound requests `6e`; the reveal is followed by the
`19a5` input flush. The caller queries global sound status. While busy, it reads
ordinary input, exits on Fire, otherwise waits 14 driver ticks before querying
again. If the first status is idle, it uses shared `09f5(40)`: immediate first
read, seven-tick neutral waits, no 41st read. Only Fire consumed by that fallback
requests enabled click `24`. Completion requests enabled `21`. The graphics wipe
is not an audio reset; the port no longer adds sound `0` around this caller.
Rival location is published at `126b:0322`, after the announcement completes.

The busy-loop reader `1124:0002` itself handles P/Q/S under the default flags.
`reference/rival-keyboard-source.json` checks another 282 original/Ghidra bytes
and two relocations. Pause and Quit-No return into the pending input read. If
speech finished during the modal, the caller still completes that read and its
14-tick wait before querying sound again. It must not restart at the sound query
and enter the 40-read fallback. Old queued Fire is discarded on modal return.

## Evidence and scope

`scripts/rival-input.test.js` checks the reader boundaries, initial unknown audio
status, speech completion, modal continuation, conditional requests and deferred
location. It uses explicit conditional state/audio inputs; it is not an
independent original-game replay.

`reference/rival-input-browser.json` specifies two independent DOM replay cases:
ordinary report and forced claim. Each has nine complete state/decoded-image
checkpoints, Pause, Quit-No, fresh Fire, map return and Restart. Each replay must
also reject omission of its Pause input at the Pause checkpoint. These cases use
muted sound and compare the port against preserved port captures.

`reference/rival-standard-route.json` preserves the full Standard route's 5,071
input events. Its 85 complete expected snapshots correct the two forced-claim
checkpoints where the old port prematurely moved the rival. The producer compared
all remaining fields and all decoded images with the previous route. This narrow
source-supported correction is declared in `rival-standard-comparison.json`;
no inputs or live game state were fitted or injected to achieve it. A separate
fresh consumer compares the corrected complete snapshots without exclusions.

`scripts/probe-rival-audio.js` exercises actual browser audio acknowledgements,
completion and nonzero device output. Host waits and injected game-clock advances
are explicitly conditional. Normal speaker and Tandy paths passed with request
order `24,6e,21`, actual speech completion and Restart. This establishes an adapter
interaction, not native clock or waveform parity. Speech completing inside Pause
is covered by conditional controller tests, not the real-device browser probes.

The attempted controlled module-loading experiment failed because Chromium's
AudioWorklet fetch bypasses Playwright Page/Context routing, a limitation already
recorded in `tandy-audio.md`. Its source archive and failure log remain separate
in `.local/rival-audio-tandy-01`; it is excluded from acceptance. The unsupported
`--speech-controls` option now fails immediately instead of repeating that loop.

## Remaining limitations

Native reveal/wipe/drawing costs and audio phase have not been established.
The original keyboard S-off0/24 sequence and actual device-status handling were
subsequently corrected in [sound-toggle evidence](sound-toggle.md). The preserved
rival milestone receipts remain historical;their old runtime guards reject later
source. Native sub-call IRQ phase remains unverified. Broader modifier/BIOS, mouse and joystick behavior is unverified.
The shared controller does not prove arbitrary campaigns finishable.

## Reproduce

Local proprietary artifacts are required; missing or corrupt files fail setup.
Fresh browser outputs require clean committed source and new ignored paths.

```sh
node scripts/verify-sound-toggle-acceptance.js
# Historical saved rival receipt requires its archived runtime:
# node scripts/verify-rival-input-acceptance.js
node scripts/verify-rival-input-source.js
node scripts/verify-rival-keyboard-source.js
node --test scripts/rival-input.test.js tests/rival.test.js
node scripts/verify-rival-input-setup-negative.js
node scripts/verify-rival-input-browser.js --output=.local/rival-input-FRESH
node scripts/verify-standard-wages-route.js --manifest=reference/rival-standard-route.json --output=.local/rival-standard-FRESH
node scripts/probe-rival-audio.js --device=speaker --output=.local/rival-speaker-FRESH
node scripts/probe-rival-audio.js --device=tandy --output=.local/rival-tandy-FRESH
```
