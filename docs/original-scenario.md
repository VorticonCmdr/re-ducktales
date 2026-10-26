# Reproducing the original experiment

One owner controls the DOSBox session. Do not let other chats/workers change its
keyboard queue, breakpoints or memory while capturing. Tool revision:
dosbox-automation 0.84.0-vc1 (f6d9b), MCP protocol 1.14, bridge 0.1.1.

The managed instance starts with `--noprimaryconf --nolocalconf`, SDL dummy video
(headless) and muted audio. Read-only CONFIG queries after the experiments
confirmed: machine `svga_s3`, 16 MB RAM, configured core `auto` (effective `normal`
in the debugger), cputype `auto`, cpu_cycles 3000, cpu_cycles_protected 60000,
and cpu_throttle off. The legacy `cycles` property is empty/deprecated in this
build; query `cpu_cycles` instead. These settings are pinned in both manifests.

## Launch and reset

1. `bridge_start`, then `dosbox_status(detail:true)`. Confirm the returned live
   instance ID: the start handshake can briefly report a previous instance during
   startup. Do not bind address mappings until status names the actual process.
2. Mount the absolute project `game/` directory read-only as C. Y and Z may be
   present as emulator defaults; no assets are read from those drives.
3. At the shell, `input_type("c:\nducktale\n")`. Use LF (`\n`) for shell submission;
   CR is not a reliable submission through this tool.
4. Answer the joystick prompt with a hardware `KBD_n` press/release. Advance the
   intro with hardware Space presses, checking the difficulty screen, then choose
   Easy Money with Enter. The office is the first gameplay screen.
5. To reset, Escape opens the original quit dialog; hardware Y exits. Relaunch
   from C:\ with `ducktale\n`. This reruns the original loader and initialization.
   Revalidate live paragraphs and signatures after every relaunch.

`input_type` is useful for the DOS shell, but its injected text did not drive this
game's custom keyboard reader reliably. Hardware `input_key` / `input_sequence`
events did. Use paired press/release events. A focused bridge improvement would
be to document or expose the distinction between text/BIOS injection and actual
hardware-key injection; do not build a keyboard emulator around that limitation.

## Office → money bin

The office input routine is overlay 2:02e4. Its poll at 03c2 maps Up to money bin,
Right to stock trading, and Left to control center. Its current selection can
reset on subsequent idle polls. A short Up press followed much later by Space
is insufficient. A reproducible emulator-side burst uses:

```json
[
  { "key": "KBD_up", "pressed": true, "t": 0 },
  { "key": "KBD_space", "pressed": true, "t": 0 },
  { "key": "KBD_space", "pressed": false, "t": 100 },
  { "key": "KBD_up", "pressed": false, "t": 100 }
]
```

Wait for `replay_status`: all four dispatched, none remaining, active false.
The money-bin screen uses MBIN.ARC #000 with Scrooge on the board. Its six intro
poses have explicit 28-tick waits; idle poses use 14 ticks. Input is polled at
body+022a. The local `[BP-8]` counter is the **next** pose, so 3 means pose 2 was
just displayed. Pose 3 displayed leaves counter 4 before normalization.

## Exact segment capture

The existing failed-dive fixture is a conditional segment capture, not a fresh
campaign replay. Its initial conditions were observed: next-pose counter 4,
DS:4e26 == 1 (coin already taken), then one hardware Space/fire returned AL=c0
at overlay 9:0270. No game memory/register values were injected.

1. Pause, identify the live overlay 9 paragraph with original bytes at 022a. In
   the captured launch this was 0e0c; game DS/SS was 1403. These are not constants
   to blindly reuse. Main RNG signature mapping is in `docs/executable.md`.
2. Add execute breakpoints while paused, then continue to arm them. A breakpoint
   added while never paused is otherwise inert. `debug_wait` must receive the
   **current** stop ID; a stale ID can return an old stop immediately.
3. Break at overlay 9:0270 to record actual input result and `[BP-8]`. Break at
   06ee if checking the final airborne sprite: #001 frame 9 at (113,89), board
   #004 frame 0 at (186,94).
4. For the failed-dive ending, break at overlay 9:09fb. On each of 14 hits,
   atomically read DS:3b3c (60 bytes), SS:BP-10 (10 bytes), DS:4e26 (2 bytes).
   Save the resulting trace locally in `.local/reference-failed.json`.
