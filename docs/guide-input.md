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

Independent acceptance now passes all30 checkpoints/506 events and its semantic
omission negative. [Manifest](../reference/guide-input-acceptance.json).
The initial positive replay passed, but its omission run failed too early on the
deliberately missing event count. That failed attempt remains pinned and is not
acceptance. A fresh second consumer counted exactly the intentionally omitted
key against its modified negative stream, then required the state divergence at
`guide-pause`. Positive input counts, expected snapshots and pixels never changed.
Producer/runtime source is fac414b; corrected consumer tools are b918af3. Their
archives are separate, and current runtime identity is checked against each.

## Current-runtime regression

Fourteen older browser routes are compared with their immutable original port
recordings:313 full-state/image checkpoints,11,095 DOM events and14 Restarts.
They cover the full winning Easy campaign, Carlsbad, alternate mountains/jungles,
all six Safari variants and both atomic outcomes. The full headless campaign and
all8 cave components/2,696 presentations are also required. Earlier producer
archives are validated separately from the current consumer archive.

```sh
# Fast validation of the saved current acceptance:
node scripts/verify-guide-input-acceptance.js
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

The complete current regression also passed all14 historical browser routes,
313 checkpoints/11,095 events,8 cave components and the full headless campaign.
194 existing unit checks,22 focused guide/atomic boundary checks,5 conditional
original atomic comparisons and production build passed. Saved acceptance rejects
missing, duplicated, skipped or cancelled required test summaries. Three receipt
negatives reject zero browser cases, a missing guide checkpoint and corrupt
regression bytes; run them with:

```sh
node scripts/guide-input-acceptance-negatives.js --output=.local/guide-receipt-negatives-FRESH
```
