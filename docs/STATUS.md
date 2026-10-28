# Current port status

Updated2026-10-28. **The whole game is incomplete; this is completion work, not
only fine-tuning.** Complete selected campaigns work, but arbitrary campaigns
and full original-game parity are not guaranteed.

## Integration state

- Main9fbb7c4 is the last fully integrated baseline:117 unit,72 development
  browser and2 production browser cases, zero skips, with required original
  comparisons and negative controls passing.
- The original difficulty menu, startup waits, flight input boundaries and
  campaign checks are integrated. Its passing runtime cd1e4dd receipt is retained
  at .local/menu-integration-full-gate-20261028/.
- This office branch adds the original money-bin departure. Two new browser
  cases, nine existing browser regressions,117 unit cases, exact native/core
  checks and the production build pass. Its full gate is pending. It has not been
  merged into main. See [office evidence](office-transitions.md).

## Playable routes

- Original opening/intro music → difficulty → office → money-bin dive/reward.
  The office branch adds the real19-presentation door/roof departure, its waits,
  sound calls and keyboard flush before entering the bin.
- Office → map → confirmed departure → keyboard flight → landing or crash/repair
  → expedition → results → map. All35 destinations can be inspected.
- Jungle, mountain, cave and photography have playable completion/failure paths.
  Tested Hard routes cover both alternate jungle layouts and mountain variants1/2,
  retain three lives, bank their rewards and restart. This is route coverage,
  not comprehensive native scene parity.
- Banking, investments, rival claims/reports, atomic travel, calendar/deadline
  handling, winning/losing endings and replay are connected. See [campaign
  travel](campaign-travel.md), [Hard routes](hard-expeditions.md),
  [Hard mountains](hard-mountains.md), [investments](investments.md),
  [bank](bank.md) and [endings](ending.md).
- A complete Easy route reaches the day30 winning ending with15000 against10500.
  The menu-migrated Hard route carries all four expedition families to day33,
  losing with19600 against44000. Its3350 real DOM inputs match25 exact state/pixel
  checkpoints in independent Game and browser replays. The office branch retains
  the25-checkpoint Game replay; its complete browser gate is still pending.
- Tandy/PCjr audio is connected, including title Sound001 (~49s/3558 sequencer
  ticks), persistent channels, priorities, engine words and explicit completion.
  All121 public requests have viewer playback. PC speaker is the default.

## Supported build and evidence

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981.
It is MZ/EXEPACK, x86 LE16 real mode with overlays and no extender. Fresh relocated
code checks establish that analysis includes the actual game. Originals remain
authoritative in ignored game/; proprietary captures and generated output stay
local. Production visitors select their own original folder.

Original routine/segment comparisons, carried port replays and actual browser
acceptance remain distinct evidence levels. Native office checks compare20 exact
pictures and sprite tuples; browser checks compare19 departure presentations.
Neither establishes full original CPU/IRQ or physical display timing. Private
fixture manifests pin checksums, setup recipes, inputs, counts and exclusions;
missing fixtures fail setup.

## Remaining work

- Original office entry/selection, control-center and investments transitions,
  security, and several map/notice presentations remain omitted or incomplete.
- Broader destination/difficulty routes and original whole-scene comparisons are
  needed. A complete native campaign comparison and arbitrary-route finishability
  remain unproven.
- CPU/file/IRQ/input timing, hardware audio waveform/gain/filter parity, bank
  nonzero animation/sparkle pixels and unusual sprite aliases remain incomplete.
  PC speaker noise is approximate and its engine is omitted. BIOS seed0 remains
  an explicit browser provider. Unsupported paths stop with a diagnostic.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition.

Next: finish the connected office-departure full gate and integration. Continue with the remaining office/security transitions. The capture
bridge's stale settings/port collision needs the focused correction documented
in [office evidence](office-transitions.md) before another native capture.

## Verification

`npm run verify` is the required full gate and rejects missing/corrupt fixtures,
zero/incomplete cases, unsupported paths, unfinished events and comparison errors.
The connected office branch adds2 browser cases to the menu branch's72 and
requires its native/core and missing-Up controls. No full-branch pass is claimed yet.

Focused commands: `npm run verify:office`, `npm run verify:difficulty`,
`npm run verify:opening`, `npm run verify:hard-campaign`,
`npm run verify:hard-expedition`, `npm run verify:hard-mountains`,
`npm run verify:flight-input-stream`, `npm run verify:bank`.

Local development: `npm run dev -- --port 5186`. The user's integrated checkout is
served on5187. No push, publication or deployment has been requested.
