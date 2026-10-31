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

Rival announcements now use the source-derived ordinary input reader for normal
reports and lost-race claims. Rival location changes after the announcement,
speech uses actual sound status and 14-tick input boundaries, and Pause/Quit-No
resume the pending read even if speech ended in the modal. Synthetic audio resets
around this caller were removed. Runtime: `c5bf3f7`.
[Rival behavior and evidence](rival-input.md).

Current acceptance includes:

- Ordinary report and forced claim:18 exact state/image checkpoints,2,318 DOM
  events,Pause/Quit-No/fresh Fire/map/Restart,two missing-P negatives.
- Full Standard route:85 complete state/image checkpoints,5,071 unchanged input
  events,all four expedition families,race-loss recovery,bank/rival/deadline/
  defeat cover,Restart and a missing-selection negative. Two old snapshots were
  source-corrected to retain the rival's origin during the claim;all85 images and
  inputs remain unchanged. The fresh consumer compares complete new snapshots.
- Cave failure/retry rerun:11 exact checkpoints,454 events,Restart and a missing-P
  negative;cash$150,day2→3,no unlock,and retry without another flight.
- 194 units,59 result/guide/atomic/rival boundaries,three fixture setup negatives
  and production build.
- 154 rival caller plus282 ordinary-reader original/Ghidra bytes and declared
  relocations. Existing result caller/helper checks another567 original bytes.
- Actual speaker and Tandy device acknowledgements,nonzero output,speech
  completion,closing request and Restart under explicit conditional clock waits.

[Current saved acceptance](../reference/rival-input-acceptance.json).
Browser control comparisons are muted. Speech completion during Pause is covered
by conditional controller tests,not actual-device browser observation. Native
reveal/drawing costs and acoustic/clock parity remain unverified. An attempted
worklet-fetch interception failed and is excluded from acceptance;the documented
browser-tool limitation is recorded in the rival evidence document.

Shared40-read awards,100-read transmitter notices,30-read guides and20-read cave
failure portraits remain implemented. Older15 browser routes(343 checkpoints/
11,601 events),winning Easy campaign and8 cave-component replays were not rerun
in full for this rival change. Their immutable evidence remains historical;old
saved acceptance commands reject the changed runtime. [Earlier evidence](result-input.md).

## Coverage and remaining work

| Family | Earlier Easy coverage | Current Standard continuous route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure,three lives |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit,three lives |
| Cave | All8 component layouts;Klondike,Carlsbad,Too-Pei browser routes | Too-Pei treasure |
| Safari | All6 variants complete in browser | Kenya target photograph |

Next:translate flight repairs from the shared original input reader;the current
repair/wreckage countdowns omit some reader boundary behavior.
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
was not rerun for this rival change. Existing speaker/Tandy result probes
establish actual device I/O under their documented conditional ACK waits;physical
waveform/gain/filter parity remains unverified. The original general S-off
keyboard path requests0 then24 before clearing sound enable;the browser adapter
still omits that full click/IRQ boundary. [Sound](speaker-audio.md).

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
node scripts/verify-rival-input-acceptance.js
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
