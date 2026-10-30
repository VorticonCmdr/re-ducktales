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

## Current input milestone

Ground expeditions now use original ordinary-key flags at source input calls.
Physical makes, repeats, release-edge reads, aliases/keypad directions and the
caller's flushes/mode replace the previous held-direction shortcut. Safari keeps
its mode-1 behavior; jungle inherits its caller mode. Cave keypad diagonals use
the original five-bit direction groups. The focused command is
`npm run verify:expedition-keyboard`; its clean run on `948466d` passed
all 148 unit cases, five real browser cases, the lost-release browser negative,
original/component regressions and the production build, with zero skipped
cases. All 159 map artifacts and previous receipts were preserved. The
653-file source archive and results are pinned by the
[focused receipt](../reference/expedition-keyboard-integration.json).
[Input evidence and limits](expedition-keyboard.md).

Exact source bridges compare all 764 mountain input memories/locals/states and
870 ordered command/pixel publications, and 1,616 jungle input memories/states
and 1,714 ordered pixel/mode/wipe publications against the previous classes.
These include every timer byte, retain all historical expectations, and do not
establish native whole-level timing parity.

## Earlier verified milestones

Safari now charges source background/HUD and actor drawing, including the extra
unpresented preparation before shutter decisions. Its two browser routes pass,
and the omitted-work browser negative fails at the required cadence assertion.
Current component replays preserve 899 full input-boundary memories (except
twelve separately checked clock bytes), all locals/gameplay and 2,234 ordered
images/modes/wipe tokens across all 22 cases. Historical expectations remain
unchanged. `npm run verify:photography-timing` passed on `f14804d`: all 139 unit
checks, both browser cases, the omitted-work negative and the production build,
with zero skipped cases. The 639-file source archive and results are pinned in
the [verification receipt](../reference/photography-drawing-integration.json).
[Safari timing contract](photography-timing.md).

The cave now charges original party-helper and sprite work before continuing,
including overwritten draws. Focused checks pass: the conditional original
input/deadline interval, code/state/image comparisons, passage/ending replays,
132 unit cases, the full browser flight/failure/retry/treasure route, browser
Pause/input checks and an omitted-work negative. `npm run verify:cave-timing`
passed on `1dc1285`, including the production build, with zero skipped cases.
The 627-file source archive, runner and logs are pinned in the
[verification receipt](../reference/cave-drawing-integration.json).
[Cave timing contract](cave-timing.md).

Jungle's combined drawing-time gate passed on `f6d0f05`, including original
routine/pixel comparisons, the independent map oracle, both component migrations,
two browser cases and negatives. Its complete treasure route has 27 exact
checkpoints, 70 DOM events and 860 movement samples, returning $1,050 on day 17.
Historical component contracts retain 1,616 input-boundary memory comparisons,
1,714 ordered publications and 40 gameplay checkpoints. At `d1e0189`, after the
cave change, `npm run verify:jungle-core` also passed. Its complete-treasure browser source receipt needs refresh for the newer shared
sources; the new physical-input gate separately checks natural entry and movement. [Evidence](../reference/jungle-component-migration.json).

Mountain sprite pacing and its complete summit/browser route passed their earlier
`ce112a8` milestone. Mountain and older Easy/Hard campaign receipts also need
refresh. Historical passes do not establish a green current broader gate.
[Earlier milestones](status-history.md).

## Remaining work

- Complete remaining drawing/device cost coverage. Mountain copy/text/line and
  other CPU/device costs, and jungle line/text/remaining CPU costs, are omitted.
  Cave omits minimap fills, room composition, copies outside the party helper
  and remaining CPU/device costs; its measured budget is partial.
  Cave's first treasure reveal also substitutes a normal page presentation for
  the original striped reveal.
  Safari omits HUD line/text, result-sheet drawing and remaining CPU/device
  costs; whole-original expedition cadence is still unverified.
- Finish the destination's autonomous neutral polling, draw/flush/read window
  and deferred system-key polling. Browser reads currently follow external makes;
  the original recurring loop is incomplete. Original first-map drawing and exact
  video/cache phase alignment remain open. [Destination scope](destination-keyboard.md).
- Complete cross-scene queued keyboard delivery and remaining system/modifier/BIOS
  behavior. The four ground expeditions now use the ordinary reader, but physical
  input in other scenes and exact transition windows remain incomplete. Broader
  destination/difficulty routes, original whole-scene/campaign comparisons and
  arbitrary-route finishability remain unproven.
- Refresh older source receipts and complete campaign regressions. The required
  `npm run verify:shared-runtime` still fails its historical runtime inventory;
  the office-era jungle-entry receipt rejects the newer replay verifier hash.
  Neither failure is waived, and **the full `npm run verify` is not green**.
- Native coverage of nonzero bank/sparkle pixels and unusual sprite aliases is
  limited. Speaker noise is approximate and its engine is omitted. BIOS seed 0
  is an explicit browser provider; original time-of-day seeding is pending.
- Original save/load/high-score behavior/formats have not been established.
  Browser persistence would be an explicit addition without original evidence.

Next: complete destination polling and cross-scene input windows, then refresh
broader campaign gates against the current runtime.

## Supported build and commands

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Actual relocated game bytes
and native addresses were checked; the analysis image is never executed.

```sh
npm run verify:expedition-keyboard
npm run verify:jungle-core
npm run verify:cave-timing
npm run verify:photography-timing
npm run verify:jungle-draw-timing
npm run build
npm run dev -- --port 5186
```

Missing/corrupt required originals, captures or source history are setup failures.
Required counts, inputs, checkpoints and exact comparison rules fail strictly.
The full required integration command remains `npm run verify`; its remaining
failures are listed above. Detailed historical receipts are in
[status-history.md](status-history.md) and subsystem documents.