5. Advance with continue/wait using each new stop ID. Keep the complete sequence;
   missing or reordered steps are failures. Remove only this scenario's own
   breakpoint IDs and release its own keys afterward.
6. After return, capture the raw 320×200 office screen to
   `.local/original-office.png`. Confirm the idle office has no overlay/menu text.

The committed manifest pins both artifact checksums. Recapturing into a new file
must update/review the manifest deliberately; never regenerate expected outputs
from the JavaScript implementation.

```sh
npm run verify:build
npm run verify:reference
npm run test:browser
```

The segment checker starts its own MoneyBin state and consumes an independent
single-fire schedule. Collapsing earlier periodic idle cycles to the same phase
is a conditional alignment rule, declared in the manifest. It is not evidence
of a full original campaign/environment replay. Pixel equality is currently
established only for the office screen.

## Checkpoints versus snapshots

No full machine checkpoint or partial memory restoration was used. Raw memory
reads are observations only. Restoring the sampled 60-byte sprite region would
not restore keyboard queues, timer/PIT state, overlay allocations, registers,
heap, framebuffer planes or audio. Such a partial restore is not a valid restart
for this scenario. Use the original quit/relaunch procedure instead.

## Limits and meaningful timing

Timed input schedules run inside DOSBox; model latency does not place the events.
Debugger stops freeze execution and alter host elapsed time. The current segment
comparison aligns by presentation checkpoint, not by host timestamps. The Lua
script tool supports memory and input but not CPU registers/debugger/ports/pixel
capture, so breakpoint captures use the dedicated debugger plus atomic batch
read APIs. This is a deliberate small experiment loop, not a general compiler
or emulator project.

## Successful branch and final-pose captures

A fresh original launch was also captured. At overlay 9:022a, use a conditional
execute breakpoint on SS:BP-8 == 3 while DS:4e26 is zero. Remove that breakpoint,
queue one hardware Space, and break at 0270. The captured AL is c0 and next-pose
is still 3. At 0287, the original local won byte and global latch have become 1.
Break at 092f for fourteen successful poses, reading DS:3aec (20), SS:BP-10 (10),
and DS:4e26 (2) at each hit. After the fourteenth, break at main 01f5:0268 after
the ADD/ADC cash update; DS:8cc0 (4) is exactly 1000. This local artifact is
`.local/reference-win.json`, pinned by `reference/money-bin-win.json`.

To capture the failed ending's unchecked frame index, revisit the bin after the
coin latch is consumed and fire again. Condition the 09fb breakpoint on
SS:BP-4 == 13, then capture the raw native screen. The current local artifact is
`.local/original-failed-end.png`, pinned in the failed-case manifest. Its browser
comparison observes the renderer's synchronous `gamepresent` event at the matching video-presentation boundary;
it does not inject game state or derive input from the expected image.

The failed-ending screenshot captured while the debugger's counter is 13
displays the preceding video pose 12. A direct comparison against browser pose
13 first failed on 43 coin-particle pixels; pose 12 matches every RGB pixel.
The manifest scopes this one-frame capture alignment to this paused boundary.
It does not shift input events, fit a timer, or exclude differing pixels.


The browser emits `gamepresent` after rendering each nominal video-retrace step.
This captures all logical presentations even when a 60 Hz browser compositor
coalesces multiple 70 Hz game updates into one visible monitor refresh. Sampling
only the final requestAnimationFrame state was found to skip the short pose in
some runs; the strict pixel check now observes the actual renderer boundary.
This establishes renderer output, not physical display scanout timing.

## Debugger stops and timed input

Observed on f6d9b/protocol1.14: a timed PIC input chain stops dispatching while
the debugger is paused, but its elapsed wall time continues. On resume, overdue
press/release events can collapse into a burst (observed drift23139ms). Do not
carry a timed multi-event chain across a capture stop. Cancel its pending events,
release its own held keys, then start the next schedule after establishing the
new boundary. Frame-relative chains or one-event held inputs are preferable.
A focused engine correction would pause a PIC chain's timeline with emulation,
or explicitly expose this wall-time behavior and overdue event policy. Captured
cave comparisons use no controls after entry and do not rely on these setup
intervals as an original timed input replay.
