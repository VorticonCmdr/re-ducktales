# Report and notice presentation restoration

Runtime introduced at b0bfaac on `codex/report-presentations`,based on7579426.
Current Safari-HUD runtime receipts are recorded by
`reference/report-presentation-acceptance.json`:85 exact browser checkpoints,
2881 independent inputs,174 intermediate state/pixel/time comparisons and135
source stripe groups. Earlier receipts retain their historical source scope.

The application now implements the source-defined sequence with original
MAIN30/33 assets:fill0 → entry wipe25 retraces → portrait copy/helper input flush
→ caller text/cue → reveal25 → publication/reader → exit wipe25 → caller return.
There is no award-style extra middle wipe. The renderer preserves the outgoing
committed page and applies exact five-row stripe groups. Pixels remain
presentation data and never feed simulation.

Ordinary and forced reports defer their third RNG draw until portrait copy.
Enabled6e precedes reveal;enabled21 and rival location publication follow the
exit wipe. Player notices retain their own caller without invented21/reset.
Graphics do not open P/Q/S readers,and original helper/caller flushes discard
early input. Restart cancels the pending sequence. Driver ticks,retrace waits,
graphics work and browser scheduling remain separate.

Every real speech status read has a fresh query token. Cue acknowledgements and
stale query completions cannot satisfy a later read;completion during Pause is
observed through the next original query boundary. A muted absent device uses
its declared idle provider;muting does not fabricate completion of an existing
device. Conditional reader fixtures consume independently supplied status values
at the query boundary and do not count as actual audio acceptance.

## Evidence and scope

- Original identity/order:1238 original/prepared/Ghidra bytes,16 loader
  relocations and one exact preparation stack-probe transformation.
  [Source proof](report-presentations.md). Original bytes remain authoritative.
- Runtime checks:218 unit cases,21 report/notice reader-boundary cases and
  production build pass in the current combined gate. Focused historical checks at463b74c remain in
  `.local/report-runtime-checks-01`.
- Actual ordinary+player-collected route:
  `.local/report-player-presentation-01` and independent consumer
  `.local/current-report-player-replay-01`;27 exact full-state/decoded-RGBA checkpoints,
  543 independent DOM inputs,all58 intermediate state/pixel/time comparisons,
  missing-fresh-Pause negative and actual Restart.
- Actual ordinary+rival-collected route:
  `.local/report-rival-presentation-01` and independent consumer
  `.local/current-report-rival-replay-01`;the same27/543 and58 intermediate-frame checks and negative/Restart.
- Each route verifies45 exact row groups,50 entry/75 total retraces and three
  missing-group/pixel/incoming-page negatives. Completed targets come from
  separately retained earlier port pages;no image pixels are excluded.
- Forced claim candidate `.local/report-forced-presentation-01` naturally loses
  the first Standard Safari race,then exercises early input flushing,Pause,
  resume,fresh Fire,map and Restart. It captures31 checkpoints/1795 events;
  its independent consumer `.local/current-report-forced-replay-01` passes31 exact
  state/image checkpoints,1795 DOM inputs,all58 intermediate frame states/pixels/
  timestamps,missing-Pause negative and Restart. Zero forced claims fails the
  experiment. All45 forced-route row groups pass.
- Actual PC speaker and Tandy report probes on the current runtime:
  `.local/safari-hud-report-speaker-audio-01` and `.local/safari-hud-report-tandy-audio-02` verify
  enabled24/6e/fresh global status queries/21,real completion,nonzero signal
  samples and Restart. Host20ms/Game16ms is an explicitly conditional profile;
  no audio completion values are injected.

These checks are port regression and browser I/O evidence,not original native
transition captures or uninterrupted elapsed-time/waveform parity. Resource
loading,text costs,remaining CPU/IRQ phase,and the rival updater's earlier clear
at126b0034 remain outside this engine's charged helper work. Broader sound-call
adaptations and expedition audio routes still require review.

## Reproduction

Use clean committed source,original assets matching `reference/build.json` and
fresh ignored output directories. Missing/corrupt local evidence fails setup.

```sh
node scripts/verify-report-presentation-acceptance.js
node scripts/verify-report-presentation-source.js
node scripts/verify-report-presentation-rows.js --manifest=reference/current-report-player-rows.json
node scripts/verify-report-presentation-rows.js --manifest=reference/current-report-rival-rows.json
node scripts/verify-report-fixture-negatives.js --manifest=reference/current-report-player-browser.json
node scripts/replay-report-presentation-browser.js --manifest=reference/current-report-player-browser.json --output=.local/report-player-replay-FRESH
node scripts/replay-report-presentation-browser.js --manifest=reference/current-report-rival-browser.json --output=.local/report-rival-replay-FRESH
node scripts/replay-report-presentation-browser.js --manifest=reference/current-report-forced-browser.json --output=.local/report-forced-replay-FRESH
node scripts/probe-rival-audio.js --device=speaker --output=.local/report-speaker-FRESH
node scripts/probe-rival-audio.js --device=tandy --output=.local/report-tandy-FRESH
npm test
npm run build
```

A fresh producer can be explored with `probe-report-presentation-browser.js`
(`--reason=player|rival`) or `standard-wages-explore.js --forced-report`.
Captures alone are candidates;independent consumers and row checks are separate.
Shared original DOSBox state was not touched. Proprietary assets/captures remain
ignored;only permitted source,recipes and manifests are versioned.

The forced row checker observes incoming pixels at the renderer's actual canvas
read and returns the same ImageData unchanged. The independent replay compares
every producer report frame before its source observations are used. The only
black post-bank incoming page is narrowly scoped to rival3,location0,bank3400,
cash0 and the original main1036..107f caller hash/1076 clear-and-flip bytes.
The forced claim requires its actual nonblank flight page. There is no arbitrary
blank fallback or expected-pixel injection.

The current combined report gate passes after Safari HUD integration:85 exact
checkpoints,2881 independent DOM inputs,174 intermediate frames,135 stripe groups,
three Pause negatives,five setup negatives,218 units,21 reader cases and build.
The real Tandy probe now allows1500 iterations with the same20ms host/16ms Game
provider. Sound6e lasts about12.8 seconds in the translated original driver;the
old500-step limit guaranteed only10 seconds of deliberate host waiting. A valid
current run takes510 steps. No game clock,driver or device completion is changed.
An intentional1-step negative exits with an unfinished diagnostic and preserves
actual Game/audio state. The old failed500-step run has no terminal snapshot,so
its exact last stage is unknown. [Window evidence](../reference/report-audio-observation-window.json).
