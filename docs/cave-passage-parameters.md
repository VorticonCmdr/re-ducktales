# Original cave passage animation parameters

A natural original Carlsbad treasure comparison found the first sprite-state
difference after the final Down exit. Gameplay/RNG matched at all14 reads,but the
old port left torch14 at(-36,66) and passage frame2;the original has(-29,64) and
frame0. This exposed parameters that earlier outcome/RNG checks did not cover.

The corrected caller arguments are:

| Stage | Direction | Asset/kind | First pose | Frames | Coordinate table |
| --- | --- | ---: | ---: | ---: | --- |
| Entry | Right | 10 | 3 | 13 | 1848 |
| Entry | Down | 11 | 0 | 12 | 18ac |
| Entry | Up | 12 | 0 | 13 | 1910 |
| Entry | Left | 13 | 3 | 15 | 196c |
| Exit | Right | 10 | 1 | 12 | 187c |
| Exit | Down | 11 | 0 | 13 | 18dc |
| Exit | Up | 12 | 0 | 10 | 1944 |
| Exit | Left | 13 | 2 | 13 | 19a8 |

Previously all four entry kinds incorrectly used their frame counts. Kind selects
torch attachment/draw order,so it must remain separate from the loop count.
Down/Up/Left exits also began on poses2/2/3 instead of0/0/2. The seven corrected
matrix values preserve original table coordinates and RNG-call counts.

[Source declaration](../reference/cave-passage-parameters.json) pins333 original
bytes/132 instructions in five bounded ranges. A narrow constant-argument walker
follows only MOV AX,zeroing,PUSH and the original relative jumps up to helper2496.
It verifies all five pushed caller arguments for eight paths,plus each asset-load
call. Missing calls and a changed pose reject. This is not a compiler or CPU
emulator. Disassembly text is checked against exact original relocated bytes.

`verify-cave-passage-poses.js` exercises the actual coroutine for all eight paths,
checking every pose/kind/coordinate against those independently source-verified
arguments. The pinned prior module fails. The old ordering-negative class retains
its old synchronous module;only the seven reviewed matrix fields are normalized
for its unchanged-dependency guard. Other code changes remain rejected.

The [conditional native component](../reference/cave-treasure-component.json)
starts from the original overlay-entry DS,not an ending snapshot. It consumes a
separate14-reader-byte stream and carries its own state through seven moves and
the full treasure sequence. Every read and six treasure boundaries compare exact
16 gameplay ranges,16 common sprite position/geometry/frame records and the
shared passage sprite;the two treasure sprites are added at treasure boundaries.
All354 port publications render with no skipped publication. Historical poses,
a missing movement input and an altered expected ending seed must fail.

The reader stream is a declared projection of captured hardware schedules onto
source consumption calls. It is conditional input-boundary evidence,not a replay
of keyboard IRQs,BIOS queues or native timers. Allocation pointers,CPU/stack,
timers and device state remain outside this component contract. The DS condition
is not a complete machine checkpoint;no native machine is restored. No native
pixel alignment,timing or independent browser acceptance is claimed here.

```sh
node scripts/verify-cave-passage-poses.js
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_treasure_observation.py
node scripts/compare-cave-treasure-observation.js
node scripts/verify-cave-counted-loading.js --output=.local/cave-passage-poses-FRESH
```

The current combined command requires18 checks,including the new source/native/
component comparisons,the actual failure/retry/treasure/award/map browser route,
221 units,loading negative and build. Fresh source-pinned admission is pending.
The completed e59dd00 Standard win remains historical and unaccepted because
this parameter defect was found before independent replay. Corrected browser
campaign capture/replay and original whole-cave timing remain required.
