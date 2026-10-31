# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain deferred
at the user's request.

## Working playable route

Easy startup → security/office → map/transport/departure → flight → jungle,
mountain, cave and Safari expeditions → rewards, banking/rivals → winning day31
ending → Restart. The earned atomic transmitter supports successful travel and
misdirection into real expeditions. The application uses HTML/CSS/vanilla JS and
npm/Vite. Original assets stay authoritative in ignored `game/`. Production users
select their own files. Nothing has been pushed or deployed.

Standard Wages also has a continuous all-family playthrough through the day31
defeat cover and Restart. A winning Standard route is not established.

## Latest completed behavior

Standard Wages now has a continuous verified browser playthrough:Too-Pei cave →
bank → lost Safari race → claim/map recovery → Kenya target photo → bank → Great
Outback jungle treasure → Lost World mountain summit → $10,250 deposit total →
calendar/rival travel → day31 defeat cover against $36,000 → Restart. Jungle and
mountain both keep three lives. A fresh independent browser consumes5,071 DOM
events and matches all85 complete state/RGBA checkpoints. Omitting Standard
selection fails at the first checkpoint. Three setup negatives reject empty
checkpoints,missing fixtures and corrupt fixtures. One full playthrough is
verified;winning Standard routes,all Standard layouts,credits and original
timing parity do not follow from this route. No game rules changed for it.
[Standard route and commands](standard-wages.md).

Treasure awards now use original40-read waits and the transmitter explanation
uses100. Both flush on entry,read immediately,wait seven driver ticks per neutral
read,resume blocked Pause/Quit-No reads and omit the extra final read. Click0x24
is requested only for consumed Fire with enabled audio. Cue0x49/0x54 enable guards
and local audio call order now follow original bytes. Runtime:`0b6d2b5`.
[Result implementation and commands](result-input.md).

Current acceptance passes:

- Full Standard playthrough:85 exact state/image checkpoints,5,071 events,
  all four expedition families,race-loss recovery,bank/rival/deadline/defeat cover,
  Restart and one semantic plus three setup negatives. The earlier day13 route
  remains independently accepted with36 checkpoints/3,177 events.
- Earned award/explanation route:27 exact state/image checkpoints,488 DOM events,
  both message control loops,collection/unlock,map,Restart and1 semantic negative.
- All15 earlier browser routes against unchanged inputs/expectations:343 exact
  checkpoints,11,601 events and15 Restarts. These include the full winning Easy
  campaign,alternate expeditions,both atomic outcomes and the guide control route.
- Full Easy headless campaign:34 checkpoints,4,981 events,1,470 flight presentations;
  all8 cave components:2,696 presentations.
- 194 existing units,40 result/guide/atomic boundaries,567 original caller/helper
  bytes and production build. Three receipt negatives reject zero cases,a missing
  award checkpoint and corrupt evidence.
- Separate real PC-speaker/Tandy browser probes acknowledge0,0x24,0x54,0x24 and
  produce nonzero signal. Their host ACK waits pause the injected game clock;
  these are conditional device-I/O observations,not native audio timing/parity.

[Current acceptance](../reference/result-input-acceptance.json),
[audio boundary observations](../reference/result-audio-boundary.json).
These do not establish native whole-game timing or arbitrary-route completion.
The previously fixed30-read guide remains covered unchanged.

## Coverage and remaining work

| Family | Easy coverage |
| --- | --- |
| Jungle | All3 layouts have complete browser treasure routes |
| Mountain | All3 layouts have complete browser summit routes |
| Cave | All8 complete in component replay;Klondike,Carlsbad and Too-Pei complete in browser routes |
| Safari | All6 variants complete target-photo/results/reward browser routes |

Next fidelity milestone:translate the cave failure portrait's20-read input wait
and its conditional click,then investigate other legacy dialogues. A new source
check pins34 bytes from the original cave overlay and Ghidra after one loader
relocation. The port still uses a legacy140-tick countdown for this path;
it has not been fixed by the successful campaign route.
[Failure source](../reference/cave-failure-input-source.json). Hard remains deferred.

The first Standard Safari attempt lost its race at day7,tile92 of126. The
explorer initially stopped because it required an arrival. The accepted route
now consumes that normal claim,returns to map and completes another Safari;
this branch is not a dead end. [Initial exploration](../reference/standard-wages-exploration.json),
[accepted day13 continuation](../reference/standard-wages-acceptance.json),
[full Standard playthrough](../reference/standard-wages-full-acceptance.json).

Other legacy dialogues,cross-scene queued keys,modifier/BIOS behavior and
mouse/joystick parity need wider evidence. Broader destination/difficulty and
arbitrary-route finishability remain incomplete. The deferred Hard route loses
its second flight race for an unresolved reason. Native whole-game cadence,
chapter reveal costs,PIT sub-tick phase and parts of CPU/drawing timing remain
unverified. No save/load/high-score interface was found in this build; these are
not confirmed missing features and should not be invented.

## Sound and security

Tandy/PCjr includes Sound001,persistent channels,priorities,flight engine words,
mute and completion. PC speaker is the default with persistent IRQ/RNG/priority
logic. Historical acceptance covers7 browser cases and3 sound streams; that sound
suite was not rerun in full for this result change. The new result probes exercise
both real processors;physical waveform/gain/filter parity remains unverified. [Sound](speaker-audio.md).

The unchecked **Original security system** option restores the surviving failure
path and logs the correct code once per challenge. Default play keeps this build's
forced success. No independent unpatched-edition comparison is available.
[Security](security.md).

## Supported build and verification

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 little-endian16 real mode,overlays,no extender. Analysis images
contain actual game code with documented transformations and are never run.

```sh
# Validate saved current acceptance and scoped source/observation evidence:
node scripts/verify-standard-wages-acceptance.js --full
node scripts/verify-standard-wages-acceptance.js
node scripts/verify-standard-wages-setup-negative.js
node scripts/verify-standard-wages-route.js --manifest=reference/standard-wages-full-route.json --setup-negatives
node scripts/verify-cave-failure-input-source.js
node scripts/verify-result-input-acceptance.js
node scripts/verify-result-caller-source.js
node scripts/verify-result-audio-boundary.js
# Focused checks and production build:
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js
npm test
npm run build
# Fresh independent result replay,requires clean committed source:
node scripts/verify-standard-wages-route.js --manifest=reference/standard-wages-full-route.json --output=.local/standard-full-replay-FRESH
node scripts/verify-standard-wages-route.js --output=.local/standard-replay-FRESH
node scripts/atomic-route.js verify --award --capture=.local/result-earned-browser-01 --output=.local/result-replay-FRESH
# Fresh current consumer of immutable historical routes:
node scripts/verify-preserved-routes.js --output=.local/preserved-FRESH
# Local development:
npm run dev
```

Use fresh ignored output directories. Missing/corrupt local artifacts fail setup.
The older `npm run verify:current-campaign`,runtime gate and per-family source-pinned
receipt commands retain historical source guards and reject this runtime change;
they are not current acceptance. Current commands above preserve producer archives
separately from current consumers. Earlier milestone detail remains in
[status history](status-history.md) and subsystem documents.
