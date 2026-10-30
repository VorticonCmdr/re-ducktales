# Current port status

Updated 2026-10-30. **The whole game is incomplete. This is completion work,
not only fine-tuning.** Selected routes are playable; arbitrary-route
finishability and full original-game parity remain unproven.

## Working application

HTML/CSS/vanilla JavaScript with npm/Vite connects office/security, map and
transport selection, departures, flight, all four expedition families, rewards,
rival reports, banking and both campaign endings. Original assets remain
authoritative in ignored `game/`; production visitors select their own files.
Nothing has been pushed or deployed.

The unchecked **Original security system** option restores the surviving failure
path and logs the correct code once per challenge. Default play retains this
executable's forced success. This is static restoration from the patched build,
not comparison with an independently obtained unpatched edition. [Evidence](security.md#optional-restoration).

Tandy/PCjr includes Sound 001, persistent channels, priorities, engine words, mute
and completion; all 121 public requests have viewer playback. Speaker playback
is the default. Physical waveform/gain/filter parity remains open. [Audio](audio.md).

## Current verified milestone

The cave now charges original party-helper and sprite work before continuing,
including overwritten draws. Focused checks pass: the conditional original
input/deadline interval, code/state/image comparisons, passage/ending replays,
132 unit cases, the full browser flight/failure/retry/treasure route, browser
Pause/input checks and an omitted-work negative. `npm run verify:cave-timing`
passed on `1dc1285`, including the production build, with zero skipped cases.
The 627-file source archive, runner and logs are pinned in the
[verification receipt](../reference/cave-drawing-integration.json).
[Cave timing contract](cave-timing.md).

`npm run verify:jungle-draw-timing` passed on `f6d0f05`: original jungle
map/routine/pixel comparisons, the independent Python map oracle, both migrated
component regressions, six original drawing-work cases, all 127 unit tests,
two actual browser cases, both browser negatives and the production build.
Zero unit/browser cases were skipped. [Verification record](../reference/jungle-component-migration.json).

Jungle charges actual source sprite/copy work against explicit simulation time
before presentation. Full redraws cost about 162–178 ms in six conditional native
drawing cases; the minimum three-driver-count deadline is retained. The complete
browser treasure route has 27 exact full-state/picture checkpoints, 70 DOM events
and 860 movement samples, returning $1,050 on day 17 with one life. Missing required
movement and bypassed drawing time both fail. [Timing contract](jungle-timing.md).

The older 824-input failure and 792-input success contracts remain intact. Their
historical class first reproduces all prior expected values. The current class
then preserves 1,616 complete source input-boundary DS comparisons except three
separately checked timer words, 1,714 ordered image payloads/modes/wipe tokens,
40 gameplay checkpoints and both final gameplay outcomes. Seventeen negative
controls pass. **Game/browser runtime code is unchanged by this migration.**
[Comparison rules](jungle-component-timing.md).

After the cave/Scheduler changes, `npm run verify:jungle-core` still passes its
original comparisons, both component contracts and the independent map oracle.
Its complete browser source receipt needs refresh for the new shared sources.
Mountain sprite pacing and its complete summit/browser route passed their earlier
`ce112a8` milestone. Its current source receipt and older complete Easy/Hard
campaign receipts need refresh after shared runtime changes. Those historical
passes do not establish a green current broader gate. [Earlier milestones](status-history.md).

## Remaining work

- Measure and correct safari drawing work. Mountain copy/text/line and other
  CPU/device costs, and jungle line/text/remaining CPU costs, are still omitted.
  Cave omits minimap fills, room composition, copies outside the party helper
  and remaining CPU/device costs; its measured budget is partial.
  Cave's first treasure reveal also substitutes a normal page presentation for
  the original striped reveal.
- Finish the destination's autonomous neutral polling, draw/flush/read window
  and deferred system-key polling. Browser reads currently follow external makes;
  the original recurring loop is incomplete. Original first-map drawing and exact
  video/cache phase alignment remain open. [Destination scope](destination-keyboard.md).
- Connect the original expedition release-edge direction. Broader destination/
  difficulty routes, original whole-scene/campaign comparisons and arbitrary-route
  finishability remain unproven.
- Refresh older source receipts and complete campaign regressions. The required
  `npm run verify:shared-runtime` still fails its historical runtime inventory;
  the office-era jungle-entry receipt rejects the newer replay verifier hash.
  Neither failure is waived, and **the full `npm run verify` is not green**.
- Native coverage of nonzero bank/sparkle pixels and unusual sprite aliases is
  limited. Speaker noise is approximate and its engine is omitted. BIOS seed 0
  is an explicit browser provider; original time-of-day seeding is pending.
- Original save/load/high-score behavior/formats have not been established.
  Browser persistence would be an explicit addition without original evidence.

Next: address safari pacing and refresh broader gates.

## Supported build and commands

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Actual relocated game bytes
and native addresses were checked; the analysis image is never executed.

```sh
npm run verify:jungle-core
npm run verify:cave-timing
npm run verify:jungle-draw-timing
npm run build
npm run dev -- --port 5186
```

Missing/corrupt required originals, captures or source history are setup failures.
Required counts, inputs, checkpoints and exact comparison rules fail strictly.
The full required integration command remains `npm run verify`; its remaining
failures are listed above. Detailed historical receipts are in
[status-history.md](status-history.md) and subsystem documents.
