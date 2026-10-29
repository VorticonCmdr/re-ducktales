# Current port status

Updated2026-10-29. **The whole game is incomplete; this is completion work, not
only fine-tuning.** Selected complete campaigns work; arbitrary-route
finishability and full original-game parity remain unproven.

## Integration

Main3973cc7 on5187 remains the verified integrated version. New office work below
is isolated on `codex/office-investment-departure` until its full branch gate passes.

The security-aware runtime and all migrated campaign routes passed the complete
`npm run verify` on source e27022c:117 unit,87 development browser and2 production
browser cases,zero skips,including required original comparisons and browser
negative controls. Receipts and472 exact tested source files are retained in
`.local/security-integration-full-gate-20261029/`; the versioned manifest is
[security-integration.json](../reference/security-integration.json).
`node scripts/verify-security-integration.js` validates that historical receipt;
it does not replace a fresh full gate. Main integration follows this verified
source; later receipt/documentation changes do not change its runtime.

The runtime adds original control-center departure and first-map security.
Migrated real browser routes carry its changed shared RNG without resetting the
seed to preserve old expectations. Earlier main054ac66/office runtime6a02e89 and
its117/74/2 gate remain separate historical evidence in
`.local/office-integration-full-gate-20261028/`.

## Working routes and evidence

- Isolated development after main3973cc7: the original investment departure now
  connects Left+Fire/button → seven-flip animation → trading → office/restart.
  Seven original pictures and sprite tuples match with explicit VGA latch
  alignment; five focused browser cases and117 unit cases pass. Required Left
  omission and missing/corrupt fixture controls reject failures. Full branch
  integration remains pending. [Investment departure](office-investments.md).
- Office clear/reveal and the label/one-count input loop are connected on that
  isolated branch.29 exact native pictures and63 input values match a component
  driven by19 authored keyboard events, including release/chord priority. Seven
  focused browser cases pass, including all29 pictures/63 inputs through security
  to the map and reveal-key deferral/pause flushing. Fixture and missing-chord-key
  controls pass. Full campaign migration/gate remain pending; this is not whole
  original office parity. [Office menu](office-menu.md).
- The shared browser/headless ordinary-key boundary now carries a fresh Easy
  prefix through original office timing,security,the first race and jungle entry.
  Strict Game and fresh browser replays match3 complete state/pixel checkpoints
  and928 DOM events;364 flight presentations,no aliases,no tail. Jungle state
  matches the prior route exactly; global time is53 driver ticks later. Full
  Easy campaign now also wins onday32 with13875 against11500:36 complete
  checkpoints,3516 DOM events,1188 flight presentations match independent Game
  and fresh browser replay, followed by Restart. Strict receipts,seven comparison
  controls and missing/corrupt fixture checks pass.
- The office-aware Hard campaign also reaches its day31 loss,17200 against61000.
  Independent Game and fresh browser match28 complete state/pixel checkpoints,
  all4140 events and1629 flight presentations/one supported flag alias. A normal
  post-office rival report is acknowledged by the exploratory driver. Strict
  source receipts,missing-choice controls and missing/corrupt fixture checks pass.
  These are the default campaign checks on the isolated branch; wider integration
  remains pending. [Migration](office-campaign-migration.md).

- The office-aware focused Easy jungle entry now also passes50 independent DOM
  events,one complete state/pixel checkpoint and74 flight presentations. Fresh
  browser deferral,pause,cancelled-quit and sound behavior passes;three comparison
  controls and missing/corrupt fixture restoration checks pass. Actor/RNG state
  matches the historical entry;full Game tick advances159 counts through three
  office visits. [Focused entry](office-jungle-entry.md).

- The office-aware focused jungle treasure/duplicate-notice route now passes27
  exact Game/browser state/pixel checkpoints,70 events and860 unchanged control
  samples. It returns1050 dollars onday17 with one life. Three fresh browser
  cases,five comparison controls,the missing real movement key,and missing/corrupt
  fixtures with restored-positive checks pass. Presentation phase changes are
  captured and compared exactly. [Treasure](office-jungle-treasure.md).

- The office-aware focused mountain summit/duplicate-notice route now passes27
  exact Game/browser state/pixel checkpoints,104 events and764 unchanged samples.
  It returns8100 dollars onday17 with three lives and handles both rival reports.
  Two fresh browser cases,five comparison controls and a missing real movement
  key pass;required PNG corruption/removal and restoration are checked separately.
  [Mountain](office-mountain-ascent.md).

- The office-aware natural lightning route now passes6 exact Game/browser state
  and pixel checkpoints,164 events and43 flight presentations. The strike clears
  held controls at input36;fresh keys recover and input43 consumes releases.
  Both fresh browser cases,five comparison controls and the actual missing fresh
  throttle pass;PNG removal/corruption and restoration are checked separately.
  [Lightning](office-lightning.md).

- Original opening/Sound001→difficulty→office→original19-presentation money-bin
  departure→dive/reward→return/restart. [Opening](opening-investigation.md), [office](office-transitions.md).
- Office→map→departure→keyboard flight→landing or crash/repair→expedition→results
  →map. All35 destinations can be inspected. Jungle, mountain, cave and photography
  have completion/failure paths. Banking, investments, rival claims/reports, atomic
  travel, calendar/deadline handling and both endings are connected.
