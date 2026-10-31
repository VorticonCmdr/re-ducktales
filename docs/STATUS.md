# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain
deferred at the user's request.

## Working playable routes

Standard now has a verified continuous winning route:startup/security/office →
flights → Too-Pei cave → Kenya Safari → Great Outback jungle → Lost World mountain
→ Atlantis,Klondike and Siberian caves → banking/rivals → winning day33 ending →
celebration/replay-No → all26 credits → finished screen → Restart. Banked24275
beats rival21000. A separate day31 defeat route remains verified. The earned
transmitter supports successful travel and misdirection into real expeditions.
Earlier Easy winning/all-layout evidence is retained with its historical scope.

HTML/CSS/vanilla JS,npm/Vite. Original assets remain authoritative in ignored
`game/`. Production users select their own files. Nothing is pushed or deployed.

## Latest completed behavior and current acceptance

Collected-location notices now use the original input readers:player80,
rival status/input loop7 and fallback40;Pause/Quit-No continuation;actual device
status after mute;conditional clicks and rival-only exit stop. Runtime:`a978a14`.
[Notice behavior and reproduction](campaign-visits.md).

[Current saved acceptance](../reference/visit-input-acceptance.json) includes:

- Two independent muted browser routes:18 exact complete public-state/decoded-RGBA
  checkpoints,1062 DOM events,Pause,Quit-No,discarded old Fire,fresh Fire,map and
  Restart. Omitting Pause is rejected in each route.
- Four conditional actual-browser audio cases:muting during rival notice speech
  and entering while muted,for speaker/Tandy. Real status/completion drives each
  return;no injected audio status. Normal rival/market cleanup remains active.
- Unchanged winning Standard:170 exact complete public-state/decoded-RGBA
  checkpoints,6575 independent DOM events,all four expedition families plus three
  cave treasures,victory/replay-No/all26 credits/finished screen/Restart,and a
  missing-selection negative. Fresh consumer:`a978a14`.
- 194 units,99 dialogue/device boundaries,three missing/corrupt/empty-case
  negatives,build,192 original/prepared/Ghidra notice bytes and the existing
  shared-reader/keyboard proofs. The conditional original retry segment still
  passes with its three negative controls. [Winning route](standard-winning.md).

Keyboard S retains the previous original off0→hex24 and on0 sequencing. Native
batches add no host completion barrier or retry. The previous six audio cases and
two production-browser cases retain their `e994536` historical scope;the older
saved sound-toggle gate rejects the changed runtime. Current99 boundaries include
its14 focused toggle checks,and the notice cases exercise actual speaker/Tandy
status. [Sound-toggle behavior and limits](sound-toggle.md).

Browser audio acknowledgement frames are external inputs. Zero inserted IRQs
between native batch calls is an explicit boundary,not recovered original sub-call
CPU/PIT phase. The older host restart/title adaptation remains outside those
batches. Native whole-game timing,reveal/drawing costs,analog waveform/gain/filter
and all audio waiters are not established by this milestone. The checkbox remains
an explicit stop-only browser convenience.

Earlier repair acceptance(21 crash/recovery checkpoints/170 events),Standard defeat
85/5071,18 rival-control and11 cave-failure checkpoints,and older15 layout routes
(343 checkpoints/11601 events),winning Easy campaign and eight cave components
retain their historical scope. They were not all rerun for this notice change;old
saved runtime guards reject the changed source. Current99 boundaries and the full
winning browser route pass. [Repair evidence](repair-input.md),
[rival evidence](rival-input.md),[earlier result evidence](result-input.md).

## Coverage and remaining work

| Family | Earlier Easy coverage | Current Standard continuous route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure,three lives |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit,three lives |
| Cave | All8 component layouts;Klondike,Carlsbad,Too-Pei browser routes | Too-Pei/7,Atlantis/3,Klondike/0,Siberia/4 treasures |
| Safari | All6 variants complete in browser | Kenya target photograph |

Next:restore the broker confirmation reader. Broker overlay10's50-read wait and conditional
click are verified against42 original/prepared/Ghidra bytes;implementation is
pending. Continue broader gameplay/input coverage afterward.
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
was not rerun in full for this sound change. Existing speaker/Tandy result probes
establish actual device I/O under their documented conditional ACK waits;physical
waveform/gain/filter parity remains unverified. The keyboard S-off
call order and device priority handling are now corrected;sub-call native IRQ
phase and the broader legacy stop/start adaptation remain unverified. [Sound](speaker-audio.md).

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
# Validate saved current-runtime acceptance and source:
node scripts/verify-visit-input-acceptance.js
node scripts/verify-visit-input-source.js
node scripts/verify-broker-input-source.js
node --test scripts/visit-input.test.js tests/visits.test.js
node scripts/verify-collected-notice-browser.js --output=.local/notice-replay-FRESH
node scripts/verify-visit-input-setup-negative.js
# Existing source proofs:
node scripts/verify-sound-toggle-source.js
node scripts/verify-sound-toggle-setup-negative.js
node scripts/verify-repair-input-source.js
node scripts/verify-rival-input-source.js
node scripts/verify-rival-keyboard-source.js
node scripts/verify-cave-failure-input-source.js
node scripts/verify-result-caller-source.js
node scripts/verify-repair-input-setup-negative.js
node scripts/verify-cave-failure-input-setup-negative.js
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js scripts/rival-input.test.js scripts/repair-input.test.js scripts/sound-toggle.test.js
npm test
npm run build
# Fresh browser comparisons;clean committed source and new ignored outputs:
node scripts/verify-standard-wages-route.js --manifest=reference/standard-winning-route.json --output=.local/standard-winning-replay-FRESH
node scripts/verify-cave-failure-input-browser.js --output=.local/failure-replay-FRESH
node scripts/verify-repair-input-browser.js --output=.local/repair-input-FRESH
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
