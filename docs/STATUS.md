# Current port status

Updated2026-10-31. **The whole game is incomplete.** The supported Standard
campaign has a complete playable route through all four expedition families,
victory,all26 credits,closed and Restart. That route's last independent replay
predates the latest cave loading/presentation restoration. A fresh whole-campaign
capture and independent replay are required before renewing its acceptance.
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

Producer `.local/cave-treasure-winning-browser-01` completed on sourcee59dd00:
183 checkpoints/7261 inputs,victory34650 to28500,all26 credits and Restart.
It remains historical and unaccepted because the new native comparison exposed
passage pose/torch attachment differences before independent replay. A corrected
producer and independent replay remain required. The new corrected candidate is
`.local/cave-passage-poses-winning-browser-01`;completion/replay are pending.

A separate fixed1770 native image check now matches all64000 pixels/256000 RGBA
bytes of the completed first treasure reveal,with altered-pixel/missing-checkpoint
negatives. Integration preserves all119 accepted runtime/configuration hashes.
[Image scope](cave-treasure-pixels.md). This is conditional capture alignment,not
whole-ending scanout or timing acceptance.

## Last independently accepted full route

Startup/security/office → Too-Pei cave → lost Safari race/rival claim → Kenya
photography → Great Outback jungle → Lost World mountain → Atlantis,Klondike,
Siberia caves → Novay mountain → banking → day31 victory34650 to28500 →
celebration → replay-No → all26 credits → closed → Restart.

Historical producer `.local/cave-order-winning-browser-01` and independent replay
`.local/cave-order-winning-replay-01` pass183 exact complete public-state/decoded-
RGBA checkpoints and7261 DOM events,seven awards/105 stripe groups and required
negative controls. Jungle and both mountains finish with3 lives. No game-state,
RNG,money or difficulty patch is used. The current combined gate correctly
rejects the subsequently changed cave runtime. [Historical acceptance](../reference/current-winning-acceptance.json),
[scenario](../reference/cave-order-winning-route.json),[history](current-winning-campaign.md).

## Remaining work

- Complete the fresh Standard capture,independent replay and combined acceptance.
- Resolve original movement/transition timing. Four cave phase states match all
  nine compared fields,but the strict timing/final-animation probe still fails.
  Loader/system,IRQ/BIOS/audio execution and CPU phase are not fully represented.
  Jungle,mountain and Safari have conditional native segment evidence;this does
  not establish whole-level or browser timing parity. [Cave](cave-native-cadence.md),
  [jungle](jungle-native-cadence.md),[mountain](mountain-phase.md),[Safari](safari-native-cadence.md).
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
# Historical whole-campaign gate currently rejects changed runtime as required:
node scripts/verify-current-winning-acceptance.js
npm run dev
```

Missing/corrupt fixtures,zero/incomplete cases,skipped checkpoints,unconsumed
required inputs and unexpected diagnostics fail verification. Proprietary assets,
captures and traces stay local;manifests,recipes and verification code are versioned.
