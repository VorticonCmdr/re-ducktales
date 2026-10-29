# Map input integration in progress

The map pointer now consumes original raw make/release slots through
`OrdinaryKeyboard`, then performs the original caller flush. A held browser key
does not refill a flushed slot. Browser repeat events supply additional makes.
I/J/K/M and keypad directions retain their original scan order; the office also
accepts these physical bindings. The map caller uses `MapDeadline` with the
Game's unsigned driver counter and six-count steady polls.

Fire returns before the map caller flush/mode restore. Destination entry sets
mode1 and flushes the triggering key. The next destination choice needs a fresh
make. At this milestone,destination drawing,polling and choice waits still used the
older browser implementation. Subsequent[completed-page drawing](destination.md)
is now translated;entry/scanout/polling and choice waits remain open.

## Evidence and verification

`npm run verify:map-input-browser` requires the original local fixtures and runs:

- The original36-read,10-sequence keyboard comparison, all128 flags at each
  reader/caller boundary, full relocated overlay identity, five changed-input/
  output controls and missing/corrupt fixture controls.
- The separate original35-call/70-clock-result deadline comparison and controls.
- Two actual browser scenarios: the same independent36-read input profile, and
  one held make over30 reads, a fresh repeat make, Fire into destination choice,
  flight confirmation and Restart. No output-derived inputs or injected game
  state are used.
- Two actual browser negative controls: omit the K make and omit the repeated
  Right make. Both must fail exact value comparisons rather than time out.

The complete focused command,117 unit cases and production build passed on
`bcaaa99`. [The run manifest](../reference/map-input-browser.json) pins its539
producer files in a ZIP, terminal statuses, positive/negative logs,36 browser
observations and two screenshots. The14 local artifacts are retained under
`.local/map-input-browser-20261029-01/`; no proprietary artifact is committed.

The browser compares original input bytes, all128 flags before/after reader and
caller, pointer coordinates/acceleration/vectors/latch, modes and return codes.
It also requires six driver counts between every browser poll. Original steady
intervals match six; the original first interval is five because entry drawing
consumes a count. That initial drawing cost remains untranslated and is the only
native interval excluded here. This is not whole-scene timing or pixel parity.

Original capture provenance remains pinned to its archived producer and Git
revision. Later capture-script scenarios do not invalidate an immutable capture;
current simulation/checker sources remain guarded independently.

## Integration boundary

This work is on `codex/original-map-caller`; the accepted main preview remains
separate. The117 unit checks and production build pass. Focused browser checks
pass; this is not a new complete campaign acceptance receipt.

Replaying the unchanged historical office campaign inputs currently fails at
Easy checkpoint16 `bank-deposited` (transition band0 versus1), and Hard
checkpoint4 `rival-report` (remaining279 versus273). Earlier exact checkpoints
pass. These are unresolved integration differences after delaying map Fire until
its input poll; expected snapshots have not been rewritten or exclusions added.
Locate their causal timing boundary, then obtain fresh independent Game/browser
replays before integrating. The old full verification receipt remains historical
evidence for its original source only.

Read-only method-boundary traces now identify the first differences. Hard enters
the rival report at4019 instead of4013, exactly explaining its six-count remaining
timer difference at4020. Easy enters the bank at5896 instead of5891; its checkpoint
at5899 consequently observes the preceding five-retrace wipe band. The accepted
checkout independently still completes both unchanged replay contracts. No
inputs, clock values, expected snapshots or comparison rules were changed.
[The investigation manifest](../reference/map-handoff-investigation.json) pins
the observer and nine local artifacts. This explains the first divergences;
it does not establish acceptance of subsequent current-build checkpoints.