- The security-aware full Hard campaign covers all four expedition families and
  finishes day 31, losing17200 against 61000. Independent Game and browser replays
  match28 exact state/pixel checkpoints and4140 DOM events;1629 flight renders
  include one supported flag alias. Its current browser adapter regression also
  passes. [Hard campaign evidence](hard-campaign-security.md).
- Easy jungle entry independently matches50 DOM events and one complete snapshot;
  a fresh browser matches its pixels and passes pause/deferral/quit controls.
  [Entry evidence](security-jungle-entry.md).
- Easy Okeefadokie treasure/duplicate-notice route matches27 snapshots and pixel
  hashes in fresh and fixed-DOM browsers plus independent Game replay:70 events,
  860 jungle samples, 1050 dollars, one life, day 17. [Treasure evidence](security-jungle-treasure.md).
- Easy El Capitan summit/return/duplicate-notice route matches27 state/pixel
  checkpoints and104 DOM events in independent Game and browser replays:764
  unchanged mountain samples,8100 dollars,three lives,day17. Shared campaign
  adapter regression retains the complete Hard and jungle routes. [Mountain evidence](security-mountain-ascent.md).
- Natural lightning through security and three bank detours matches6 complete
  state/pixel checkpoints and164 DOM events in independent Game/browser replays.
  Strike36 clears held controls, fresh keys recover, and neutral poll43 consumes
  final releases. All three shared recorded routes retain fresh browser acceptance.
  [Lightning evidence](security-lightning.md).
- Hard Bermuda/Boola jungles and Thunderclap/Machu mountains retain layouts1/2,
  complete with three lives, claim treasure and deposit on day6. Independent Game
  and browser replays match169 full state/pixel checkpoints and3970 DOM events;
  four entry replays and eight full browser cases pass. The full Hard campaign
  also passes again through its ending after the shared adapter change.
  [Alternate Hard routes](security-hard-expeditions.md).
- A complete security-aware Easy campaign wins on day32 with13875 banked against
  11500, collecting all four families through two flight crashes/repairs. It
  matches36 complete state/pixel checkpoints and3516 DOM events in independent
  Game/browser replay, then restarts. [Easy campaign](security-easy-campaign.md).
- Security-aware bank/endings/trading, map controls, departure dispatches, cave
  retry/treasure, Too-Pei transmitter/atomic travel, photography and real-audio
  notices have focused acceptance. [Travel integration](security-route-integration.md),
  [expeditions](security-expedition-integration.md).
- Cave/camera/flight input boundaries, persistent Tandy mute/speed/completion and
  failure handling pass. Real-time jungle life loss/return and mountain hook,
  all three life palettes, life reset and retry pass. [Input/audio](security-input-audio-integration.md),
  [terrain](security-terrain-integration.md).
- Tandy/PCjr is connected: Sound001 (~49s/3558 sequencer ticks), persistent channels,
  priorities, engine words and explicit completion. All121 public requests have
  viewer playback. PC speaker is the default.

Historical main routes include an Easy day 30 win 15000 against 10500 and a
pre-security Hard day 33 loss 19600 against 44000 (3350 DOM events/25 checkpoints).
They remain separate baselines; they do not prove those routes after security.
Alternate jungle layouts and mountain variants1/2 also retain their earlier
scoped evidence. [Hard routes](hard-expeditions.md), [mountains](hard-mountains.md).

## Supported build and limits

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Fresh relocated-code checks
establish actual game code rather than a loader stub. Native security segments
cover82 RNG boundaries, 16 inputs and24 pictures; native office comparisons cover
20 pictures. [Security evidence](security.md).

Original routines/segments, carried port replay and actual browser acceptance are
distinct evidence levels. No complete native campaign/CPU/IRQ timing comparison
is claimed. Originals remain authoritative in ignored game/; private fixtures,
pictures and traces stay local. Production visitors select their own originals.

## Remaining work

- Office-aware Easy/Hard campaigns are now the default isolated-branch checks.
  The security-only full gate remains historical evidence for main3973cc7.
- Next: migrate focused recordings
  through the original office timing and key-slot boundary, then pass the full branch gate.
  Entry/selection and investment departure have focused acceptance on the isolated
  branch. Several map/notice presentations,
  broader destination/difficulty coverage and original whole-scene comparisons
  are also needed.
- CPU/file/IRQ/input timing, hardware audio waveform/gain/filter parity, nonzero bank
  animation/sparkle pixels and unusual sprite aliases remain incomplete. Speaker
  noise is approximate; its engine is omitted. BIOS seed0 is an explicit browser
  provider. Unsupported paths stop with diagnostics.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition.

## Commands

`npm run verify` is the required full gate. Relevant focused commands:

```
npm run verify:security
npm run verify:hard-office-campaign
npm run test:hard-office-campaign
npm run verify:jungle
npm run verify:office-jungle-entry
npm run verify:office-jungle-treasure
npm run verify:office-mountain-ascent
npm run verify:office-lightning
npm run verify:security-hard-expeditions
npm run test:security-hard-expeditions
npm run verify:easy-office-campaign
npm run test:easy-office-campaign
```

Other focused commands are documented with their scenarios. Missing/corrupt
fixtures and incomplete comparisons fail setup/verification. Local development:
`npm run dev -- --port 5186`. No push, publication or deployment is requested.
