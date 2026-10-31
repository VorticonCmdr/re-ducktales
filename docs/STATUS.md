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

Keyboard S now preserves the original off0→hex24 and on0 calls. Both calls reach
the driver after the enabled flag changes;native batches add no stop-completion
barrier or retry. The speaker correctly rejects the lower-priority click at the
same device phase;Tandy plays it. Rival speech waits for actual completion after
mute,and muted reports query an existing device instead of inventing idle.
Runtime:`e994536`. [Sound-toggle behavior and limits](sound-toggle.md).

[Current saved acceptance](../reference/sound-toggle-acceptance.json) includes:

- Six conditional actual-browser audio scenarios:office S-off/on,muting during
  speech,and muted-entry status queries for speaker/Tandy;required real completion,
  original word order,priority outcomes,flag changes,map return and Restart.
- Two real-clock production-browser cases using the original file-picker folder
  and compiled speaker/Tandy worklets.
- Unchanged winning Standard:170 exact complete public-state/decoded-RGBA
  checkpoints,6575 independent DOM events,all four expedition families plus three
  cave treasures,victory/replay-No/all26 credits/finished screen/Restart,and a
  missing-selection negative. Fresh consumer:`e994536`.
- 194 units,91 dialogue/device boundaries,three missing/corrupt/empty-record
  negatives,build and original59-byte keyboard source proof. Existing native
  speaker-engine and carried Tandy-provider comparisons also pass within their
  declared scopes. [Winning route](standard-winning.md).

Browser audio acknowledgement frames are external inputs. Zero inserted IRQs
between native batch calls is an explicit boundary,not recovered original sub-call
CPU/PIT phase. The older host restart/title adaptation remains outside those
batches. Native whole-game timing,reveal/drawing costs,analog waveform/gain/filter
and all audio waiters are not established by this milestone. The checkbox remains
an explicit stop-only browser convenience.

Earlier repair acceptance(21 crash/recovery checkpoints/170 events),Standard defeat
85/5071,18 rival-control and11 cave-failure checkpoints,and older15 layout routes
(343 checkpoints/11601 events),winning Easy campaign and eight cave components
retain their historical scope. They were not all rerun for this sound change;old
saved runtime guards reject the changed source. Current91 boundaries and the full
winning browser route pass. [Repair evidence](repair-input.md),
[rival evidence](rival-input.md),[earlier result evidence](result-input.md).

## Coverage and remaining work

| Family | Earlier Easy coverage | Current Standard continuous route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure,three lives |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit,three lives |
| Cave | All8 component layouts;Klondike,Carlsbad,Too-Pei browser routes | Too-Pei/7,Atlantis/3,Klondike/0,Siberia/4 treasures |
| Safari | All6 variants complete in browser | Kenya target photograph |

Next:audit collected-location notices and investment broker input readers,then
continue broader gameplay/input coverage.
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
# Validate saved current-runtime evidence and source:
node scripts/verify-sound-toggle-acceptance.js
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
