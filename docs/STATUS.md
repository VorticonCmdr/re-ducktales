# Current port status

Updated 2026-10-29. **The whole game is incomplete. This is completion work,
not only fine-tuning.** Selected complete campaigns are playable and verified;
arbitrary-route finishability and full original-game parity remain unproven.

## Optional security restoration

The working branch adds an unchecked **Original security system** option below
the screen. It restores the surviving failure path after two wrong answers;
default play retains the supplied executable's forced success. The correct code
is logged once per challenge. Restart starts a new session and retains the
page's preference. [Behavior and source evidence](security.md#optional-restoration).
`npm run verify:security-restoration` passes, including three browser cases and
the missing-checkbox negative control. All 123 unit cases and both existing
complete Game campaign replays also pass (64 state/picture checkpoints).
This restoration is statically inferred from the patched executable, not a
comparison against an independently obtained unpatched edition. Broader port
completion and verification limitations below still apply.

## Current verified branch

The keyboard milestone `c582295` connects the destination dialog to the original
ordinary-key reader. I/J/K/M, keypad directions/center/Enter, physical releases and fresh repeat
makes now work. Original entry, selection and confirmation waits remain connected.
The complete focused keyboard command, both complete campaign commands and the
production build pass, with 573 exact source files archived.
[Verification receipt](../reference/destination-keyboard-integration.json).

Fresh checks cover 123 unit cases, five focused browser cases and two complete
browser campaigns, with zero skips. Easy wins on day 32 with 13,875 against 11,500;
Hard loses on day 31 with 17,200 against 61,000. Independent Game and real browser
replays consume all 7,650 events and compare all 64 full states/pictures, with
2,817 flight presentations. No captured inputs, timestamps or expected states
were edited for the keyboard repair. Required input omissions fail.
Two additional atomic browser cases and five conditional original atomic checks
also pass, covering the unlocked third transport choice.

Original comparisons separately check 26 destination reads and their full key
flags, four complete destination pictures, and 29 CPU/video observations. The new
16-read case also runs through an independently initialized Game with declared
fixture clocks. These are scoped native routine/caller comparisons, not a native
complete-campaign comparison or proof of CPU/scanout timing parity.
[Keyboard scope](destination-keyboard.md), [explicit waits](destination-waits.md).

The main checkout remains clean at `59af3c6`; its preview on port 5187 is unchanged.
The last complete historical `npm run verify` passed on `8446d79`: 117 unit,
91 development-browser and two production-browser cases, zero skips.
[Historical full-gate receipt](../reference/keyboard-integration.json).
That run predates this map/destination branch. **The required broader gate has
not passed on the current branch.** The current production build passes; no new
production-browser acceptance is claimed.

## Refreshed focused routes

The destination-aware jungle and mountain contracts now have independent current
browser replays and strict Game checks: 55 complete state/picture checkpoints,
224 separately consumed DOM events and the unchanged 860 jungle / 764 mountain
movement samples. Mountain returns $8,100 with three lives and both rival reports;
jungle returns $1,050 with one life. Both reject duplicate treasure collection.
Three manifests pin original build, capture/browser sources, raw declarations,
actual replay events/states and required missing-movement failures. Fifteen
fixture/setup negatives also pass. `npm run verify:destination-routes` passes
all five fresh browser cases and both real missing-movement controls.
These are focused port/browser checks, not
native whole-level parity or a completed broader integration gate.
[Evidence and reproduction](destination-route-integration.md).

## Movement speed investigation

**Mountain pacing now charges original sprite execution work before retrace.**
The captured14-interval walk now spans599.264ms, versus604.032ms in the original
counter benchmark, with unchanged checked actor/action/RNG values. This is a
partial correction: copy/text/line and other CPU costs remain uncharged, and
jungle/cave/safari pacing is unchanged. The refreshed browser route now passes27 exact state/picture checkpoints with104
recorded DOM events,764 movement samples and the same $8,100/three-life outcome.
The600ms DOM hold check passes and rejects the one-retrace browser bypass.

 A new original
observer uses80 render-callback samples and independently scheduled Right/release
inputs, with zero intermediate execution stops. Its26 page changes bracket a
mean42.234–43.375ms per update in this mountain scene, versus the port's14.268ms
presentation allowance. The source confirms drawing work followed by a retrace
wait. Other scenes and jungle/cave/safari pacing remain unmeasured.

