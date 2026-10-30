# Current port status

Updated 2026-10-30. **The whole game is incomplete; this remains completion work,
not only fine-tuning.** Hard campaigns are deferred at the user's request.

## Current accepted milestone: BIOS seed provider

The browser now samples a clock-derived unsigned16 seed at startup and again at
original difficulty confirmation, instead of fixing every campaign to zero.
The clock is injected into simulation and records upstream values separately.
Explicit `/?bios-seed=0` preserves historical replay inputs. Original helper and
two caller bytes plus the previously captured native input word18293 are checked.
Clean-source combined acceptance passed at `5747f72`: all194 units, eight focused
clock/menu browser cases, the cached-word failure control, mountain controls,
long jungle regressions, seven sound browser cases and the production build.
The fresh full Easy browser consumer at `4add476` matches all34 state/pixel
checkpoints and4,981 events from the unchanged historical recording. Independent
headless replay also passes. Eight broken fixture contracts are rejected.
**`npm run verify:current-campaign` passed.** The saved combined record pins845
source files,90 artifacts and1,172 preserved historical artifacts.
`node scripts/verify-bios-clock-campaign-receipt.js` validates that record;
`npm run verify:bios-clock` repeats focused acceptance.
See [environment contract and evidence](bios-clock.md).

Next non-Hard milestone: locate and account for the missing original cave room
composition/minimap drawing work, then compare its observable movement timing.
This is an evidence target, not a claim of a complete native timing model.

## Previous accepted runtime milestone

The fresh mountain copy/HUD/phase Easy campaign now passes independent headless
and actual-browser replay:34 full state/pixel checkpoints,4,981 DOM events,
1,470 flight presentations, all four expedition families, winning ending and
Restart. The mountain retains all three lives; day31 banking remains$14,550
against$12,500. **`npm run verify:current-campaign` passed from clean `6c7203b`.**
The combined record pins833 source files,74 evidence artifacts and1,148 preserved
historical artifacts. It freshly checks jungle/mountain controls and their
required failures; the complete positive browser run is independently registered
at `5d21932` with identical game sources. `--fresh-browser` repeats the whole
positive route. `node scripts/verify-mountain-phase-campaign-receipt.js` validates
the [saved combined record](../reference/mountain-phase-campaign-integration.json).
[Current campaign provenance and commands](mountain-phase-campaign.md).

## Focused mountain evidence

Mountain now schedules drawing by absolute simulation deadlines and then the next
display edge, preserving the phase at entry or after a pause. Six phase checks
and all186 units pass; the complete ascent and browser controls still pass.
The clean-source combined phase gate passed for `5eca408`, including all four
browser omission controls and the production build. Its saved record pins735
source files and five immutable artifacts. The receipt command is
`node scripts/verify-mountain-phase-receipt.js`. The complete Easy campaign was
subsequently accepted as described above.
[Phase contract, original evidence and commands](mountain-phase.md).

The current gate also requires34 production restoration cases,16 native signed
copy cases and12 HUD caller cases/486 calls, plus native line/number proofs.
The independent764-input ascent retains26 gameplay checkpoints,870 rendered
presentations and all three lives at the summit. Earlier
[HUD](mountain-hud-work.md) and [copy](mountain-copy-runtime.md) receipts remain
historical source snapshots; their current-source guards reject later changes.

Whole-route replay and combined acceptance are refreshed. Earlier receipts below
remain historical and unchanged; no full Hard or original whole-game timing
acceptance is claimed.

## Last full-campaign milestone

Jungle redraws now include original number formatting and transparent EGA text
work. Original signed32 formatting,16-bit alignment and remainder-glyph quirks are
preserved. Six original drawing boundaries retain exact commands/state/color;
two HUD redraws add0.416333ms each at the declared reference platform. No fixed
slowdown or fitted input is used. This does not establish complete original speed.

**`npm run verify:current-campaign` passed from clean `a54c8ec`.** It required:

- Original native text/formatter comparisons, including16 formatter cases,
  12,197 instruction addresses,800 exact port writes and all45,056 code bytes.
- Both long jungle component routes:1,616 inputs,1,714 ordered images,
  40 gameplay/timer checkpoints and17 failure controls. Original,pre-line and
  line-only timing streams are preserved and rerun independently.
- All180 unit cases, fresh browser startup/flight/jungle walking/Pause/cancelled
  Quit, native-counted first HUD budget, three actual browser failure controls,
  and the production build.

The 790-file source archive, 53 evidence artifacts and 1,005 preserved historical
artifacts are pinned in the [combined record](../reference/jungle-text-campaign-integration.json).
The complete positive browser run is the independent consumer at `a9ded04`;
the combined gate validates that source-pinned result and freshly runs jungle
controls and failure cases. `--fresh-browser` repeats the whole positive route.
[Campaign provenance and limits](jungle-text-campaign.md).
[Formatter/text timing integration](jungle-text-timing.md).

