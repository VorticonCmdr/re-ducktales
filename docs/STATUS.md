# Current port status

Updated2026-10-28. **The whole game is incomplete; this is completion work, not
only fine-tuning.** Selected complete campaigns work, but arbitrary campaigns and
full original-game parity are not guaranteed.

The integrated menu milestone passes the complete `npm run verify`:117 unit,
72 development browser and2 production browser cases, zero skips, all required
native/segment comparisons and negative controls. Tested runtime:cd1e4dd.
The immutable receipt is `.local/menu-integration-full-gate-20261028/`; subsequent
integration metadata preserves that exact runtime identity.

## Playable routes

- Original opening/intro music → original difficulty menu → office → money-bin
  dive/reward/return. Ending replay returns through the same original menu.
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
  A complete Hard route carries all four families to day33, losing with19600
  against44000. Its3350 real DOM inputs match25 exact state/pixel checkpoints in
  independent Game and actual browser replays. These are port regressions rather
  than complete original-game campaign comparisons.
- Tandy/PCjr audio is connected, including title Sound001 (~49s/3558 sequencer
  ticks), persistent channels, priorities, engine words and explicit completion.
  All121 public requests have viewer playback. PC speaker remains the default.

## Supported build and evidence

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981.
It is MZ/EXEPACK, x86 LE16 real mode with overlays and no extender. Fresh relocated
code checks establish that analysis includes the actual game. Originals remain
authoritative in ignored game/; proprietary captures and generated output stay
local. Production visitors select their own original folder.

Native routine/segment comparisons, carried port replays and browser acceptance
remain distinct. Opening checks include33 exact original pictures; difficulty
checks include four pictures, nine inputs, five sounds and the BIOS boundary.
These do not establish complete original CPU/IRQ or physical display timing.
Fixture manifests pin hashes, recipes, inputs, counts and exclusions; missing
fixtures fail setup. See [menu integration](difficulty-browser-integration.md).

## Remaining work

- Original office entry/selection, door/control-center/investments transitions,
  security and several map/notice presentations remain omitted or incomplete.
  An isolated office branch now passes20 native pictures and19 browser departure
  presentations, a rewarding dive, restart and Tandy calls; its full gate and
  integration remain pending.
- Broader destination/difficulty routes and original whole-scene comparisons are
  needed. A complete native campaign replay and arbitrary-route finishability
  remain unproven.
- CPU/file/IRQ/input timing, hardware audio waveform/gain/filter parity, bank
  nonzero animation/sparkle pictures and unusual sprite aliases remain incomplete.
  PC speaker noise is approximate and its engine is omitted. BIOS seed0 remains
  an explicit browser provider. Unsupported paths stop with a diagnostic.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition.

Next: verify and integrate the original money-bin office departure, then continue
with the remaining office/security transitions.

## Verification

`npm run verify` is the full required gate. It rejects missing/corrupt fixtures,
zero/incomplete cases, unsupported paths, unfinished events and comparison errors.
Focused commands: `npm run verify:difficulty`, `npm run verify:opening`,
`npm run verify:hard-campaign`, `npm run verify:hard-expedition`,
`npm run verify:hard-mountains`, `npm run verify:flight-input-stream`,
`npm run verify:bank`.

Local development: `npm run dev -- --port 5186`. The user's integrated checkout is
served on5187. No push, publication or deployment has been requested.
