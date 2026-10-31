# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain deferred
at the user's request.

## Work in progress: treasure result readers

Award40 and transmitter-notice100 now queue system keys at original read
boundaries and request click24 only for consumed Fire with enabled audio. The
local synthetic audio stop has been removed after inspecting original call order.
194 existing units and18 result boundary tests pass. Fresh browser/current-route
acceptance is pending; prior runtime-pinned receipts below remain historical.

## Working playable route

Easy startup → security/office → map/transport/departure → flight → jungle,
mountain, cave and Safari expeditions → rewards, banking/rivals → winning day31
ending → Restart. The earned atomic transmitter supports successful travel and
misdirection into real expeditions. The application uses HTML/CSS/vanilla JS and
npm/Vite. Original assets stay authoritative in ignored `game/`. Production users
select their own files. Nothing has been pushed or deployed.

## Latest completed behavior

The guide now follows original shared09f5(30): entry flush and immediate read,
seven-tick neutral waits, Pause/Quit-No resumption at the blocked read, and no
extra read after the final wait. A fresh Fire is required after modal input is
flushed. Guide RNG/clues/rendering and neutral snapshots remain unchanged.
Runtime fix: `fac414b`. Corrected browser-consumer tools: `b918af3`.
[Guide implementation, evidence and commands](guide-input.md).

Current acceptance passes:

- New earned guide route:30 exact full-state/image checkpoints,506 DOM events,
  Pause/Quit-No/fresh Fire,jungle entry,Restart and one semantic omission negative.
- All14 older browser routes against unchanged inputs/expectations:313 exact
  checkpoints,11,095 events and14 Restarts. These cover the winning campaign,
  Carlsbad,alternate mountains/jungles,all6 Safari variants and both atomic outcomes.
- Full headless campaign:34 checkpoints,4,981 events,1,470 flight presentations;
  all8 cave components:2,696 presentations.
- 194 existing units,22 guide/atomic boundary checks,5 conditional original atomic
  comparisons,original guide-byte proof and production build.
- Three receipt negatives reject zero cases,a missing guide checkpoint and corrupt
  evidence. The initial guide omission-accounting failure remains preserved; a
  fresh consumer passed the corrected semantic negative without recapturing outputs.

[Current acceptance manifest](../reference/guide-input-acceptance.json).
These are independent current-port regressions and scoped original/static checks,
not native whole-game timing or arbitrary-route completion proof.

## Coverage and remaining work

| Family | Easy coverage |
| --- | --- |
| Jungle | All3 layouts have complete browser treasure routes |
| Mountain | All3 layouts have complete browser summit routes |
| Cave | All8 complete in component replay;Klondike,Carlsbad and Too-Pei complete in browser routes |
| Safari | All6 variants complete target-photo/results/reward browser routes |

Next: the treasure-award dialogue still handles Pause before its original
40-read boundary. A browser probe and122 original bytes identify it. Original
C54..C67 also conditionally requests click24 on consumed Fire; that call is missing
from the current award completion integration. Its audible ordering remains to
be investigated. [Award investigation](award-input-investigation.md).

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
suite was not rerun for this guide-only input change. Physical waveform/gain/filter
parity remains unverified. [Sound](speaker-audio.md).

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
node scripts/verify-guide-input-acceptance.js
node scripts/verify-guide-input-investigation.js
node scripts/verify-award-input-investigation.js
# Focused checks and production build:
node --test scripts/guide-input.test.js scripts/atomic-input.test.js
npm test
npm run build
# Fresh independent guide replay,requires clean committed source:
node scripts/atomic-route.js verify --guide --capture=.local/guide-earned-browser-01 --output=.local/guide-replay-FRESH
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
