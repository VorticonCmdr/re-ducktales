# Current port status

**Active priority:movement speed.** Other integration/backlog work below is
deferred. See [current measurements and next experiment](movement-speed.md).

Updated2026-11-01. **The whole game is incomplete.** The supported Standard
campaign has a complete playable route through all four expedition families,
victory,all26 credits,closed and Restart. A fresh independent browser replay now
passes on the corrected cave loading,presentation and passage-pose runtime.
The subsequent PC-speaker gate-counter restoration changes one runtime file;
fresh audio/browser and campaign replay are pending before renewing acceptance.
Nothing is pushed or deployed. Hard campaigns remain deferred at the user's request.

## Current working behavior and verification

Cave initialization now stages original map/sprite loading before minimap/enemy
selection. Entry uses both original wipes and the second-page striped reveal.
Normal input restores the cached room without extra composition. Treasure uses
its original wipe/background load,two compositions,13 extra caller cache copies
and15 party/presentation calls. Counted resident decode/conversion work runs at
actual load boundaries;there is no fitted slowdown.

The historical source904519a scoped cave gate passed15 required checks:55 decoded
resources,source/conditional state comparisons,all221 unit tests,two actual
browser cases,loading and historical-method negatives,and production build.
The complete browser case covers flight,pit failure,retry without another flight,
all five treasure reveal bands,exact4500 award payment,map return and an owned
location visit. [Receipt](../reference/cave-treasure-order-admission.json),
[treasure scope](cave-treasure-order.md),[initialization](cave-initialization.md).
That receipt predates the passage-parameter correction and is scoped browser/
component acceptance,not native whole-cave timing. The corrected entry kinds and
Down/Up/Left exit poses match original caller bytes and a carried native state
comparison. [Parameters](cave-passage-parameters.md). The expanded18-check gate passes on sourceda9637f,including the actual browser
route,221 units,negative controls and build. [Receipt](../reference/cave-passage-poses-admission.json).

Corrected producer `.local/cave-passage-poses-winning-browser-01` completed on
source2a63b64:183 checkpoints/7261 inputs,victory34650 to28500,all26 credits and
Restart. Jungle and both mountain awards retain3 lives. Its seven awards pass105
exact stripe groups against independent retained/source-composed targets;all
three setup negatives reject. [Candidate](../reference/cave-passage-poses-winning-route.json).
The independent consumer `.local/cave-passage-poses-winning-replay-01` passes
all183 exact complete-state/decoded-RGBA checkpoints and7261 DOM inputs,omitted-
Standard negative and Restart. The combined current gate passes all221 units,
production build,seven awards,bank pixels and conditional native cave pose/
state/treasure-image checks. [Accepted cave runtime](../reference/cave-passage-poses-winning-acceptance.json).
The current gate rejects the later sound change until a fresh consumer completes.
Earlier e59dd00 remains historical because it predates the passage correction.

A separate fixed1770 native image check now matches all64000 pixels/256000 RGBA
bytes of the completed first treasure reveal,with altered-pixel/missing-checkpoint
negatives. Integration preserves all119 accepted runtime/configuration hashes.
[Image scope](cave-treasure-pixels.md). This is conditional capture alignment,not
whole-ending scanout or timing acceptance.

## Most recent independently accepted full route

Startup/security/office → Too-Pei cave → lost Safari race/rival claim → Kenya
photography → Great Outback jungle → Lost World mountain → Atlantis,Klondike,
Siberia caves → Novay mountain → banking → day31 victory34650 to28500 →
celebration → replay-No → all26 credits → closed → Restart.

Current producer `.local/cave-passage-poses-winning-browser-01` and independent
replay `.local/cave-passage-poses-winning-replay-01` complete this route. The
environment is Standard,BIOS seed0,muted audio,ordinary DOM keyboard controls.
There are no game-state,RNG,money or difficulty patches. This accepts the
recorded cave-runtime port-browser route,not arbitrary-route finishability or
original timing. Its source predates the later sound gate-counter correction.

