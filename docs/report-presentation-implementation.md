# Report presentation engine: isolated implementation

Branch `codex/report-presentations`,base `7579426`. This checkout is isolated
from the active129-checkpoint earned-route browser replay. Do not merge runtime
changes into its source checkout until that process is terminal.

Update:the earned-route replay is terminal and passed on the main worktree.
Runtime integration is now committed here at `b0bfaac`. Game scheduling,original
input flushes,renderer stripe pages and UI control availability are connected.
Ordinary/forced variants consume their third RNG draw after portrait copy;
location publication and21 follow the completed exit wipe. Sound6e precedes
reveal. Each real speech status poll has its own token,so an old cue ACK or a
completion during Pause cannot satisfy a later query. A muted absent-device
environment retains its declared idle provider;mute never fabricates completion
of an existing device.

At b0bfaac,210 units,21 report/notice input boundaries and build pass. Reader
fixtures now begin after actual graphics entry and carry their own clocks.
Their fake device consumes explicitly supplied status values at fresh query
boundaries;this is conditional evidence,not the real browser audio adapter.

Actual muted player-notice exploration `.local/report-player-presentation-01`
passes startup/cave/ordinary report/player notice/Pause/resume/map/Restart.
Its first16 full state/pixel checkpoints and509 inputs match the unchanged
startup prefix. All three completed report pages match independently retained
earlier port pages. The full27-checkpoint/543-input capture is a candidate until
its independent replay passes. All45 row groups,50 entry/75 total retraces and
three missing/corrupt/source-page negatives pass the separate row checker.
The final cleanup report correctly starts from the preceding notice's black
exit page. No image pixels are excluded. Native timing/pixel capture parity is
not established by those retained port targets.

```sh
node scripts/verify-report-presentation-rows.js --manifest=reference/report-player-rows.json
node scripts/verify-report-fixture-negatives.js --manifest=reference/report-player-browser.json
node scripts/replay-report-presentation-browser.js --manifest=reference/report-player-browser.json --output=.local/report-player-replay-FRESH
node scripts/probe-report-presentation-browser.js --reason=rival --output=.local/report-rival-presentation-FRESH
```

Next:independent player replay,actual rival-collected and forced-claim browser
routes,real speaker/Tandy device cases,and integration into the main worktree
only after relevant checks pass. The earlier component-only status below is
retained as the module's initial scope,not the current integration state.

`ReportPresentation` implements the statically checked picture3/10 sequence:
fill0 → entry wipe25 retraces → portrait copy/helper input flush → caller
text/cue callback → reveal25 → publication/reader callback → external reader →
exit wipe25 → publication/caller callback. Unlike an award,there is no extra
middle wipe before reveal. The original report cue6e precedes the reveal;
enabled21 and rival-location publication follow the exit wipe. Player notices
have their own source caller and no invented21/reset.

The class accepts original MAIN30/33 resources and explicit clocks/callbacks.
It consumes no game input,money,RNG or DOM state. Driver ticks cannot advance
retrace waits. Graphics work and zero-time publication continuations use the
same scheduler boundary shape as the existing award engine. Resource loading,
text costs and native CPU/IRQ phase remain unmodeled,as in the current award
presentation. The source proof is `reference/report-presentation-source.json`.
The rival updater's earlier clear at126b0034 also remains outside this graphics
engine's charged helper work. No uninterrupted native CPU timing parity is claimed.

Validation:`node --test tests/report-presentation.test.js` passes4 conditional
component checks with original resources. They verify both source portraits,
callback order,50 entry/75 total retraces,reader-controlled exit,clock separation
and rejected premature/invalid operations. This is **not integrated into Game or
the renderer yet**,and does not earn browser acceptance or native timing parity.

Integration still needs:

- Preserve the outgoing committed page and render source-defined stripe groups.
- Delay actual report input/status consumption until `readerReady`;helper and
  caller input flushes remain distinct. Ignore/flush graphics-phase input by the
  original reader boundaries,without opening P/Q/S early.
- Start enabled6e in `portraitReady`,not after reveal. Preserve global device
  status/completion during reveal. Do not invent completion when muted.
- Defer the original post-helper report-variant RNG draw to its actual copy
  boundary without rolling back or fitting seed/state.
- Start exit wipe after the external report reader completes. Release enabled21,
  rival location and main continuation only after `exited`.
- Wire graphics/continuation wakes and retraces separately from driver readers;
  Restart cancels the whole pending presentation.
- Explore actual ordinary/forced rival and player/rival collected-notice browser
  routes,then capture independent inputs,exact frames and strict replay/negatives.

Shared original DOSBox state was not touched. Original assets and local evidence
are symlinked read-only by policy;no proprietary output is tracked.
