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

Flight repairs and wreckage search now use original shared09f5(60/100) instead
of simplified countdowns. They flush input on entry,read immediately,wait seven
driver ticks on neutral,sample P/Q/S at those reads,and resume the pending read
after Pause/Quit-No. A fresh Fire is required after a modal and between the two
announcements. Only consumed Fire with enabled sound requests24. The original
cash-loss/RNG calculation is unchanged. Runtime:`cabc06c`.
[Repair behavior and evidence](repair-input.md).

Current acceptance includes:

- Two real Easy crash/recovery routes:21 exact complete state/image checkpoints,
  170 DOM events,Pause/Quit-No/fresh Fire,cave entry,Restart and two missing-P
  negatives. Cash0 skips wreckage;earned2800 becomes2100 after a700 loss.
- Unchanged full Standard route:85 complete state/image checkpoints,5,071 inputs,
  all four expedition families,race-loss recovery,bank/rival/deadline/defeat
  cover,Restart and a missing-selection negative. The source-corrected rival
  fixture from the preceding milestone remains unchanged.
- 194 existing units,77 result/guide/atomic/rival/repair boundary checks,three
  fixture setup negatives and production build.
- 119 original/Ghidra repair-caller bytes and three declared relocations;existing
  shared-reader/caller and keyboard proofs check567 and282 bytes separately.
- Existing original crash/calendar/repair segment:four conditional checkpoints,
  27 presentations and three negative controls still pass,including cash50→25.

[Current saved acceptance](../reference/repair-input-acceptance.json).
Browser repair controls are muted;enabled click requests are checked in conditional
simulation. This is not native reveal/drawing cost,clock/audio phase or acoustic
parity. Expected outputs never select replay inputs;missing local fixtures fail
setup. Both failed exploration/setup attempts remain separate from acceptance.

Rival announcements retain their shared reader,actual sound status and deferred
claim location. The preceding18 rival-control checkpoints,11 failure/retry
checkpoints and real speaker/Tandy probes were not rerun in full for this repair
change. Their evidence remains historical;old saved runtime guards reject this
change. Current boundary tests and the complete Standard route pass.
[Rival evidence](rival-input.md).

Shared40-read awards,100-read transmitter notices,30-read guides and20-read cave
failure portraits remain implemented. Older15 browser routes(343 checkpoints/
11,601 events),winning Easy campaign and8 cave-component replays also remain
historical. [Earlier evidence](result-input.md).

## Coverage and remaining work

| Family | Earlier Easy coverage | Current Standard continuous route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure,three lives |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit,three lives |
| Cave | All8 component layouts;Klondike,Carlsbad,Too-Pei browser routes | Too-Pei treasure |
| Safari | All6 variants complete in browser | Kenya target photograph |

Next:establish a winning Standard campaign and audit remaining unsupported
gameplay paths;the current full Standard route deliberately ends in defeat.
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
was not rerun for this repair change. Existing speaker/Tandy result probes
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
node scripts/verify-repair-input-acceptance.js
node scripts/verify-repair-input-source.js
node scripts/verify-rival-input-source.js
node scripts/verify-rival-keyboard-source.js
node scripts/verify-cave-failure-input-source.js
node scripts/verify-result-caller-source.js
node scripts/verify-repair-input-setup-negative.js
node scripts/verify-cave-failure-input-setup-negative.js
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js scripts/rival-input.test.js scripts/repair-input.test.js
npm test
npm run build
# Fresh browser comparisons;clean committed source and new ignored outputs:
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