The mountain erase/copy plan
passes 34 conditional native routine cases (191 exact copy calls), eight failure
controls and named state comparisons across 14 original frame segments. The
walking path makes six source copies per frame. This is now connected to the
browser runtime. Signed-copy work passes 16 original primitive
cases with exact instruction/OUT/REP counts and eight failure controls; the
composed check covers all 191 calls. HUD text/lines and retrace-phase integration
remain. [Erase evidence](mountain-erase-work.md),
[signed primitive evidence](ega-signed-copy-work.md).

## Working gameplay and full-campaign evidence

HTML/CSS/vanilla JavaScript with npm/Vite connects office/security, map and
transport selection, departures, flight, all four expedition families, rewards,
rival reports, banking and campaign endings. Original assets stay authoritative
in ignored `game/`; production visitors select their own files. No push or deploy.

The fresh physical-keyboard Easy route **with formatter/text timing**
visits jungle, Safari, cave and mountain, wins on day31 with$14,550 banked against
$12,500, retains all three mountain lives and restarts. It checks34 complete
state/pixel checkpoints, 4,981 DOM events and 1,470 flight presentations. This fresh
startup capture has 34 unique checkpoints; the prior duplicate mountain-entry
marker is absent, with no unique boundary omitted. The fresh
independent browser replay also verifies Restart. [Current full route](jungle-text-campaign.md).

`npm run verify:current-campaign` and `verify:runtime-campaign` now target the
mountain copy/HUD/phase contract and pass the combined clean gate. Prior line,
speaker and cave receipts remain historical and untouched. Broader historical
`npm run verify` receipts also require current regressions; this focused gate
does not waive them.

## Hard, security and sound

The verified opening Hard route wins its first flight, gets jungle treasure with
all three lives and banks$2,250. The longer route loses its second flight race.
This is not established as a mechanic defect or complete Hard acceptance.
[Preserved Hard investigation](current-hard-campaign.md). Keep it deferred while
addressing other missing behavior.

The unchecked **Original security system** option restores the surviving failure
path and logs the correct code once per challenge. Default play keeps this build's
forced success. This is static restoration from the patched executable, not
comparison with an independently obtained unpatched edition. [Security](security.md).

Tandy/PCjr includes Sound001, persistent channels, priorities, flight engine words,
mute and completion. Speaker is the default and now uses a persistent original
IRQ/RNG/priority engine; its native fixture checks12 checkpoints,408 IRQs and1,128
port writes. Separate saved acceptance covers7 actual browser cases and3 stream
regressions. The viewer retains an older approximate speaker audition renderer.
Physical waveform/gain/filter parity remains unverified. [Sound evidence](speaker-audio.md).

## Known remaining gaps

- Native whole-game cadence is unverified. Jungle still omits resident/color,
  HUD caller, opaque-text and remaining CPU/device work. Mountain now charges
  HUD primitives but omits resident/color/caller work and composition copies;
  cave omits minimap fills, room composition and other copies;
  Safari omits HUD/result drawing and remaining CPU/device costs.
- Destination entry/selector/numeric drawing and exact video/cache phase remain
  partial. Cave's striped treasure reveal is implemented, but complete native
  whole-reveal timing remains unverified.
- Cross-scene queued physical keyboard delivery, remaining system/modifier/BIOS
  behavior, mouse/joystick parity and wider difficulty/destination coverage remain.
- Nominal time-of-day seeding is implemented; exact original PIT sub-tick phase
  and optional RTC synchronization are unverified. Original save/load/high-score
  behavior/formats have not been established.
- Arbitrary-route finishability and full original-game parity remain unproven.

## Supported build and commands

Only the22-file pairing in[build.json](../reference/build.json) is supported.
`DUCKTALE.EXE` SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK,x86 LE16 real mode,overlays,no extender. Actual game bytes and address
correspondence are checked; analysis executables are never run. Private emulator
experiments leave the shared8386 session untouched and close their owned instances.

```sh
npm run verify:current-campaign
npm run verify:bios-clock
node scripts/verify-bios-clock-campaign-receipt.js
node scripts/verify-mountain-phase-campaign-receipt.js
node scripts/verify-runtime-campaign.js --fresh-browser
node scripts/verify-mountain-phase-integration.js --bios-clock
node scripts/verify-mountain-phase.js
node scripts/verify-mountain-hud-runtime.js
node scripts/verify-mountain-copy-runtime.js
node scripts/verify-speaker-playback-receipt.js
npm test
npm run build
npm run dev
```

Missing/corrupt local artifacts or source history are explicit setup failures.
Older milestones remain in[status history](status-history.md) and subsystem docs;
past passes are not current whole-game acceptance.
