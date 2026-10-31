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

The winning Standard route passed two separate actual-browser runs:an exploratory
capture followed by a strict consumer of its independent DOM input stream. All170
complete public-state and decoded-RGBA checkpoints and6575 required events match.
The consumer also removes the Standard-selection input and must fail at the
selection checkpoint. Empty,missing and corrupt fixture controls are rejected.
The route includes all four expedition families,three additional cave treasures,
natural crash/loss recovery,winning celebration,replay-No,all26 credits,finished
screen and Restart. No game rules were changed to obtain the win.
[Winning route and evidence](standard-winning.md).

[Current saved acceptance](../reference/standard-winning-acceptance.json).
Capture:`e4f857a`;consumer:`e600150`. Runtime remains`cabc06c`,so the preceding
repair acceptance still validates the current runtime:21 crash/recovery
checkpoints/170 DOM events,two Pause omission negatives,unchanged Standard defeat
85/5071 with selection negative,194 units,77 dialogue boundaries,three invalid
setup controls,build and conditional original crash/calendar/cash/RNG evidence.
[Repair behavior](repair-input.md).

Original ending checks also pass:eight bank/winner/wait/replay checkpoints,four
exact PNGs and negative controls;credits checks cover nine original code/index/
pixel comparisons and26 independent port boundaries. This does not establish
native whole-campaign/reveal/drawing timing or audio/waveform parity. Browser
campaign controls are muted. All original/proprietary artifacts remain ignored;
missing local evidence fails setup rather than silently generating expectations.

Rival announcements retain actual audio status and deferred claim location;
shared awards/notices/guides/failure and repair readers remain implemented.
Older18 rival-control and11 cave-failure browser checkpoints,speaker/Tandy probes,
15 layout routes(343 checkpoints/11601 events),winning Easy campaign and eight
cave-component cases retain their documented historical scope. They were not all
rerun for this strategy-only milestone. [Rival evidence](rival-input.md),
[earlier result evidence](result-input.md).

## Coverage and remaining work

| Family | Earlier Easy coverage | Current Standard continuous route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure,three lives |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit,three lives |
| Cave | All8 component layouts;Klondike,Carlsbad,Too-Pei browser routes | Too-Pei/7,Atlantis/3,Klondike/0,Siberia/4 treasures |
| Safari | All6 variants complete in browser | Kenya target photograph |

Next:correct the known keyboard sound-off request order,then continue the audit
of remaining unsupported gameplay/input paths.
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
node scripts/verify-standard-winning-acceptance.js
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
