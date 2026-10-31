# Current port status

Updated2026-10-31. **The whole game is incomplete.** The current Standard winning
campaign and report/audio gates pass. Original movement timing,broader route/input
fidelity and deferred Hard campaigns remain open. Nothing is pushed or deployed.

## Working route and current acceptance

Startup/security/office → Too-Pei cave → naturally lost Safari race/forced claim
→ Kenya photography → Great Outback jungle → Lost World mountain → Atlantis,
Klondike,Siberia caves → Novay mountain → banking → day31 victory34650 to28500 →
celebration → replay-No → all26 credits → closed → Restart.

Producer `.local/safari-hud-winning-browser-01` and independent consumer
`.local/safari-hud-winning-replay-01` pass183 exact complete public-state/decoded-
RGBA checkpoints and7261 independent DOM inputs. All required inputs/checkpoints
finish. The missing-Standard-selection negative and empty/missing/corrupt fixture
negatives reject. Seven awards pass105 exact stripe groups and75 retraces each;
six retained completed pages and original source composition provide independent
targets. Jungle and both mountain climbs finish with3 lives. No state restore,
RNG/money/difficulty patch or image exclusion is used.

The combined winning gate also passes original ending/credits comparisons,
source proofs,218 unit cases and production build. Runtime source is unchanged
by the later analysis/receipt commits. [Acceptance](../reference/current-winning-acceptance.json),
[scenario](../reference/safari-hud-winning-route.json),[history](current-winning-campaign.md).

Safari now charges its original HUD line/number work and preserves the signed
film formatter. The scoped admission passes28 source plans,22 carried scenarios,
899 input boundaries,2234 ordered images,218 units,two browser cases,two browser
negatives and build. This adds roughly0.37–0.46ms per background group;it does not
solve overall movement speed. [HUD scope](photography-hud-timing.md).

The final-bank signed sparkle rejection is corrected. Six conditional original
IT.DRV calls with real EGA output match exact320x200 RGBA,including signed wrap
and scanline carry. Actual consumed arguments,source bytes,code identity,frame
readiness,owned-emulator shutdown and eight negatives are checked. Natural whole-
bank timing and hidden-page aliasing remain unverified. [Bank](bank-sparkle-copy.md).

## Reports and sound

Current player/rival notices each pass27 checkpoints/543 inputs;forced claims
pass31/1795. All three compare58 intermediate state/pixel/time observations and
45 source stripe groups,with missing-Pause negatives and Restart. Their combined
gate passes85 checkpoints/2881 inputs/174 intermediate frames/135 stripe groups,
five setup negatives,218 units,21 reader-boundary cases and build. Reports retain
50 entry/75 total retraces,source-ordered RNG/flushes/cues and fresh speech-status
queries. [Implementation](report-presentation-implementation.md).

Actual speaker and Tandy probes produce nonzero signal,consume fresh status
queries,observe completion and restart. Tandy's valid run takes510 iterations;
the old500-step probe was too short for a reliable observation window. The revised
probe retains the same host20ms/Game16ms provider and allows1500 steps. An
intentional1-step negative fails and preserves actual Game/device state. No game
or audio-driver timing changed. [Window evidence](../reference/report-audio-observation-window.json).

Tandy/PCjr includes Sound001 and persistent original channels/priorities. PC
speaker is default. The winning replay is muted;actual audio probes are separate
conditional I/O evidence. Physical waveform/gain/filter,sub-call IRQ parity and
broader sound-call adaptations remain unverified. [Sound](speaker-audio.md).

## Original cadence and broader coverage

A new natural original Safari segment passes120 consecutive callback samples,
119 rendered-frame intervals,124 resident driver counts and18 post-drawing loop
completions. There are no debugger stops during measurement. Complete flight/
Safari code and source-derived driver self-modifications are checked;all owned
sessions close. Four observation negatives and three extra-FPU-source negatives
reject corruption. This is a roughly1.7-second neutral segment before the mission
timer starts,not port cadence or whole-level timing acceptance.
[Native recipe and limitations](safari-native-cadence.md).

| Family | Current winning route | Retained earlier coverage |
| --- | --- | --- |
| Jungle | Great Outback treasure,3 lives | All3 Easy layouts |
| Mountain | Lost World/Novay summits,3 lives | All3 Easy layouts |
| Cave | Too-Pei,Atlantis,Klondike,Siberia treasures | All8 component layouts;3 earlier browser destinations |
| Safari | Kenya target photograph | All6 earlier variants |

A conditional jungle search covers all3 layouts on Easy/Standard with12 authored
control profiles and1944 consumed reads. No game diagnostic is found;10 runs end
in translated failure and two reach the300-input bound. This is exploratory
component coverage,not native or browser acceptance. Its initial clock-adapter
failure is excluded. [Manifest](../reference/jungle-input-exploration.json).
Older captures keep their historical source scopes. Failed campaign candidates
remain local;only explicitly valid prefixes are reused by fresh startup input
replay. [Earlier milestones](status-history.md).

## Remaining work and supported build

The conditional Safari comparison now matches first-input gameplay state and18
completion RNG states from ENTRY memory/stack and independent neutral inputs.
Its1612.305ms completion span lies within the native1598.037..1626.573ms callback
brackets;original phase remains unknown,so this is not timing acceptance.
The new natural swamp reference records120 uninterrupted original callbacks with
fixed Right/release inputs. Scrooge moves X8→40 with three lives;all inputs finish
and the owned emulator closes. Five negatives and original code/asset checks pass.
Keyboard-table flush/repeat transitions are retained,not replaced by continuous
joystick Right. [Reference](jungle-native-cadence.md).
Next:compare jungle against that physical input schedule,then extend the reported
mountain/cave movement investigation. Resource/text costs,remaining
CPU/PIT phase and uninterrupted whole-game timing remain open. Cross-scene keys,
modifier/BIOS behavior,mouse/joystick parity and arbitrary campaign finishability
need more evidence. Hard's second-flight race issue remains deferred at the
user's request. No save/load/high-score interface was found in this build;these
are not confirmed missing features.

The unchecked **Original security system** option enables the surviving failure
path and logs the correct code once per challenge. Default play preserves this
build's patched success. Unpatched-edition parity is unverified. [Security](security.md).

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Prepared analysis images are
never run. Originals stay authoritative in ignored `game/`;production users
select their own files.

## Verification

```sh
node scripts/verify-current-winning-acceptance.js
node scripts/verify-report-presentation-acceptance.js
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_safari_cadence.py
node scripts/compare-safari-native-cadence.js
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_jungle_cadence.py
# Fresh independent winning replay;new ignored output:
node scripts/verify-standard-wages-route.js --manifest=reference/safari-hud-winning-route.json --output=.local/safari-hud-winning-replay-FRESH
# Fresh scoped Safari browser/source admission:
node scripts/verify-photography-hud-acceptance.js --output=.local/safari-hud-acceptance-FRESH
npm run dev
```

Missing/corrupt local artifacts fail setup. Required checkpoints,inputs and
device events cannot be silently skipped. Proprietary assets,captures and traces
remain local;permitted manifests,recipes and verification code are versioned.
