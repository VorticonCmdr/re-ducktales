# Current port status

Updated 2026-10-31. **The whole game is incomplete. This is completion work,
not only fine-tuning.** Hard campaigns remain deferred at the user's request.

## Working playable route

Startup → Easy → office/security → map/transport/departure → flight → jungle,
Safari, cave and mountain expeditions → rewards, banking/rivals → winning day31
ending → Restart. HTML/CSS/vanilla JavaScript runs through npm/Vite. Original
assets remain authoritative in ignored `game/`; production visitors select their
own files. No push or deployment has been performed.

The full Easy route passes independent headless and actual-browser replay:
34 exact state/image checkpoints, 4,981 DOM events and 1,470 flight presentations.
It banks $14,550 against $12,500 and retains all three mountain lives.
`npm run verify:current-campaign` passed from clean `533f661`; the saved record
pins 863 source files, 96 evidence artifacts and 1,229 preserved historical
artifacts. It includes 194 units, focused browser controls/failure controls,
original/source/component checks and production build. The saved receipt was
rechecked successfully after adding the separate cave coverage harness.
[Full campaign evidence](cave-composition-campaign.md).

## Latest verified coverage

Clean source `d7257c1`: all eight Easy cave layouts reach treasure in independent
closed-loop component replay, with exact state/pixel checks at all 2,696 rendered
presentations. A fresh Carlsbad browser replay matches 12 full state/pixel
checkpoints and 82 DOM events: startup, travel/flight, seven room moves, $2,800
award including room coins, collected destination on day17, and Restart.
Three component failure controls and one browser movement omission are detected.
No gameplay source changed for this milestone.

The registered cave check is separate from the earlier combined campaign gate.
It proves these port routes under explicit clock/input providers, not eight
native-game comparisons, arbitrary cave paths or native whole-level cadence.
[Scenario, limitations and setup](easy-cave-variants.md),
[versioned manifest](../reference/easy-cave-variants.json).

## Sound, security and clock

Tandy/PCjr includes Sound001, persistent channels, priorities, flight engine
words, mute and completion. Speaker is the default with an original persistent
IRQ/RNG/priority engine. Seven browser cases and three stream regressions have
source-pinned acceptance. Physical waveform/gain/filter parity remains unverified;
the viewer's older approximate speaker audition renderer remains separate.
[Sound evidence](speaker-audio.md).

The unchecked **Original security system** option restores the surviving failure
path and logs the correct code once per challenge. Default play retains this
build's forced success. This is static restoration from the patched executable;
there is no independently obtained unpatched-edition comparison.
[Security evidence](security.md).

Clock-derived unsigned16 seeds are sampled at startup and difficulty confirmation;
`/?bios-seed=0` gives repeatable replay inputs. Exact original PIT sub-tick phase
and optional RTC synchronization remain unverified. [Clock contract](bios-clock.md).

## Remaining work and next milestone

- Broader current-runtime destination, difficulty and arbitrary-route finishability
  coverage remains incomplete. Next: investigate the remaining expedition variants
  and fix the first observed unsupported behavior. Hard remains deferred; its
  longer investigated route loses the second flight race, with the cause unresolved.
- Native whole-game cadence remains unverified. Drawing-cost models cover selected
  primitives; resident/caller/device work, some drawing and exact video/cache phase
  remain partial. See [jungle](jungle-text-timing.md), [mountain](mountain-phase.md),
  [cave](cave-composition-work.md) and [Safari](photography.md) evidence.
- Cross-scene queued keyboard delivery, remaining modifier/BIOS behavior and
  mouse/joystick parity need wider verification.
- Original save/load/high-score behavior and formats have not been established.
- Full original-game parity is not established by the accepted routes.

## Supported build and verification

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
`DUCKTALE.EXE` SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 little-endian16 real mode, overlays, no extender. Actual game bytes
and address correspondence are checked; analysis executables are never run.

```sh
# Validate the saved combined campaign acceptance:
node scripts/verify-cave-composition-campaign-receipt.js
# Repeat its required combined checks:
npm run verify:current-campaign
# Repeat the complete positive campaign in an actual browser:
node scripts/verify-runtime-campaign.js --fresh-browser
# Repeat the new all-layout cave and Carlsbad acceptance, including negatives:
node scripts/easy-cave-variants.js verify
# Local development:
npm run dev
```

Missing/corrupt local artifacts or source history are explicit setup failures.
Earlier milestones remain in [status history](status-history.md) and subsystem
docs; historical passes are not current whole-game acceptance.
