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

## Current campaign work

The current physical-keyboard Easy campaign is playable from startup through all
four expedition families and the winning deadline ending. It recovers jungle,
cave and mountain treasure, earns Safari photo money, handles rival reports and
banking, then wins on day31 with$14,550 banked against$12,500. Mountain recovery
retains all three lives. Restart returns to a fresh game.

The clean `npm run verify:current-campaign` gate passed on commit`42ff402`:
177 unit cases,one complete actual-browser route,restart,five negative controls
and the production build,with zero skips. Independent replay matches35 full
states from4,981 events and renders1,470 flight presentations. Browser replay
matches every checkpoint's state and320x200 pixels. All828 protected historical
artifacts remain unchanged. The source archive and results are pinned by the
[clean focused receipt](../reference/current-physical-campaign-integration.json).

Full original/native campaign parity,Hard campaigns and arbitrary-route
finishability remain unproven. The broader `npm run verify` remains red at older
source receipts. [Scenario](../reference/current-physical-campaign.json),
[current evidence and limits](current-campaign.md).

[Current Hard investigation](current-hard-campaign.md) separately tests an
anticipatory physical-key pilot. It now wins the opening race in the actual
browser and reaches jungle;three startup checkpoints match diagnostic replay.
The carried Hard jungle player route still fails. A model controller crosses
the first bird hazard with all lives,then misses the next vine grab;that is the
next experiment. No complete Hard acceptance is claimed.

This work changes player controllers and verification, not game mechanics. The
old mountain controller released keys one source read too late; the corrected
physical schedule preserves the original mode0 release-edge consumption.
The earlier24-checkpoint three-family segment remains separate;
[its individual-command receipt](../reference/current-campaign-progress-receipt.json)
retains that smaller scope.

## Latest verified flight input milestone

Flight now uses physical ordinary-key flags, including aliases, release-edge
consumption, mode0 and its existing source flushes. Reveal keys carry from
departure into flight. Return prompts consume the same provider, and action
buttons supply raw taps. `npm run verify:flight-keyboard` passed from clean
commit `d36dc95`: all 177 unit cases, nine actual browser scenarios, the
lost-release browser negative and production build, with zero skipped cases.
This includes both natural crash return paths and the complete cave
landing/failure/retry/treasure/return route. All 822 protected historical artifacts
remain unchanged. The 684-file source archive and results are pinned by the
[focused receipt](../reference/flight-keyboard-integration.json).
[Evidence and limits](flight-keyboard.md).

Source/native checks cover 45 flight instructions / 139 bytes, three native
empty key tables and one AX return. The independent integration carries its own
state across 16 source reads and 14 hardware events, checking every consumed
byte and complete key table. Existing native physics, course, scene, crash,
calendar, input and 36-read shared-keyboard regressions pass.

Whole-game completion and full original timing remain unproven. Modifiers/BIOS,
mouse/joystick and other cross-scene physical delivery remain separate work.

## Earlier verified departure milestone

Launchpad's briefing now runs automatically through the original page wipe,
portrait copy, input flush, speech reveal, two RNG commit sites and flight call.
The manual Fire gate has been removed. Source comparison passes181 instructions /
463 bytes,50 required retraces,two native RNG/call checkpoints and exact final
portrait pixels. `npm run verify:departure-sequence` passed from clean commit
`ba6a36f`: all167 unit cases,six actual browser scenarios,the stalled-handoff
negative and production build,with zero skipped cases. This includes takeoff,
deferred Pause/Restart,bank travel and the full cave failure/retry/treasure/return
route. All758 protected historical artifacts remain unchanged. The673-file
source archive and results are pinned by the
[focused receipt](../reference/departure-sequence-integration.json).
[Evidence and limitations](departure-sequence.md).

That milestone retained flight's held-control provider; current work above
replaces it with the shared physical reader.
Loading, speech drawing, striped writes and other remaining CPU/device costs
are not included in the departure budget. Whole-original elapsed timing is
unverified. The cave browser controller now waits for actual room entry and its
source flush before issuing the next move; a changed room index alone is early.

## Earlier verified destination milestone

Destination selection now repeats its original flush/footer/read/flip/wait loop
without waiting for external makes. Physical events update flags; the shared
reader consumes them after source drawing work. Early keys are discarded at the
next caller flush. Pause/Quit/sound keys defer to that reader, and ordinary
neutral flips keep the HTML status and controls stable. The focused command is
`npm run verify:destination-loop`; its clean run on `c01a7d6` passed
all158 unit cases,four real browser cases,the omitted-reader browser negative,
original picture/video/input comparisons and production build,with zero skipped
cases. The bank round trip and full cave treasure/return route pass. All739
protected historical artifacts remain unchanged. Its663-file source archive and
results are pinned by the [focused receipt](../reference/destination-loop-integration.json).
[Loop evidence and remaining costs](destination-loop.md).

All16 retained native input groups,48 complete key-table boundaries,37 hardware
events and final return match an independently initialized Game. Source bytes,
relocated code,buffer/descriptor geometry and16 conditional footer budgets are
required;original timestamps are never input providers. Native whole-menu timing
and entry/selector CPU work remain unverified.

## Earlier verified input milestone

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
- Complete destination entry-page drawing,selector lines/numeric text and other
  CPU/device costs. Recurring neutral polling,source flush/footer/read ordering
  and deferred system-key polling now run in the browser;their timing boundary
  remains partial. Original first-map drawing and exact video/cache phase
  alignment remain open. [Destination scope](destination-loop.md).
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

Next: extend current physical campaign acceptance to Hard and the remaining
registered routes while preserving historical streams, then investigate the first
failed gameplay behavior. Continue remaining drawing/device costs and cross-scene input windows
alongside that campaign work.

## Supported build and commands

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Actual relocated game bytes
and native addresses were checked; the analysis image is never executed.

```sh
npm run verify:current-campaign
npm run verify:flight-keyboard
npm run verify:departure-sequence
npm run verify:destination-loop
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