`npm run verify:mountain-pages` passes all80 samples and three negative controls.
`npm run verify:ega-work` passes98 sprite operations,14 conditional hazard
comparisons,14 inferred erase rectangles, the bulk restore path and six controls.
Sprite work is connected to scheduling; copy work is translated but is not yet
charged. Dense debugger captures remain scoped evidence: adding
stops changes emulated elapsed time despite pause-clock invariance. The original
release-edge direction is also absent from the expedition held-control adapter.

`npm run verify:expedition-timing-evidence` checks the evidence;
`npm run verify:expedition-timing` now passes the captured mountain cadence
comparison and rejects an isolated one-retrace bypass. Broader fixture/source
migrations remain open; this is not whole-game timing acceptance.
`npm run verify:mountain-sprite-timing` runs the focused integration gate. Its
final combined run is pending. Next: charge remaining graphics/CPU work, extend
pacing evidence to the other expedition families and migrate broader regressions.
[Evidence, source locations and reproduction](expedition-timing.md).

## Connected gameplay and evidence

- Opening/Sound 001 → difficulty → office, money-bin dive/reward/return and
  Restart. Investments have their original seven-flip departure and trading.
  [Office menu](office-menu.md), [investments](office-investments.md).
- Control center/security → map → destination/aircraft choice → departure →
  controlled flight → jungle, mountain, cave or photography → reward/failure →
  map, rival reports and banking. Calendar/deadline handling, atomic transport
  and both endings are connected. Both complete current campaign routes exercise
  all four expedition families.
  [Easy contract](../reference/easy-campaign-destination.json),
  [Hard contract](../reference/hard-campaign-destination.json).
- Map input has 36 original flag/pointer comparisons; its deadline component has
  35 original completion calls and 70 independently captured clock results.
  Current focused browser checks include aliases, raw makes/releases and steady
  six-count polls. [Map integration](map-input-integration.md).
- Natural jungle and mountain routes now have refreshed destination-aware
  contracts as described above. Earlier alternate Hard and lightning routes
  retain their independent streams and historical receipts; those still need
  migration/acceptance with the newer map timing. [Earlier milestones](status-history.md).
- Tandy/PCjr playback includes Sound 001 (~49s/3,558 sequencer ticks), persistent
  channels, priorities, engine words, mute and completion. All 121 public requests
  have viewer playback. PC speaker remains the default; waveform parity is open.

## Supported build

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Relocated original bytes
validate actual game code and runtime correspondence on native launches.
Originals remain untouched in ignored `game/`; captures, pictures and traces stay
local. Production visitors select their own originals. Nothing is deployed.

## Remaining work and next milestone

- Finish the destination's autonomous neutral polling, CPU draw/flush/read window
  and deferred system-key polling. The browser currently prompts reads from
  external makes. It does not implement the original recurring loop or invent a
  fixed drawing cost. Original first-map drawing and exact video/cache phase
  alignment also remain open.
- Integrate the refreshed routes with the full required regression suite. Older
  event streams legitimately send commands during the newly implemented entry
  wipe; preserve them and produce independent replacements rather than weakening
  comparisons. The main preview stays on its accepted source until integration.
- Investigate the reported fast expedition movement in jungle, mountain, cave
  and safari. Browser simulation already uses
  separate fixed driver/retrace clocks; original CPU work between explicit waits
  is not fully represented. Do not assume a high-refresh display is the cause or
  apply an overall speed multiplier without a timed original comparison.
- Broader destinations/difficulties, original whole-scene/campaign comparisons
  and arbitrary-route finishability remain unproven. CPU/file/IRQ timing and
  physical audio waveform/gain/filter parity also remain open.
- Nonzero bank/sparkle pixels and unusual sprite aliases have limited native
  coverage. Speaker noise is approximate and its engine is omitted. BIOS seed 0
  is an explicit browser provider; original time-of-day seeding is pending.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition unless original behavior is established.

## Verification

```
npm run verify:destination-keyboard
npm run verify:destination-routes-core
npm run verify:destination-routes
npm run verify:easy-destination-campaign
npm run verify:hard-destination-campaign
npm run verify:destination-waits
npm run verify:map-input-browser
npm run build
```

Missing/corrupt fixtures, zero cases, incomplete required input and mismatches
fail. `npm run verify` remains the required broader integration gate; its older
fixtures and source guards have not yet been migrated for this branch.
Local development: `npm run dev -- --port 5186`. Main preview: port 5187.
