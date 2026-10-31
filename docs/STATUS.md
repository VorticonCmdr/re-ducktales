# Current port status

Updated 2026-10-31. **The whole game is incomplete. This is completion work,
not only fine-tuning.** Hard campaigns remain deferred at the user's request.

## Latest completed behavior: earned atomic travel

Source `e8320ce` passes an independent actual-browser route that earns the
transmitter through Too-Pei cave7, travels from Office to Klondike, collects
another $50, and Restarts:18 exact full-state/pixel checkpoints,486 DOM events,
and one omitted-selection negative. P/Q/S cannot interrupt charge. Ten focused
checks cover the original report-reader boundaries;194 existing unit tests and
the production build pass. [Atomic input evidence and commands](atomic-input.md).

A separate earned-report browser observation naturally reaches roll0/seed6900,
redirects to a jungle, and confirms Pause, Quit-No, Fire and Restart. That report
observation is not independent replay or native whole-game timing acceptance.
The source proof checks413 original resident bytes.

Current source `e8320ce` also passes the12-route regression against unchanged
historical inputs and expected outputs:272 exact browser state/image checkpoints,
10,117 DOM events,12 Restarts, the34-checkpoint full headless campaign, and all8
cave components/2,696 presentations. Three receipt negatives reject zero cases,
an unconsumed event and corrupt evidence. Each producer and the current consumer
have separate verified source archives. [Current regression and commands](atomic-input-regression.md).

## Working playable route

Startup → Easy → office/security → map/transport/departure → flight → jungle,
Safari, cave and mountain expeditions → rewards, banking/rivals → winning day31
ending → Restart. HTML/CSS/vanilla JavaScript runs through npm/Vite. Original
assets remain authoritative in ignored `game/`; production visitors select their
own files. No push or deployment has been performed.

The historically accepted full Easy route passes independent headless and actual-browser replay:
34 exact state/image checkpoints, 4,981 DOM events and 1,470 flight presentations.
It banks $14,550 against $12,500 and retains all three mountain lives.
`npm run verify:current-campaign` passed from clean `533f661`; the saved record
pins 863 source files, 96 evidence artifacts and 1,229 preserved historical
artifacts. It includes 194 units, focused browser controls/failure controls,
original/source/component checks and production build. The saved receipt was
rechecked successfully after adding the separate cave coverage harness.
[Full campaign evidence](cave-composition-campaign.md).

## Latest verified coverage

Historical source `f36dd7d` recording, now replayed by current `e8320ce`: all six Easy Safari variants pass independent browser
replay with48 exact full-state/pixel checkpoints and2,714 DOM events. Every route
photographs a target, completes12 pictures, displays results, returns with the
correct cash/day/claim and Restarts. The historical six omitted-shutter controls produced the
required game-state divergence;15 focused photography input/timing tests passed.
Those Safari negative executions were not repeated in the new positive-route run.
Both original film exhaustion exits (0 and-1) are preserved and compared exactly
per case. No gameplay source changed. [Safari scenario and commands](easy-safari-variants.md),
[registered manifest](../reference/easy-safari-variants.json).

Current replay includes68 state/image checkpoints and1,358 DOM
events through Bermuda/Boola Boola treasure and Restart, including both entrance
key clears. The two consumed-movement negatives remain historical evidence.
[Jungle scenario](easy-jungle-variants.md).

| Family | Current Easy coverage | Evidence |
| --- | --- | --- |
| Jungle | All3 layouts have complete browser treasure routes | Full campaign variant0; [Bermuda/Boola](easy-jungle-variants.md) variants1/2 |
| Mountain | All3 layouts have complete browser summit routes | Full campaign variant0; [Thunderclap/Machu](easy-mountain-variants.md) variants1/2,110 state/image checkpoints |
| Cave | All8 layouts complete in component replay; Klondike and Carlsbad complete in the browser | [2,696 component presentations and Carlsbad's12 browser checkpoints](easy-cave-variants.md) |
| Safari | All6 variants have complete browser target-photo/result routes | [Six fresh routes, scoring, both film exits and Restart](easy-safari-variants.md) |

The current consumer replays all these routes together; the older combined gate
remains separately scoped historical evidence. These checks establish
specified port routes under explicit clock/input providers, not arbitrary-route
finishability or native whole-level cadence. Existing timing limitations remain.

## Sound, security and clock

Tandy/PCjr includes Sound001, persistent channels, priorities, flight engine
words, mute and completion. Speaker is the default with an original persistent
IRQ/RNG/priority engine. Historical source-pinned acceptance covers seven browser
cases and three stream regressions; that sound suite was not rerun for this atomic
input change. Physical waveform/gain/filter parity remains unverified;
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
  coverage remains incomplete. Next: the current transmitter/atomic-transport
  campaign report independent replay, followed by remaining input/timing gaps.
  Hard remains deferred; its
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
# Recheck saved current route regression and earned-transmitter acceptance:
node scripts/verify-atomic-input-regression.js
# Original input boundaries and focused conditional checks:
node scripts/verify-atomic-earned-route.js
node scripts/verify-atomic-input-source.js
node --test scripts/atomic-input.test.js
# Recheck the separately scoped earned-report browser observation:
node scripts/verify-atomic-report-observation.js
# Fresh current consumer of immutable earlier campaign/expedition recordings:
# Requires clean committed source and a fresh ignored output directory.
node scripts/verify-preserved-routes.js --output=.local/preserved-routes-FRESH
# Repeat earned-transmitter acceptance with actual browser controls:
node scripts/atomic-route.js verify --capture=.local/atomic-earned-browser-01 --output=.local/atomic-replay-FRESH
# Local development:
npm run dev
```

The earlier `npm run verify:current-campaign`, `verify-runtime-campaign.js`,
combined receipt verifier and per-family CLIs retain their original producer-source
equality guards. They reject the atomic runtime change before comparing behavior;
they are historical commands, not current acceptance. The new preserved-route
consumer validates each producer archive separately and compares unchanged inputs
and expected outputs against a separately archived current consumer.

Missing/corrupt local artifacts or source history are explicit setup failures.
Earlier milestones remain in [status history](status-history.md) and subsystem
docs; historical passes are not current whole-game acceptance.
