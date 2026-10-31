# Report presentation engine: isolated implementation

Branch `codex/report-presentations`,base `7579426`. This checkout is isolated
from the active129-checkpoint earned-route browser replay. Do not merge runtime
changes into its source checkout until that process is terminal.

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
