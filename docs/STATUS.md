# Current port status

Updated2026-10-29. **The whole game is incomplete. This is completion work,
not only fine-tuning.** Selected complete campaigns work; arbitrary-route
finishability and full original-game parity remain unproven.

## Current verified milestone

Original office entry/reveal,keyboard selection and all three departures now
connect to the campaign. The complete required `npm run verify` passed on source
`d34d194`:117 unit checks,91 development-browser cases and2 production-browser
cases,zero skips,with the required original comparisons and negative controls.
Receipts and all515 tested source files are retained in
`.local/office-integration-full-gate-20261029-03/`.
[Integration manifest](../reference/office-integration.json).

Receipt/checker and documentation commits follow that tested source. The receipt
command below validates the historical complete run;it does not execute a fresh
whole-game acceptance test. Earlier security integration remains separately
recorded in [security-integration.json](../reference/security-integration.json).

## Working routes and evidence

- Original opening/Sound001 → difficulty → office. Office clear/reveal and input
  match29 native pictures and63 consumed input values. Money-bin departure,dive,
  reward,return and Restart work. Left+Fire runs the seven-flip investment
  departure before trading;Right+Fire runs control-center departure and security.
  [Office menu](office-menu.md),[investments](office-investments.md).
- Map → departure briefing → controlled flight → jungle,mountain,cave or
  photography → reward/failure → map,rival reports and banking. Investments,
  atomic transport,calendar/deadline handling and both endings are connected.
- Complete office-aware Easy route wins onday32 with13875 against11500:
  36 exact carried state/pixel checkpoints,3516 DOM events and1188 flight
  presentations,then Restart. Complete Hard route loses onday31 with17200
  against61000:28 checkpoints,4140 events and1629 flight presentations.
  These are port/browser regressions,not full original-campaign comparisons.
  [Campaign migration](office-campaign-migration.md).
- Four alternate Hard expeditions return treasure and bank onday6 with three
  lives:169 exact Game/browser checkpoints,3978 events and1584 flight
  presentations. Eight complete browser cases and four separate entry replays
  pass;the latter consume956 events each.32 comparison/missing-movement controls
  and required fixture removal/corruption/restoration pass.
  [Hard alternates](office-hard-expeditions.md).
- Focused jungle treasure,mountain summit and natural lightning routes also have
  independent input streams,strict Game replay and actual browser acceptance.
  Pause,quit,input deferral,life resets,duplicate notices and audio boundaries
  have focused checks. See the linked route documents for exact scope.
- Tandy/PCjr playback is connected,including Sound001(~49s/3558 sequencer ticks),
  persistent channels,priorities,engine words,mute and completion. All121 public
  requests have viewer playback. PC speaker remains the default.

Original routine/segment comparisons,carried port replay and actual browser
acceptance are distinct evidence levels. Success at one does not prove another.

## Supported build

Only the22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Relocated original bytes
validate actual game code and runtime correspondence. Originals remain
untouched in ignored `game/`;private captures,images and traces remain local.
Production visitors select their own originals. No deployment is performed.

## Remaining work and next milestone

- On the isolated keyboard branch,OfficeMenu now uses the shared original
  ordinary-key core.36 fresh native map input/flag/pointer comparisons and the
  unchanged Easy/Hard carried campaign replays pass. Main still runs the earlier
  verified office milestone. Seven fresh office/investment/trading browser cases pass on87bf2ed;an
  omitted real chord key is detected. Wider branch acceptance remains pending.
  [Input rules and reproduction](ordinary-keyboard.md).
- Original letter/keypad browser bindings,scene-specific flush/repeat behavior
  and map pacing remain unfinished. The original map has six-count steady polls;
  Game currently uses two. The native input comparison does not prove Game timing.
- The keyboard branch corrects the investment departure status to “Opening
  investments…”. The fresh browser assertion passes;main still has the generic
  money-bin label. Its animation and trading destination work correctly.
- Original map/notice presentation and polling details,broader destination and
  difficulty finishability,and original whole-scene/campaign comparisons remain.
  A broader exploratory controller is not acceptance evidence.
- CPU/file/IRQ/input timing and physical audio waveform/gain/filter parity remain
  unproven. Nonzero bank animation/sparkle pixels and unusual sprite aliases have
  limited native coverage. Speaker noise is approximate;its engine is omitted.
  BIOS seed0 is an explicit browser provider,not original time-of-day seeding.
- No original save/load/high-score format has been identified. Browser
  persistence would be an explicit addition.

## Verification commands

```
npm run verify
node scripts/verify-office-integration.js
npm run verify:office-menu
npm run verify:map-keyboard
npm run verify:office-investments
npm run verify:easy-office-campaign
npm run verify:hard-office-campaign
npm run verify:office-hard-expeditions
```

Missing/corrupt fixtures,incomplete inputs or required comparisons fail.
Local development:`npm run dev -- --port 5186`. Main preview uses5187.
[Earlier milestones](status-history.md).
