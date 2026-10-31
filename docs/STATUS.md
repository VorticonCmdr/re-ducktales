# Current port status

Updated 2026-10-31. **The whole game is incomplete.** A complete Standard winning
route is now independently browser-verified on the current port. Movement/timing,
broader route/input/audio fidelity and deferred Hard campaigns remain open.
Nothing has been pushed or deployed.

## Current working route and acceptance

Startup/security/office → Too-Pei cave → naturally lost Safari race/forced claim
→ Kenya photography → Great Outback jungle → Lost World mountain → Atlantis,
Klondike,Siberia caves → Novay mountain → banking → day31 victory,34650 vs28500 →
celebration → replay-No → all26 credits → closed → Restart.

The current runtime includes the source-ordered report restoration and the bank
copy correction introduced at179a307. Producer `.local/report-timed-winning-browser-03`
and independent consumer `.local/report-timed-winning-replay-01` pass183 exact
complete-state/decoded-RGBA checkpoints and7261 independent DOM inputs. All
required events/checkpoints finish;removing Standard selection causes the expected
state mismatch. Empty/missing/corrupt fixture negatives also reject setup.

Seven earned awards pass105 exact stripe groups and75 retraces each. Six earlier
completed port pages independently cross-check the original picture/font/text
composition;Novay's7500 page uses that composition and a wrong-value negative.
Jungle's exact black incoming page is required by its original exit code,not an
image exclusion. The jungle and both mountain climbs finish with3 lives.

The final bank previously stopped on a valid original signed sparkle copy at
Y-13. Its visible copy now preserves the original unsigned clipping,DL row
counter and16-bit byte addressing. Six conditional original IT.DRV calls with
real EGA output match exact full320x200 RGBA,including signed wrap and scanline
carry. Actual argument stacks,source bytes,code identity,frame readiness and
private-emulator shutdown are checked;eight negatives reject corrupt/missing or
unfinished/stale cases. Natural whole-bank timing and hidden-page aliasing remain
unverified. [Bank correction and native recipe](bank-sparkle-copy.md).

The combined current winning gate also passes218 unit cases,production build,
original ending/credits comparisons and the source proofs. There are no image
exclusions,state restores,RNG/money patches or difficulty changes in this route.
[Winning acceptance](../reference/current-winning-acceptance.json),
[scenario](../reference/report-timed-winning-route.json),[route history](current-winning-campaign.md).

## Reports,audio and retained coverage

Ordinary reports,forced claims and collected notices implement50 entry/75 total
retraces,deferred variant RNG,original early-key flushes,6e before reveal and21/
location publication after exit. Speech status reads have fresh device queries.
The current player-notice replay passes27 exact checkpoints/543 inputs,all58
intermediate state/pixel/time comparisons,45 stripe groups,Pause-negative and
Restart. Rival/forced report and real speaker/Tandy receipts are being refreshed
for the bank-corrected runtime. The earlier85-checkpoint/2881-input report gate
belongs to runtime b0bfaac;its old consumer guards intentionally reject this
changed runtime until the refresh is complete.
[Report implementation](report-presentation-implementation.md).

Tandy/PCjr includes Sound001 and persistent original channels/priorities. PC
speaker is the default. The current full winning route is muted. Earlier actual
report audio probes retain their source scope and conditional host20ms/Game16ms
profile;physical waveform/gain/filter and sub-call IRQ parity remain unverified.
[Sound](speaker-audio.md).

| Family | Current winning route | Retained earlier coverage |
| --- | --- | --- |
| Jungle | Great Outback treasure,3 lives | All3 Easy layouts |
| Mountain | Lost World and Novay summits,3 lives | All3 Easy layouts |
| Cave | Too-Pei,Atlantis,Klondike,Siberia treasures | All8 component layouts;3 earlier browser destinations |
| Safari | Kenya target photograph | All6 earlier variants |

Older earned/award/full-winning receipts retain their documented historical
runtime scopes. Failed candidates are retained locally:the default six-treasure
strategy loses normally27050 to36000;the first Novay browser attempt exposed the
bank error. Only explicitly declared valid prefixes of those recordings are
reused,always by fresh startup input replay. [History](status-history.md).

## Remaining work and supported build

Next:finish current report/audio receipt refresh,then broaden gameplay/input
coverage and validate expedition movement cadence against the original.
Resource/text costs,remaining CPU/PIT phase and uninterrupted native whole-game
timing are unverified. Other sound-call adaptations,cross-scene keys,modifier/
BIOS behavior,mouse/joystick parity and arbitrary campaign finishability need
more evidence. Hard's second-flight race issue remains deferred at the user's
request. No save/load/high-score interface was found in this build;those are
not confirmed missing features.

The unchecked **Original security system** option enables the surviving failure
path and logs the correct code once per challenge. Default play retains this
build's patched success. Unpatched-edition parity is unverified. [Security](security.md).

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Prepared analysis images
contain actual game code and are never run. Originals remain authoritative in
ignored `game/`;production users select their own files.

## Verification

```sh
# Current saved winning evidence,fresh unit suite and production build:
node scripts/verify-current-winning-acceptance.js
node scripts/verify-bank-copy-pixels.js
node scripts/verify-report-presentation-rows.js --manifest=reference/current-report-player-rows.json
# Fresh independent winning replay;clean source,new ignored output:
node scripts/verify-standard-wages-route.js --manifest=reference/report-timed-winning-route.json --output=.local/current-winning-replay-FRESH
npm run dev
```

Missing/corrupt local artifacts fail setup. Required checkpoints,inputs and
native/device events cannot be silently skipped. Proprietary assets,captures and
traces remain local;permitted manifests,recipes and verification code are versioned.
