# Current port status

Updated 2026-10-31. **The whole game is incomplete.** Hard campaigns remain
deferred at the user's request. This is a playable port with remaining fidelity
and route-coverage work, not just final polish.

## Working playable route

Standard has a verified continuous winning route: startup/security/office →
flights → Too-Pei cave → Kenya Safari → Great Outback jungle → Lost World mountain
→ Atlantis, Klondike and Siberian caves → banking/rivals → day33 victory →
celebration/replay-No → all26 credits → finished screen → Restart. Banked24275
beats rival21000. This route was rerun after the latest cave audio changes.

HTML/CSS/vanilla JS with npm/Vite. Original files remain authoritative in ignored
`game/`; production users select their own originals. Nothing is pushed or deployed.

## Latest completed milestone

Cave terminal sounds now wait on actual global driver status. Mute cannot invent
completion; stale tokens and driver ticks cannot release the wait. Initial, pit
and return resets follow the original enabled guards. Room entry requests one
pit-warning or treasure-proximity cue; redraws remain silent. Runtime:`66d8f54`.
[Rules, evidence and limitations](cave-audio.md).

[Current saved acceptance](../reference/cave-audio-acceptance.json) passes:

- Four actual-browser speaker/Tandy cases, each enabled or muted during the pit
  ending. All traverse real passages, cue once per room, query the real driver,
  enter failure and Restart. Both enabled cases exercise busy→completion.
  Host20ms/Game16ms polling is conditional, not original timing acceptance.
- Unchanged strict muted cave failure:11 exact public-state/decoded-RGBA
  checkpoints,454 independent DOM events, Pause/Quit-No/map/retry/Restart, plus
  a missing-input negative.
- Unchanged strict muted winning Standard:170 exact public-state/decoded-RGBA
  checkpoints,6575 independent DOM events, victory/credits/Restart, plus a
  missing-selection negative. Neither replay has comparison exclusions.
- 194 units,130 component/device boundaries, production build,51 terminal-loop
  and499 call/rule source bytes, and retained conditional native cave checks.
  Missing queries/cues/completions and missing/corrupt/empty fixtures are rejected.

The preceding atomic milestone corrected global sound status during failed
transmitter travel. Its23-checkpoint muted report and four actual device cases
retain their historical runtime scope; its120 boundary checks are included in
this milestone's130. [Atomic travel](atomic-audio.md).

## Coverage and remaining work

| Family | Retained earlier Easy coverage | Current Standard winning route |
| --- | --- | --- |
| Jungle | All3 layouts complete in browser | Great Outback/layout2 treasure |
| Mountain | All3 layouts complete in browser | Lost World/layout0 summit |
| Cave | All8 component layouts;3 browser destinations | Too-Pei/7,Atlantis/3,Klondike/0,Siberia/4 treasures |
| Safari | All6 variants complete in browser | Kenya target photograph |

Earlier Easy/all-layout routes, Standard defeat, repair and rival-control browser
receipts retain their documented historical source scopes. They were not all
rerun for this milestone; older runtime guards intentionally reject newer code.
[History](status-history.md),[Standard route](standard-wages.md).

Next: extend actual browser audio coverage to natural cave capture/treasure
endings, then continue the remaining gameplay/input audit. Current natural audio
coverage is pit-only; the other terminal waits have component/static evidence.
Remaining sound-call adaptations also need review against the original.

Original movement cadence remains an open fidelity issue across expeditions.
Graphics work is modeled, but uninterrupted native whole-game timing, reveal
costs and some CPU/PIT phase are unverified. Cross-scene keys, modifier/BIOS
behavior, mouse/joystick parity, broader difficulties/destinations and arbitrary
campaign finishability need wider evidence. Hard's earlier second-flight race
loss remains unresolved and deferred. No save/load/high-score interface was
found in this build; these are not confirmed missing features.

## Sound, security and supported build

Tandy/PCjr includes Sound001 and persistent original channels/priorities. PC
speaker is the default. Keyboard S preserves native call ordering; physical
waveform/gain/filter parity and original sub-call IRQ phase remain unverified.
[Sound](speaker-audio.md),[S toggle](sound-toggle.md).

The unchecked **Original security system** option enables the surviving failure
path and logs the correct code once per challenge. Default play retains this
build's patched success. Independent unpatched-edition parity is unverified.
[Security](security.md).

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 little-endian16 real mode, overlays, no extender. Prepared analysis
images contain actual game code with documented transformations and are never run.

## Verification

```sh
# Current saved acceptance, including source proofs and conditional cave checks:
node scripts/verify-cave-audio-acceptance.js
node scripts/verify-cave-audio-setup-negative.js
node --test scripts/cave-audio.test.js tests/cave-timing.test.js
npm test
npm run build
# Fresh exact browser regressions; clean committed source and new ignored outputs:
node scripts/verify-cave-failure-input-browser.js --output=.local/failure-FRESH
node scripts/verify-standard-wages-route.js --manifest=reference/standard-winning-route.json --output=.local/winning-FRESH
# Fresh real device cases; repeat each device with enabled and muted:
node scripts/probe-cave-audio.js --device=speaker --mode=enabled --output=.local/cave-audio-FRESH
# Local development:
npm run dev
```

Missing/corrupt local artifacts fail setup. Required checkpoints, input sequences
and device events cannot be silently skipped. The original assets and proprietary
captures remain local; manifests, recipes and verification code are versioned.
