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

Clean source `4501258`: current Easy Bermuda and Boola Boola routes pass
independent browser replay with68 exact full-state/pixel checkpoints and1,358
DOM events. Their503/421 game reads retain all three lives, award $2,200/$1,350,
mark the destination collected on day2 and Restart. Both original entrance input
clears are asserted; omitting consumed movement fails specifically at input4/3.
Six focused jungle input tests also pass. No gameplay source changed.
[Jungle scenario and commands](easy-jungle-variants.md),
[registered manifest](../reference/easy-jungle-variants.json).

| Family | Current Easy coverage | Evidence |
| --- | --- | --- |
| Jungle | All3 layouts have complete browser treasure routes | Full campaign variant0; [Bermuda/Boola](easy-jungle-variants.md) variants1/2 |
| Mountain | All3 layouts have complete browser summit routes | Full campaign variant0; [Thunderclap/Machu](easy-mountain-variants.md) variants1/2,110 state/image checkpoints |
| Cave | All8 layouts complete in component replay; Klondike and Carlsbad complete in the browser | [2,696 component presentations and Carlsbad's12 browser checkpoints](easy-cave-variants.md) |
| Safari | One destination completes in the full campaign; other variants need current browser acceptance | [Earlier resource/native comparisons](photography.md) remain separately scoped |

These route records are separate from the combined campaign gate. They establish
specified port routes under explicit clock/input providers, not arbitrary-route
finishability or native whole-level cadence. Existing timing limitations remain.

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
  coverage remains incomplete. Next: current Easy Safari variant browser coverage
  and investigation of the first divergence or unsupported behavior. Hard remains deferred; its
  longer investigated route loses the second flight race, with the cause unresolved.
- Native whole-game cadence remains unverified. Drawing-cost models cover selected
  primitives; resident/caller/device work, some drawing and exact video/cache phase
  remain partial. See [jungle](jungle-text-timing.md), [mountain](mountain-phase.md),
  [cave](cave-composition-work.md) and [Safari](photography.md) evidence.
- Cross-scene queued keyboard delivery, remaining modifier/BIOS behavior and
  mouse/joystick parity need wider verification.
- A [bounded original-interface audit](system-controls.md#saveload-and-high-score-audit)
  found no save/load/high-score interface in this build. These are not confirmed
  missing original features; no persistence feature should be invented.
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
# Repeat current Easy alternate mountain routes, including negatives:
node scripts/easy-mountain-variants.js verify
# Validate the separately scoped exploratory/static Machu evidence:
node scripts/verify-easy-mountain-investigation.js
# Repeat current Easy alternate jungle routes, including negatives:
node scripts/easy-jungle-variants.js verify
# Local development:
npm run dev
```

Missing/corrupt local artifacts or source history are explicit setup failures.
Earlier milestones remain in [status history](status-history.md) and subsystem
docs; historical passes are not current whole-game acceptance.