Historical producer `.local/cave-order-winning-browser-01` and independent replay
`.local/cave-order-winning-replay-01` pass183 exact complete public-state/decoded-
RGBA checkpoints and7261 DOM events,seven awards/105 stripe groups and required
negative controls. Jungle and both mountains finish with3 lives. No game-state,
RNG,money or difficulty patch is used. Its historical gate correctly rejects
the subsequently changed cave runtime. [Historical acceptance](../reference/cave-order-winning-acceptance.json),
[scenario](../reference/cave-order-winning-route.json),[history](current-winning-campaign.md).

## Remaining work

- Complete fresh audio/browser and Standard regression after the source-backed
  [speaker note gate correction](speaker-note-gate.md). Three new conditional
  original cases match all7253 bytes and reject the historical implementation;
  the existing12-case/408-IRQ comparison and three stream cases still pass.
  The isolated audio candidate347bad1 now passes all seven browser cases and
  build;receipt registrationd8d901c is verified. Its two corrected S-key
  assertions preserve original stop0/off-click24 behavior. Integration waits
  for the live Standard consumer to finish with unchanged loaded test sources.
- Resolve original movement/transition timing. Four cave phase states match all
  nine compared fields,but the strict timing/final-animation probe still fails.
  Loader/system,IRQ/BIOS/audio execution and CPU phase are not fully represented.
  Jungle,mountain and Safari have conditional native segment evidence;this does
  not establish whole-level or browser timing parity. [Cave](cave-native-cadence.md),
  [jungle](jungle-native-cadence.md),[mountain](mountain-phase.md),[Safari](safari-native-cadence.md).
  The integrated paired sound-enable probe gives identical component movement
  in both modes;the flag alone does not explain the divergence. Separate timing
  research remains on codex/loader-environment,verified commit7382b6b:two natural
  original I/O captures,zero dropped records,and live speaker IRQ/resident code
  checks,and128 source IRQ-envelope branch cases plus a48-IRQ idle scenario
  counting959 driver instructions. An active observer validates80 source blocks,
  121 requests/229884 carried IRQs and the original12-case/408-IRQ/1128-write
  stream without changing state/events. Sixteen blocks remain static-only;
  BIOS/device costs and CPU/PIT phase remain unknown. The observer/decoder
  instrumentation changes are not integrated into the
  accepted runtime. Next milestone:account for original IRQ/system execution
  from captured initial state,then repeat the strict cadence comparison.
- Broaden campaign/path coverage and cross-scene input checks. Original modifier/
  BIOS behavior,repeat cadence,mouse/joystick parity and arbitrary campaign
  finishability remain unverified. Deferred Hard includes the second-flight race issue.
- Finish audio fidelity comparisons. Tandy/PCjr includes Sound001 and original
  channel priorities;actual speaker/Tandy probes produce sound and observe device
  completion. Physical waveform/gain/filter and sub-call IRQ parity remain open.
  [Sound](speaker-audio.md),[audio evidence](../reference/report-audio-observation-window.json).

The unchecked **Original security system** option enables the surviving failure
path and logs the correct code. Default play preserves this build's patched
success;unpatched-edition parity is unverified. [Security](security.md).
No save/load/high-score interface was found in this build;these are not confirmed
missing features. Earlier scoped receipts remain tied to their archived sources.

## Supported original and commands

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA256 is
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Analysis images are never run.
Originals remain authoritative in ignored `game/`;production users supply files.

```sh
# Fresh scoped cave acceptance;use a new ignored output directory:
node scripts/verify-cave-counted-loading.js --output=.local/cave-treasure-FRESH
# Fresh complete Standard producer,then declare its outputs and replay separately:
node scripts/standard-wages-explore.js --winning --bonus-novay --output=.local/standard-winning-FRESH
# Exact fixed native treasure image;separate from browser/timing acceptance:
node scripts/verify-cave-treasure-pixels.js
# Known failing timing probe;exploratory,not an acceptance gate:
node scripts/probe-cave-native-cadence.js
# Exploratory audio control;both underlying timing comparisons still fail:
node scripts/explore-cave-probe-audio-control.js
# Latest sound change correctly requires a new current consumer:
node scripts/verify-current-winning-acceptance.js
npm run dev
```

Missing/corrupt fixtures,zero/incomplete cases,skipped checkpoints,unconsumed
required inputs and unexpected diagnostics fail verification. Proprietary assets,
captures and traces stay local;manifests,recipes and verification code are versioned.
