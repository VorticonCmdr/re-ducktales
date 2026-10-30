# Current port status

Updated 2026-10-30. **The whole game is incomplete; this remains completion work,
not only fine-tuning.** Hard campaigns are deferred at the user's request.

## Current runtime milestone

Mountain restoration now calls the original erase planner and charges signed EGA
copy work alongside sprites. The focused command is
`node scripts/verify-mountain-copy-integration.js`: 34 production erase/charge
cases, 16 native primitive cases, the complete 764-input/26-checkpoint ascent,
180 units, an actual browser route and an omitted-copy browser failure control.
The summit retains all three lives. HUD text/lines and retrace-phase scheduling
remain incomplete. [Current scope and commands](mountain-copy-runtime.md).

**Whole-campaign acceptance has not been refreshed for the mountain changes.**
The source-pinned Easy receipt below remains historical; current source guards
correctly reject it. Do not report `verify:current-campaign` as currently passing.

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

`npm run verify:current-campaign` and `verify:runtime-campaign` target the
text-inclusive contract that passed the combined clean gate before mountain
copy integration. They require a new independent campaign for current source. Prior line,
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
  HUD caller, opaque-text and remaining CPU/device work. Mountain omits text/line
  and other copies; cave omits minimap fills, room composition and other copies;
  Safari omits HUD/result drawing and remaining CPU/device costs.
- Destination entry/selector/numeric drawing and exact video/cache phase remain
  partial. Cave's striped treasure reveal is implemented, but complete native
  whole-reveal timing remains unverified.
- Cross-scene queued physical keyboard delivery, remaining system/modifier/BIOS
  behavior, mouse/joystick parity and wider difficulty/destination coverage remain.
- BIOS seed0 is an explicit browser provider; original time-of-day seeding is
  pending. Original save/load/high-score behavior/formats have not been established.
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
node scripts/verify-mountain-copy-integration.js
node scripts/verify-runtime-campaign.js --fresh-browser
node scripts/verify-jungle-texts.js
node scripts/verify-jungle-text-campaign-receipt.js
node scripts/verify-mountain-erase.js
node scripts/verify-mountain-copy-work.js
node scripts/verify-hud-number.js
node scripts/verify-jungle-text-work.js
node scripts/jungle-text-timing.js
node scripts/verify-ega-text.js
node scripts/verify-speaker-playback-receipt.js
npm run verify:speaker-game
npm run verify:cave-reveal
npm test
npm run build
npm run dev
```

Missing/corrupt local artifacts or source history are explicit setup failures.
Older milestones remain in[status history](status-history.md) and subsystem docs;
past passes are not current whole-game acceptance.
