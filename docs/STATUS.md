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

## Latest completed behavior

Treasure awards now use original40-read waits and the transmitter explanation
uses100. Both flush on entry,read immediately,wait seven driver ticks per neutral
read,resume blocked Pause/Quit-No reads and omit the extra final read. Click0x24
is requested only for consumed Fire with enabled audio. Cue0x49/0x54 enable guards
and local audio call order now follow original bytes. Runtime:`0b6d2b5`.
[Result implementation and commands](result-input.md).

Current acceptance passes:

- Earned award/explanation route:27 exact state/image checkpoints,488 DOM events,
  both message control loops,collection/unlock,map,Restart and1 semantic negative.
- All15 earlier browser routes against unchanged inputs/expectations:343 exact
  checkpoints,11,601 events and15 Restarts. These include the full winning Easy
  campaign,alternate expeditions,both atomic outcomes and the guide control route.
- Full headless campaign:34 checkpoints,4,981 events,1,470 flight presentations;
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

Next playable milestone: establish a reproducible **Standard Wages** campaign
route and resolve the first unsupported behavior/dead end it exposes. That is
original difficulty1;its full campaign acceptance is not established. Hard remains
deferred. Failure-portrait20 and other legacy dialogue read boundaries also remain
separate fidelity gaps;the award/notice change does not claim to fix them.

Standard exploration now completes startup,flight,Too-Pei cave,treasure and
transmitter notice,rival reports,$3,400 deposit,return to map and Restart
(23 checkpoints,523 DOM events). A continuous Safari extension reaches a normal
lost race on its second flight:day7,tile92 of126,then rival-claim. That run stopped
because the exploratory player required an arrival;it is not proof of a port
dead end. The next experiment consumes the claim and continues the same campaign
to another Safari. [Exploration evidence](../reference/standard-wages-exploration.json).
These captures are not strict acceptance or a complete Standard campaign.

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
node scripts/verify-result-input-acceptance.js
node scripts/verify-result-caller-source.js
node scripts/verify-result-audio-boundary.js
# Focused checks and production build:
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js
npm test
npm run build
# Fresh independent result replay,requires clean committed source:
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
