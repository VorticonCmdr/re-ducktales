# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain
deferred at the user's request. This is a playable port with remaining fidelity
and route-coverage work, not just final polish.

## Working playable routes and latest milestone

The current earned route is startup/security/office → flight → cave treasure →
original75-retrace award presentation → transmitter explanation → collected map
→ Restart. It passes with muted audio,PC speaker and Tandy. The reward sound and
input prompt begin only after reveal;cash commits after portrait copy,and native
flushes discard keys from both the expedition and presentation. Runtime:`357d83f`.
[Rules,evidence and limitations](award-presentation.md).

[Current saved acceptance](../reference/award-presentation-acceptance.json) passes:

- All15 row groups and75 retraces in each browser case,exact completed reward
  pixels,cash400→3400,actual device query/reset/second49,collection and Restart.
  Audio host20ms/Game16ms polling is conditional,not original timing parity.
- Independent strict muted award replay:8 complete state/decoded-RGBA checkpoints,
  488 DOM events and a missing-Fire negative. Unchanged cave failure:11 exact
  checkpoints/454 events and a missing-Pause negative. No replay exclusions.
- 201 units,130 component/device boundaries,build,403 original/prepared/Ghidra
  source bytes/8 relocations,the inherited366-byte dispatcher and retained
  conditional native cave checks. Missing/corrupt/empty evidence and missing
  row groups,pixels,queries or cue calls are rejected.

The last full Standard winning receipt is historical,runtime66d8f54:startup →
Too-Pei cave → Kenya Safari → Great Outback jungle → Lost World mountain →
Atlantis,Klondike,Siberia caves → banking/rivals → day33 victory(24275 vs21000) →
replay-No → all26 credits → finished → Restart. The new source-correct award
sequence intentionally changes its fixed timestamps. Fresh full-campaign
recording/replay is required;the old170-checkpoint receipt is not current acceptance.

Cave global sound waits,guarded resets and room-entry pit/treasure cues remain
implemented. The earlier four pit audio cases retain their historical source
scope;the current award routes exercise treasure sound and the failure replay
still matches. [Cave audio](cave-audio.md),[atomic travel](atomic-audio.md).

HTML/CSS/vanilla JS with npm/Vite. Original files remain authoritative in ignored
`game/`;production users select their own originals. Nothing is pushed or deployed.

## Coverage and remaining work

| Family | Retained earlier Easy coverage | Historical Standard winning route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit |
| Cave | All8 component layouts;3 browser destinations | Too-Pei/7,Atlantis/3,Klondike/0,Siberia/4 treasures |
| Safari | All6 variants complete in browser | Kenya target photograph |

Earlier Easy/all-layout routes, Standard defeat, repair and rival-control browser
receipts retain their documented historical source scopes. They were not all
rerun for this milestone; older runtime guards intentionally reject newer code.
[History](status-history.md),[Standard route](standard-wages.md).

Next: fresh jungle/mountain award browser routes and full-campaign coverage with
the restored timing,then the remaining report presentations and gameplay/input
audit. Actual new award acceptance is cave-only;action-expedition application
checks are conditional. Natural capture audio exploration reached result/Restart
but is not strict current acceptance. Other sound-call adaptations need review.

Fresh Standard exploration has now completed jungle421 reads and mountain671
reads with3 lives each,including their4000/2000 rewards and map return. Corrected
player controls landed at Atlantis in the actual browser;Atlantis,Klondike and
Siberia treasures all completed. All90 reward row groups match their independent
retained completed-page targets. Jungle's already-black exit page is required by
the original Main01e0 cleanup(1201 verified bytes/45 relocations),not an image
exclusion. A fresh129-checkpoint/6511-input startup-to-bank25 replay is pending.
The subsequent campaign strategy lost normally,27050 to36000 on day31;it is not
a current winning receipt. An extra Novay mountain is the next conditional
winning strategy. Runtime is still357d83f;these changes affect player/verification
tools and source evidence.
[Current experiment recipe](current-winning-campaign.md).

The next report-presentation restoration has a new strict1238-byte source check
(16 relocations,one explicitly checked analysis stack-probe replacement).
It confirms the shared portrait entry wipe,rival6e before reveal/input flush,
and21 after exit wipe. These report transitions remain unimplemented.
[Source evidence and remaining work](report-presentations.md).

Original movement cadence remains an open fidelity issue across expeditions.
Graphics work is modeled, but uninterrupted native whole-game timing, reveal
costs and some CPU/PIT phase are unverified. Cross-scene keys, modifier/BIOS
behavior, mouse/joystick parity, broader difficulties/destinations and arbitrary
campaign finishability need wider evidence. Hard's earlier second-flight race
loss remains unresolved and deferred. No save/load/high-score interface was
found in this build; these are not confirmed missing features.

## Sound, security and supported build

Tandy/PCjr includes Sound001 and persistent original channels/priorities. PC
speaker is the default. Keyboard S preserves native call ordering; physical
waveform/gain/filter parity and original sub-call IRQ phase remain unverified.
[Sound](speaker-audio.md),[S toggle](sound-toggle.md).

The unchecked **Original security system** option enables the surviving failure
path and logs the correct code once per challenge. Default play retains this
build's patched success. Independent unpatched-edition parity is unverified.
[Security](security.md).

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 little-endian16 real mode, overlays, no extender. Prepared analysis
images contain actual game code with documented transformations and are never run.

## Verification

```sh
# Current saved acceptance and strict fixture negatives:
node scripts/verify-award-presentation-acceptance.js
node scripts/verify-award-presentation-negative.js
node scripts/verify-award-presentation-source.js
node scripts/verify-report-presentation-source.js
node --test tests/award-presentation.test.js scripts/result-input.test.js
npm test
npm run build
# Fresh exact browser regressions; clean committed source and new ignored outputs:
node scripts/verify-cave-failure-input-browser.js --output=.local/failure-FRESH
node scripts/award-route.js --device=muted --output=.local/award-muted-FRESH
node scripts/award-route.js --verify --capture=.local/award-muted-FRESH --output=.local/award-replay-FRESH
# Fresh real device cases; repeat each device with enabled and muted:
node scripts/probe-cave-audio.js --device=speaker --mode=enabled --output=.local/cave-audio-FRESH
# Local development:
npm run dev
```

Missing/corrupt local artifacts fail setup. Required checkpoints, input sequences
and device events cannot be silently skipped. The original assets and proprietary
captures remain local; manifests, recipes and verification code are versioned.
