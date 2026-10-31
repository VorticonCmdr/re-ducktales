# Guide input wait

`ExpeditionBriefing` now translates shared09f5(30) instead of using the generic
legacy dialogue countdown. The game queues P/Q/S for the guide reader. Entry
clears old input and reads immediately; each neutral read waits seven driver
ticks, and the thirtieth wait exits without a thirty-first read. Pause and
Quit-No flush input and return to the blocked read before the next wait.
Guide RNG, clues, chapter rendering and neutral snapshot fields remain unchanged.

The original rule comes from388 checked bytes and the preserved Ghidra analysis
in [the pre-fix investigation](guide-input-investigation.md). No live original
chapter key/timing capture or exact chapter drawing-cost parity is claimed.
This change is limited to the guide. Other legacy dialogue waits retain their
own status and need targeted evidence before expansion.

## Browser route and external contract

The scenario uses normal Easy startup/security, Launchpad flight, Too-Pei cave7
and the Bombastium unlock to earn the transmitter. Six extra neutral initial cave
reads naturally cause its later Klondike request to misdirect to jungle location1.
After exercising the report controls, the player presses P and Fire on the guide.
At remaining204 there must be no overlay; at203 Pause blocks. Its35/7-tick
lock/resume leaves guide remaining203. Q+Fire opens Quit at196; N flushes that Fire.
The next neutral read reaches189 while still showing the guide. A fresh Fire then
enters the jungle. Restart must clear guide, keys and campaign state.

A UTC browser clock starts at1, BIOS seed0, muted audio and eight-millisecond
presentation callbacks. The recording controller observes current state to choose
its route. Independent replay consumes only the fixed506 DOM events; expected
full snapshots and RGBA hashes do not choose replay controls. All30 checkpoints
must match exactly, with no exclusions. There is no memory, seed, ownership or
recorded audio-status injection. Real live-audio behavior is outside this muted
scenario; sound-toggle consumption is covered by conditional reader tests.

The guide's first independent positive replay passed. Its initial omission run
failed too early on the deliberately missing event count, before the intended
state comparison. That failed attempt remains local and must not be called
acceptance. The corrected negative must allow exactly the one intentionally
omitted event in its input count and require divergence at `guide-pause`.
A fresh positive and corrected negative are required before acceptance.

## Current-runtime regression

Fourteen older browser routes are compared with their immutable original port
recordings:313 full-state/image checkpoints,11,095 DOM events and14 Restarts.
They cover the full winning Easy campaign, Carlsbad, alternate mountains/jungles,
all six Safari variants and both atomic outcomes. The full headless campaign and
all8 cave components/2,696 presentations are also required. Earlier producer
archives are validated separately from the current consumer archive.

```sh
node scripts/verify-guide-input-investigation.js
node --test scripts/guide-input.test.js scripts/atomic-input.test.js
npm test
npm run build
# Fresh route capture,only with clean committed source:
node scripts/atomic-route.js capture --guide --output=.local/guide-FRESH
# Fresh independent route comparison:
node scripts/atomic-route.js verify --guide --capture=.local/guide-earned-browser-01 --output=.local/guide-replay-FRESH
# Fresh current consumer of unchanged historical recordings:
node scripts/verify-preserved-routes.js --output=.local/preserved-FRESH
```

Capture alone never certifies itself. Each producer and consumer archives its
clean source. Missing/corrupt local artifacts, unfinished sequences, unsupported
behavior, unexpected errors or any state/pixel divergence fail verification.
Full original-game parity, arbitrary-route finishability, other difficulties and
absolute native timing do not follow from these cases. Hard remains deferred.
