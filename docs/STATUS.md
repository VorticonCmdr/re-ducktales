# Current port status

Updated 2026-10-31. **The whole game is incomplete.** This is a playable port with
remaining timing,fidelity and route-coverage work. Hard campaigns remain deferred
at the user's request. Nothing has been pushed or deployed.

## Latest working route

Original report/notice presentations are integrated locally at17cb126,runtime
introduced at b0bfaac. Fresh Standard startup → security/office → Too-Pei cave
and award → ordinary rival report → player/rival collected-location notice →
Pause/resume → map → Restart works through actual browser controls. A separate
route banks the cave reward,flies to Safari,naturally loses its Standard race,
shows the forced claim and returns to the map/Restart.

The original portrait entry/reveal/exit sequence uses50 entry and75 total
retraces. Variant RNG occurs after portrait copy;early keys are flushed;6e
precedes reveal;21 and rival-location publication follow the exit wipe. Speech
status reads each use a fresh device query. Pixels never feed simulation.

Current combined acceptance passes:

- Three independent browser replays:85 exact complete-state/decoded-RGBA
  checkpoints,2881 independent DOM inputs,three missing-Pause negatives and
  actual Restart. Forced replay also compares58 intermediate report frame
  states,pixels and timestamps.
- Nine presentations/135 exact stripe groups against independently retained
  completed port targets. Missing groups,corrupt pixels and wrong incoming
  pages are rejected. Five missing/corrupt/empty/unfinished-input setup controls
  are rejected. No image exclusions or state injections.
- 210 unit cases,21 report/notice reader-boundary cases and production build.
- Actual PC speaker and Tandy report I/O:cue order,fresh status queries,real
  completion,nonzero audio output and Restart. Host20ms/Game16ms is a declared
  conditional profile,not native elapsed-time or waveform parity.
- 1238 original/prepared/Ghidra source bytes,16 relocations and one exact
  analysis stack-probe transformation establish original report call order.

[Acceptance manifest](../reference/report-presentation-acceptance.json),
[implementation and recipes](report-presentation-implementation.md),
[original source evidence](report-presentations.md).

## Retained gameplay coverage and remaining work

The earlier runtime357d83f earned-route receipt covers all four expedition
families and six treasures:Too-Pei cave → Kenya Safari → Great Outback jungle →
Lost World mountain → Atlantis/Klondike/Siberia caves → day25 bank27050 → Restart.
It passed129 exact checkpoints/6511 inputs and90 award stripe groups. Jungle and
mountain finished with3 lives each. Its later strategy lost normally on day31,
27050 to36000;that tail is excluded. [Scope and recipe](current-winning-campaign.md).

The last full winning receipt remains historical,runtime66d8f54:day33 victory,
24275 vs21000,replay-No,all26 credits,finished and Restart. Neither receipt proves
full-campaign acceptance on the newly integrated report runtime;fresh capture
and independent replay are required. Existing saved earned/award gates
intentionally reject changed runtime. The earlier cave award/audio receipt
(8 checkpoints/488 inputs plus11/454 failure replay) also retains its357d83f scope.
[Earned evidence](../reference/current-earned-acceptance.json),
[award evidence](../reference/award-presentation-acceptance.json),[history](status-history.md).

| Family | Retained browser coverage |
| --- | --- |
| Jungle | All3 Easy layouts;Standard Great Outback treasure |
| Mountain | All3 Easy layouts;Standard Lost World summit |
| Cave | All8 component layouts;Standard Too-Pei,Atlantis,Klondike,Siberia treasures |
| Safari | All6 earlier variants;Standard Kenya target photograph |

Next milestone:establish a current winning browser route and independent replay.
A fresh current-runtime capture again earned six treasures and banked27050,then
lost normally on day31 (`.local/report-timed-winning-browser-01`). A bounded
Novay investigation identified an arrow collision;adding16 neutral player reads
before the climb completed the conditional510-read route with3 lives. Replaying
startup inputs and carrying state through Novay then produced a day31 win,
34650 vs28500,and all26 credits in the port simulation. This is a candidate,
not browser acceptance. The actual browser then completed Novay with3 lives and
banked34650,but exposed an `Invalid framebuffer copy` dead end at the final bank.
The original permits a signed sparkle restore atY-13. A source-backed visible-
copy correction is committed on isolated `codex/current-campaign-player` at
179a307;218 units,original bank comparisons and build pass there. Its fresh
browser run is in progress before integration. Main retains the earlier runtime
and acceptance scope above. No game rules,difficulty,RNG or clocks were changed.

Original movement cadence remains open across expeditions. Graphics work is
modeled;resource/text costs,remaining CPU/PIT phase and uninterrupted native
whole-game timing are unverified. Other sound-call adaptations,expedition audio,
cross-scene keys,modifier/BIOS behavior,mouse/joystick parity and broader routes/
difficulties need more evidence. Hard's second-flight race issue remains deferred.
No save/load/high-score interface was found in this build;those are not confirmed
missing features.

## Sound,security and supported build

Tandy/PCjr includes Sound001 and persistent original channels/priorities. PC
speaker is the default. Physical waveform/gain/filter parity and original
sub-call IRQ phase remain unverified. [Sound](speaker-audio.md).

The unchecked **Original security system** option enables the surviving failure
path and logs the correct code once per challenge. Default play retains this
build's patched success. Unpatched-edition parity is unverified. [Security](security.md).

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Prepared analysis images
contain actual game code and are never run. Original files remain authoritative
in ignored `game/`;production users select their own originals.

## Verification

```sh
# Current saved browser evidence,fresh affected tests and production build:
node scripts/verify-report-presentation-acceptance.js
# Fresh independent DOM replay;clean committed source,new ignored output:
node scripts/replay-report-presentation-browser.js --manifest=reference/report-forced-browser.json --output=.local/report-forced-replay-FRESH
# Actual conditional audio I/O;repeat with --device=tandy:
node scripts/probe-rival-audio.js --device=speaker --output=.local/report-speaker-FRESH
# Next full-campaign exploration;capture alone is not acceptance:
node scripts/standard-wages-explore.js --winning --output=.local/current-winning-FRESH
npm run dev
```

Missing/corrupt local artifacts fail setup. Checkpoints,required inputs and device
events cannot be silently skipped. Proprietary assets/captures remain local;
permitted manifests,recipes and verification code are versioned.
