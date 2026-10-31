# Flight repair and wreckage input

Supported build: `reference/build.json`, the original 22-file pairing. Hard
campaigns remain deferred. This work targets ordinary crashes; a lost flight race
uses the separately verified rival-claim reader instead.

## Source rule

`reference/repair-input-source.json` pins 119 original/Ghidra bytes in prepared
`INVESTMENT_CODE.EXE`, three loader relocations, and the actual byte correspondence
to the unpacked original. Main `08ea` adds two days using a byte operation. Main
`08f3` calls resident `11c4:09f5(60)`; `0ae5` calls `09f5(100)`. The shared helper
flushes input, reads immediately, waits seven driver ticks for each neutral read
and never performs read count+1. P/Q/S are processed within its ordinary keyboard
reader. Modal return flushes old input and resumes the pending read.

Both callers test the return value and audio-enable byte before requesting click
`24`. Neutral completion requests no click. The surrounding `1fdc/1fe0` calls are
graphics reveal/wipe, not synthetic sound resets. Neither local wait caller adds
sound `0`. After the first wait, signed 32-bit cash <=0 skips both RNG and wreckage
search. Positive cash uses the existing original modulo10/loss calculation; the
unsigned low16 loss is subtracted from the unsigned32 account. Its second
announcement remains meaningful even when the selected loss is zero.

The decompiler/disassembler's displayed far destinations inside the containing
main function can be misleading. The original opcode `9a f5 09 c4 01` and declared
loader relocation establish the shared reader call. Raw original and relocated
Ghidra bytes are checked rather than trusting that display alone.

## Existing runtime evidence

`node scripts/verify-flight-runtime.js` passes four conditional original
crash/calendar/repair checkpoints, 27 presentations and three negative controls.
It carries the captured original crash state through repair day15/cash50 to the
wreckage announcement with seed46558/cash25. This is conditional segment evidence;
it does not establish a complete original input replay or native presentation
timing. See `flight.md` and `reference/flight-runtime.json` for its starting state,
address correspondence, capture configuration and comparison exclusions.

## Repeatable browser exploration

`scripts/explore-repair-input.js` starts the actual application and replays the
immutable DOM prefix from `reference/easy-cave-variants.json`. Default exploration
uses two real bank/office detours and the recorded non-racing Carlsbad departure.
The authored takeoff/stall input is Space held1200ms, Down held300ms, then another
800ms before releasing Space. The real flight supplies the crash outcome.

`--positive` first completes the recorded Carlsbad treasure route, earning2800,
then chooses Klondike and flies the same authored crash schedule. No account,
calendar, RNG, destination outcome or audio completion is injected. The browser
clock uses origin1, BIOS0 and8ms display steps. Its full DOM event schedule and
observed snapshots/images are saved separately. `--controls` explores Pause,
Quit-No, fresh Fire, optional wreckage and arrival at the real expedition screen.

Baseline zero-cash observation `.local/repair-input-before-01` reaches repair on
day16/cash0/seed4656. P opens Pause immediately at the next driver tick with the
countdown still420; this differs from the shared reader's next seven-tick boundary.
The baseline archive and snapshots are exploratory evidence, not acceptance.

The positive baseline `.local/repair-positive-before-02` reaches day20/cash2800/
seed57424 and exhibits the same immediate Pause. An earlier positive exploration
incorrectly waited for an office-only destination menu after leaving Carlsbad;
it timed out and is not evidence of a game dead end. Away from the office,
map Fire travels directly. The corrected exploration uses that real path.

## Implemented boundary and observed recovery

Runtime `cabc06c` reuses `ResultInputWait` and the mutually exclusive result-key
queue for repairs. Both phases flush before their first read, sample P/Q/S and
Fire at the shared reader, freeze the wait inside a modal, resume that same read
and emit enabled24 only for consumed Fire. Wreckage's entry flush discards the
Fire which skipped repairs. Restart clears the reader and presentation state.
The existing loss calculation is unchanged.

The two actual-browser captures contain10/11 complete state/image checkpoints
and64/106 DOM events respectively. The zero-cash route skips wreckage and recovers
to Carlsbad cave on day16. The earned2800 route enters wreckage with loss700,
cash2100 and seed3667,then recovers into Klondike cave on day20. Its subsequent
guide independently advances seed to29715. Pause waits at remaining413 instead of
opening at420;Quit-No discards the queued Fire and requires a fresh one. Captures
are not self-acceptance: `reference/repair-input-browser.json` pins them for a
separate strict browser consumer with two missing-Pause negative controls.

The initial independent consumer stopped during setup because the recorder's
default Easy route has `hard:false`,with no separate difficulty field. The checker
now validates that actual format and every complete snapshot's difficulty0.
No expected snapshots or event streams were changed to correct the setup check.

The fresh consumer `.local/repair-input-replay-02` at`30c6bfe` passed all21 exact
complete state/decoded-RGBA checkpoints,170 events,both Pause omission negatives
and Restart. The unchanged full Standard route also passed85 checkpoints/5071
events and its selection omission negative at`cabc06c`. The saved current-runtime
receipt is `reference/repair-input-acceptance.json`;its checker validates producer
and consumer archives,all artifact checksums,current runtime hashes,194 units,
77 boundary checks,three invalid-setup negatives,build and the original segment
regression. Missing artifacts or changed accepted runtime fail the command.

```sh
node scripts/verify-repair-input-acceptance.js
node scripts/verify-repair-input-source.js
node scripts/verify-result-caller-source.js
node scripts/verify-flight-runtime.js
node --test scripts/repair-input.test.js
node scripts/verify-repair-input-setup-negative.js
# Clean committed source and fresh ignored paths required:
node scripts/explore-repair-input.js --output=.local/repair-before-FRESH
node scripts/explore-repair-input.js --positive --output=.local/repair-positive-before-FRESH
node scripts/explore-repair-input.js --controls --output=.local/repair-controls-FRESH
node scripts/explore-repair-input.js --positive --controls --output=.local/repair-positive-controls-FRESH
node scripts/verify-repair-input-browser.js --output=.local/repair-replay-FRESH
```

Native portrait reveal/wipe costs, CPU/PIT phase and acoustic parity remain
unverified. No new DOSBox experiment is claimed; the shared live emulator belongs
to another investigation and was left untouched.
