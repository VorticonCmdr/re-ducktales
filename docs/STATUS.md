# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain
deferred at the user's request.

## Working playable routes

Easy startup → security/office → map/transport/departure → flight → jungle,
mountain,cave and Safari → rewards,banking/rivals → winning day31 ending → Restart
was accepted before the current failure-reader fix. Standard also has a continuous
all-family playthrough through the day31 defeat cover and Restart;its85 immutable
checkpoints have passed again against the current runtime. A winning Standard
route is not established. The earned transmitter supports successful travel and
misdirection into real expeditions.

HTML/CSS/vanilla JS,npm/Vite. Original assets remain authoritative in ignored
`game/`. Production users select their own files. Nothing is pushed or deployed.

## Latest completed behavior and current acceptance

Current integration: rival announcements now share the source-derived ordinary
input reader for normal reports and lost-race claims. A rival retains its origin
until the report finishes. Speech uses real status and 14-tick input boundaries;
Pause/Quit-No resume the pending read even if speech ended in the modal. Enabled
requests no longer include synthetic sound resets around this caller. The final
runtime correction is `c5bf3f7`; 194 existing units and 59 dialogue-boundary checks
pass. Fresh browser/audio verification is in progress; the earlier failure
acceptance below is historical and its saved runtime guard rejects this change.
See [rival input evidence and limitations](rival-input.md). The shared original
flight-repair reader is the next known countdown adaptation to investigate.

Cave failure portraits now use original shared09f5(20):entry flush,immediate
read,seven-tick neutral waits,no21st read,deferred P/Q/S and modal resumption.
Only consumed Fire with enabled audio requests click24. A fresh Fire is required
after Quit-No. Cash remains$150,day advances2→3,no treasure/transmitter unlock is
awarded,and same-location retry enters the cave without another flight.
Runtime:`9fc39b7`;independent browser consumers:`aef87cb`.
[Failure behavior and evidence](cave-failure-input.md).

Current acceptance includes:

- Failure/retry:11 exact complete state/RGBA checkpoints,454 DOM events,Restart
  and a missing-P negative that diverges specifically at Pause.
- Unchanged full Standard playthrough:85 exact state/image checkpoints,5,071
  events,all four expedition families,race-loss recovery,bank/rival/deadline/
  defeat cover,Restart and its missing-selection negative.
- 194 existing units,46 result/guide/atomic boundaries,three failure-fixture setup
  negatives and production build.
- Static failure caller:34 original/Ghidra bytes,one loader relocation,plus the
  entire11,054-byte cave body matching the original executable. Existing result
  caller/helper proof checks567 original bytes separately.

[Current acceptance](../reference/cave-failure-input-acceptance.json). Browser
failure controls are muted. Conditional simulation checks cover enabled/muted
click requests;this is not new native reveal/drawing timing or acoustic parity.

The previously accepted40-read award,100-read transmitter notice and30-read guide
remain implemented. The older15 browser routes(343 checkpoints/11,601 events),
winning Easy campaign and8 cave-component replays were not rerun in full for this
failure-only change. Their immutable evidence is retained;older saved acceptance
commands have historical source guards and reject the changed runtime. Use the
current commands below. [Earlier result evidence](result-input.md).

## Coverage and remaining work

| Family | Earlier Easy coverage | Current Standard continuous route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure,three lives |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit,three lives |
| Cave | All8 component layouts;Klondike,Carlsbad,Too-Pei browser routes | Too-Pei treasure |
| Safari | All6 variants complete in browser | Kenya target photograph |

Next:finish rival input/audio verification,then investigate flight repairs.
Cross-scene queued keys,modifier/BIOS behavior and
mouse/joystick parity need wider evidence. Broader destination/difficulty and
arbitrary-route finishability remain incomplete. Hard is deferred;its earlier
second-flight race loss is unresolved. Native whole-game cadence,chapter reveal
costs,PIT sub-tick phase and parts of CPU/drawing timing remain unverified.
No save/load/high-score interface was found in this build;these are not confirmed
missing features and should not be invented.

## Sound and security

Tandy/PCjr includes Sound001,persistent channels,priorities,flight engine words,
mute and completion. PC speaker is the default with persistent IRQ/RNG/priority
logic. Historical sound acceptance covers7 browser cases and3 streams;that suite
was not rerun for this failure change. Existing speaker/Tandy result probes
establish actual device I/O under their documented conditional ACK waits;physical
waveform/gain/filter parity remains unverified. [Sound](speaker-audio.md).

The unchecked **Original security system** option restores the surviving failure
path and logs the correct code once per challenge. Default play retains this
build's forced success. No independent unpatched-edition comparison is available.
[Security](security.md).

## Supported build and verification

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 little-endian16 real mode,overlays,no extender. Analysis images
contain actual game code with documented transformations and are never run.

```sh
# Validate saved current-runtime evidence and source:
node scripts/verify-rival-input-source.js
node scripts/verify-rival-keyboard-source.js
node scripts/verify-cave-failure-input-source.js
node scripts/verify-result-caller-source.js
node scripts/verify-rival-input-setup-negative.js
node scripts/verify-cave-failure-input-setup-negative.js
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js scripts/rival-input.test.js
npm test
npm run build
# Fresh browser comparisons;clean committed source and new ignored outputs:
node scripts/verify-cave-failure-input-browser.js --output=.local/failure-replay-FRESH
node scripts/verify-rival-input-browser.js --output=.local/rival-input-FRESH
node scripts/verify-standard-wages-route.js --manifest=reference/rival-standard-route.json --output=.local/standard-full-replay-FRESH
# Broader optional fresh regression against retained old routes:
node scripts/verify-preserved-routes.js --output=.local/preserved-FRESH
# Local development:
npm run dev
```

Missing/corrupt local artifacts fail setup. No checkpoints or required inputs may
be silently skipped. Earlier milestone details remain in
[status history](status-history.md),[Standard route](standard-wages.md) and the
subsystem documents.
