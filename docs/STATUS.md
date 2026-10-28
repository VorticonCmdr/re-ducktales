# Current port status

Updated2026-10-28. **The whole game is incomplete; this is completion work, not
only fine-tuning.** Complete selected campaigns work, but arbitrary campaigns
and full original-game parity are not guaranteed.

## Integration state

- The office money-bin departure milestone passes the full `npm run verify`:
  117 unit,74 development browser and2 production browser cases, zero skips,
  with required original comparisons and negative controls passing.
- Tested runtime6a02e89 is retained in
  `.local/office-integration-full-gate-20261028/`. Subsequent changes record
  receipts and integration metadata. See [office evidence](office-transitions.md).
- The prior menu runtimecd1e4dd receipt remains independently retained at
  `.local/menu-integration-full-gate-20261028/`.

The `codex/security-menu` development branch adds first-map security. Its two
browser routes on runtime9cfc0a3, four adjacent office/menu regressions,117 unit cases, native
segments and build pass. Main remains054ac66; security integration and the full
branch gate await campaign replay migration. See [security evidence](security.md).

## Playable routes

- Original opening/intro music → difficulty → office → money-bin dive/reward.
  The browser includes the real19-presentation door/roof departure, its waits,
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
  checkpoints in independent Game and browser replays. The complete gate retains
  those25 checkpoints in Game and browser replays. These are port regressions,
  not a complete original campaign comparison.
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

- Original office entry/selection, investments transitions and several map/notice
  presentations remain incomplete. Control-center departure/security work on
  the development branch; their campaign integration gate remains pending.
- Broader destination/difficulty routes and original whole-scene comparisons are
  needed. A complete native campaign comparison and arbitrary-route finishability
  remain unproven.
- CPU/file/IRQ/input timing, hardware audio waveform/gain/filter parity, bank
  nonzero animation/sparkle pixels and unusual sprite aliases remain incomplete.
  PC speaker noise is approximate and its engine is omitted. BIOS seed0 remains
  an explicit browser provider. Unsupported paths stop with a diagnostic.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition.

New integration evidence: a carried Hard browser route clears security, wins
its first race, completes Bermuda with three lives, banks2150 and completes
photography. An independent Game diagnostic matches11 checkpoints from2316
inputs. The next old destination had already been claimed by the rival, so a
fresh exploratory route completed Carlsbad on day14 with6950 cash and2150
banked. Its first16 checkpoints and3354 DOM inputs match an independent Game
replay; the next mountain race lost. A new whole-route browser capture is testing
an alternative flight path. No complete new campaign pass is claimed; main and
its old fixtures remain unchanged.

Next: finish migrating campaign/browser input streams through the new security step and
carry its changed shared RNG into real departures. The previous Hard replay
currently rejects checkpoint0 at the newly recorded `securityPending` field;
its old goldens remain unchanged. Then run the full branch gate before merging.
Native security checks now cover82 RNG boundaries,16 inputs and24 pictures in
two independent segment scenarios. Browser controls, pixel output, dialogs,
Tandy requests and the per-campaign flag pass focused acceptance.

## Verification

`npm run verify` is the required full gate and rejects missing/corrupt fixtures,
zero/incomplete cases, unsupported paths, unfinished events and comparison errors.
The complete gate includes the office native/core and missing-Up controls.

Focused commands: `npm run verify:office`, `npm run verify:difficulty`,
`npm run verify:opening`, `npm run verify:hard-campaign`,
`npm run verify:hard-expedition`, `npm run verify:hard-mountains`,
`npm run verify:flight-input-stream`, `npm run verify:bank`,
`npm run verify:security`, `npm run verify:security-core`.

Local development: `npm run dev -- --port 5186`. The user's integrated checkout is
served on5187. No push, publication or deployment has been requested.
