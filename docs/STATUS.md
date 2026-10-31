# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain
deferred at the user's request. This is a playable port with remaining fidelity
and route-coverage work, not just final polish.

## Working playable routes and latest milestone

The current independent muted Standard route is startup/security/office →
Too-Pei cave → Kenya Safari → Great Outback jungle → Lost World mountain →
Atlantis,Klondike,Siberia caves → day25 bank27050 → Restart. It passes129 exact
complete-state/decoded-RGBA checkpoints and6511 independent DOM inputs,including
a missing-Standard-input negative. All six earned rewards pass90 exact row groups
and75 retraces each;the source-required black jungle exit has its own strict
contract. Empty/missing/corrupt fixtures and four pixel/source-page negatives are
rejected. Runtime:`357d83f`.
[Current earned-route acceptance](../reference/current-earned-acceptance.json),
[recipe and scope](current-winning-campaign.md).

The separate startup/cave award/transmitter/map/Restart route still passes with
muted audio,PC speaker and Tandy. Sound and the prompt begin only after reveal;
cash commits after portrait copy,and native flushes discard early keys.
[Award rules,evidence and limitations](award-presentation.md).

[Cave/audio saved acceptance](../reference/award-presentation-acceptance.json) passes:

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

| Family | Retained earlier Easy coverage | Current muted Standard earned route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit |
| Cave | All8 component layouts;3 browser destinations | Too-Pei/7,Atlantis/3,Klondike/0,Siberia/4 treasures |
| Safari | All6 variants complete in browser | Kenya target photograph |

Earlier Easy/all-layout routes, Standard defeat, repair and rival-control browser
receipts retain their documented historical source scopes. They were not all
rerun for this milestone; older runtime guards intentionally reject newer code.
[History](status-history.md),[Standard route](standard-wages.md).

Jungle421 reads and mountain671 reads complete with3 lives each. Corrected player
controls landed at Atlantis in the actual browser. Jungle's already-black exit
is required by Main01e0 cleanup(1201 verified bytes/45 relocations),not an image
exclusion. The producer's later campaign strategy lost normally,27050 to36000 on
day31;that tail is excluded from earned-route acceptance. A current full winning
route is still pending. An extra Novay mountain candidate landed,but its494-read
climbing attempt failed;its controls need work. No mechanics/difficulty were
changed to force success.

The next report-presentation restoration has a new strict1238-byte source check
(16 relocations,one explicitly checked analysis stack-probe replacement).
It confirms the shared portrait entry wipe,rival6e before reveal/input flush,
and21 after exit wipe. These transitions remain absent from the application.
[Source evidence and remaining work](report-presentations.md).

An isolated implementation now exists at `codex/report-presentations` commit
`1fea110`,based on7579426,checkout `/private/tmp/ducktales-report-presentations`.
Its `ReportPresentation` engine passes4 original-resource conditional checks:
copy/helper flush/cue before reveal,reader after50 retraces,external-reader exit
and caller after75 total retraces,clock separation and invalid operations.
It is not integrated into Game/rendering or browser accepted. The earned-route
replay is now complete and its browser/server closed. Next:integrate the report
engine and verify actual report/notice routes,then continue winning-route and
gameplay/input coverage. Entry audio/status and deferred post-helper variant RNG
require the explicit ordering recorded in that checkout's implementation document.
Component receipt:`.local/report-engine-checks-01` at1fea110. Other sound-call
adaptations and action-expedition audio routes still need review;natural capture
audio exploration is not strict current acceptance.

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
node scripts/verify-current-earned-acceptance.js
node scripts/verify-award-presentation-acceptance.js
node scripts/verify-award-presentation-negative.js
node scripts/verify-award-presentation-source.js
node scripts/verify-report-presentation-source.js
node scripts/verify-jungle-award-exit-source.js
node scripts/verify-current-winning-awards.js --manifest=reference/current-earned-awards.json
node --test tests/award-presentation.test.js scripts/result-input.test.js
npm test
npm run build
# Fresh exact browser regressions; clean committed source and new ignored outputs:
node scripts/verify-cave-failure-input-browser.js --output=.local/failure-FRESH
node scripts/verify-current-earned-route.js --output=.local/current-earned-replay-FRESH
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
