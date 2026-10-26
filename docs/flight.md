# Flight translation and evidence

Build: `reference/build.json`; overlay 4 SHA-256
`cefab7184f72f605af90ddcf9b8cc8027870fdacb9922acdb68e8d6212db3ae9`.
The physics module is implemented and has conditional routine comparisons.
**It is not connected to browser gameplay yet.** Departure preparation remains
the last working browser boundary. No flight or arrival acceptance is claimed.

## Implemented rules

`src/game/flight-physics.js` translates overlay offsets 1330–194a, stall helper
2cf8–2d3f, and the main loop's throttle/turn sampling. It accepts one explicit
64K data segment. State and constants retain their original offsets; the memory
object owns a copy, including when its input is a Node Buffer. It never reads
DOM state, browser time, host randomness, or an expected output.

Original vector constants at DS:0ee2 give sixteen headings. Heading 0 moves
right, 4 up, 8 left, and 12 down. The flight entry builds DS:5516 gravity vectors
by multiplying these float32 values by the float64 constant 0.6 at DS:32ca.
Physics stores round to float32; intermediate arithmetic retains JavaScript
double precision. This matches the captured software-FPU results exactly for
the cases below, but does not prove every possible extended-precision result.

Physics moves the plane, applies gravity/climb speed changes, consumes turn
requests, follows/clamps the camera, handles stalls and ground collisions, and
writes sprite position, frame, and collision bounds. A ground bounce increments
the bounce byte. A further impact after two bounces returns the crash sprite.
The dry-ground crash early return preserves the original uncleared turn requests
and old plane bounds. Camera following adds the horizontal displacement a second
time, as in the original 1559–1574 / 159f–15b5 code.

Throttle is sampled **after** physics/render/collision processing. Held fire adds
0.25 below speed 14 and subtracts 0.25 at/above it. Without fire, speed >=0.01
loses the original float32 0.15, then clamps below zero. Turn requests are sampled
for the following physics update. Original heading-dependent speed thresholds,
signed 16-bit camera fields, and truncation toward zero are deliberate.

The return value separates a sprite pointer, sound request, and required water
splash retraces. The caller must gate sound using original sound-enable state.
Water splash rendering is **not implemented or validated** by this routine;
its three retraces must be supplied by the later flight effect adapter. No
device completion or wait is silently simulated here.

## Conditional reference scenario

Continue `reference/expedition-departure.json` at the first flight entry: day7,
Easy Money, Klondike slot25, duration1, racing1. The original plane begins at
x0/y139, heading0, speed0. This session used normal core, 3000 cycles, svga_s3,
headless/mute, read-only `game/`, DOSBox MCP 0.84.0-vc1 f6d9b.

Original main load paragraph is 01f5; helper0603; DS/SS1403. Flight overlay base
is 0e0c for this loading. Before trusting those addresses on another launch,
compare original relocated code bytes, actual CS/DS, and real-mode status.
At the physics entry, original bytes begin
`55 8b ec b8 12 00 9a 9e 1e 03 06 56 a1 18 6d 8b`.
The return at 194a is `cb`; AX contains 6f3e or 4d1e. These bytes and addresses
were checked live. All execution uses the unmodified original EXE.

Capture CPU plus DS:0000 length65536 atomically at entry 1330 and return 194a.
Pause, add breakpoints, continue to arm, and use a newer debugger stop ID.
Eight local before/after pairs are pinned in `reference/flight-physics.json`:

| Update | Starting condition / exercised behavior |
| --- | --- |
| 0 | Stationary first update |
| 1 | First 0.25 throttle movement |
| 26 | Speed6.5, ground roll, x81.25 |
| 31 | First captured turn request while camera follows |
| 32 | Heading15, diagonal gravity and acceleration |
| 33 | Heading14, second ground bounce |
| 35 | Heading0 after bounce, preserved camera state |
| 37 | Third ground impact, dry-ground crash early return |

For capture: after update0, hold Space; skip24 entry hits after update1 to reach
26. After26, request Space+Up; skip4 entry hits to31. Capture32 and33 on the next
entries; skip1 to35 and skip1 to37. Each pair's captured internal state is the
authoritative **conditional input**. The input schedule is a setup recipe,
not a claim of a deterministic event-only replay: debugger stops and timed-input
dispatch affect the intervals. No expected result supplies a simulation input.
No memory injection, partial restore, or full machine checkpoint was used.

The verifier checks all game-state fields written by physics, exact return AX,
and the statically inferred sound request. It excludes stack, software-FPU
workspace, timer, driver memory, and other CPU registers. Those exclusions are
limited to this routine comparison. Two additional checks compare only throttle
and turn fields after31→before32 and after32→before33; intervening render,
collision, terrain, and object updates are not replayed. Removing a turn,
altering crash position, and removing a case all fail negative controls.

```sh
npm run verify:flight
```

The command rejects missing/corrupt artifacts, unexpected capture layout,
incomplete memory, wrong addresses, zero/missing cases, and unequal bytes.
Missing artifacts are setup failures; they must be recaptured using this recipe.
These local captures contain original data and remain ignored by Git.

## Analysis preparation

```sh
npm run prepare:flight-analysis
```

This first verifies/unpacks the original via the existing preparation script.
It creates an **analysis-only** combined resident/overlay MZ under `.local/analysis`.
Overlay relocations reference paragraphs 0c17/0ed1/0ef1 in the whole image;
treating them as body-relative gives wrong addresses. The combined image places
the overlay at image c170 and combines the relevant relocation tables.

Software-FPU escapes CD34..CD3b are exposed as same-length NOP+x87 pairs;
CD3d becomes WAIT+NOP. Recognized fixed compiler stack probes become same-length
SUB SP,imm16+NOP, removing their relocation operands. All original bytes, patch
offsets, source/output hashes, function boundaries, and CS-relative switch table
locations are recorded in `flight-analysis-patches.json`. This image must never
be executed, deployed, or substituted for game assets. Read original disassembly
when an analysis patch could affect interpretation.

Ghidra import base1000 gives flight root1c17 and DS220e. Clear loader SP/SS entry
context over overlay functions; set DS220e. Bound functions using the recorded
offsets. Some far-segment aliases cause Ghidra to resolve near switch targets
against the wrong base: read original CS-relative table words and use explicit
JumpTable overrides. Decompiled C is supporting evidence only. The object
generation routine at root36c9 repeatedly kills the decompiler process;
continue from original disassembly rather than building a general translator.
A focused Ghidra MCP improvement would report this failure with the decompiler
log and retain a bounded instruction listing for the failed routine.

## Remaining flight work

Terrain generation is statically understood but still needs a capture immediately
before object placement. That later routine conditionally changes terrain11 to8
and the following tile to0 (3a68–3a89); comparing the earlier generator directly
to the first displayed frame is invalid. Objects, collision responses, race
movement, scenery rendering, crash animation, flight timing, day changes, and
arrival dispatch remain to be integrated. The original render routine also
mutates gameplay state, so a pure Canvas renderer cannot simply replace it.

The live session has advanced through the dry crash to the campaign map and
Glomgold's treasure message. It is no longer at the departure-entry checkpoint.
The completed flight returned AX0 at main0855, day8; this observation is saved
locally but is not yet an acceptance check of campaign crash/race consequences.
