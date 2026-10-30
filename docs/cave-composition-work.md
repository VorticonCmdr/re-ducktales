# Cave room and minimap drawing time

The runtime now waits at original room-composition, initial minimap and party
marker boundaries. This adds missing source work; the six-count movement
deadline, RNG and input reader are unchanged. Hard campaigns remain deferred.

## Source and workload

Only the22-file pairing in `reference/build.json` is supported, executable SHA256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Overlay6 is x86 LE16 real-mode game code. The preserved native cave body is11054
bytes with196 relocations. Two new Ghidra ranges compare all598 room/door helper
bytes after the1000-versus01f5 load-base adjustment and two declared zero-local
stack-probe normalizations. The analysis executable is never executed.

Original26bb restores320x200 RAM to video, draws missing-door, pit, distance and
nearby-trap overlays, then copies video back to the room cache. Both full copies
and every source sprite are charged. The512 source-derived cases cover all16
passage masks, eight distances, pit and trap-neighbor guards. These are branch
plan checks, not512 native captures.

The initial source draw of sprite37 and the cache builder now run before the
main cave loop. Party redraws charge their marker calls and mode1/2 cache updates.
Production minimap code must match the [analysis model](cave-minimap-work.md)
after import-path/comment normalization. Canvas reconstruction is not extra
original drawing. All five room-helper call sites, including treasure endings,
yield through the same workload boundary.

At the original Easy pauseReturn input, party work is126.157667ms in the declared
normal-core3000 cycles/ms model:355107 opcodes,3685 OUTs,16000 repeat iterations,
six sprites, one room copy and33 marker pixels. The old partial model is preserved;
its copy contribution is replaced with the native-checked signed primitive,
recovering two missing setup opcodes. Initial work including sprite37 is28.525ms.
The two room copies alone cost10.799667ms before room sprites. These are primitive
workload predictions, not measured uninterrupted original cadence.

Initial screen clear, resource/page-selection, other resident/caller/interrupt
and device costs remain unaccounted for. Full native speed and scanout parity
are unproven. No fixed slowdown or fitted timer is introduced.

## Verification

```sh
npm run verify:cave-composition
node scripts/verify-cave-composition-work.js
```

The focused gate requires a clean commit and archives it under a fresh ignored
`.local/cave-composition-integration-*` directory. It checks original resources,
code ranges, native primitives, conditional native cave checkpoints, four
independent component outcomes and closed-loop replays, all194 units, actual
browser controls and build. Missing/corrupt fixtures, zero/skipped cases and
unexpectedly passing negative controls fail. Source must stay unchanged.

The browser route starts the application, travels and enters the cave, observes
the work, pauses, cancels Quit, crosses a doorway, collects the room reward,
verifies held-key flushing and restarts. Its8ms observer must publish the room
boundary after the first input. Negatives remove only that wait, omit minimap
pixel/cache work, or remove all source drawing waits. Each must fail its specific
boundary assertion.

The expiry component reached the correct ending at the old10000-step watchdog
but still had214 driver ticks left in its terminal delay. Normal logic/clock
diagnostics completed at10214. Only the test watchdog was raised to15000: no input
ordinal, game clock, delay or expected outcome changed. The full outcome/replay
suite passes; no ending is skipped and no gameplay timer is fitted.

`reference/cave-composition-work.json` pins sources and parent evidence. Originals
and dumps remain ignored. This focused level does not refresh the complete Easy
contract: its old source guards correctly reject this runtime. A fresh complete
route and independent browser replay remain required for full campaign acceptance.
