# Original office transitions

The browser now runs office → original money-bin departure → dive → reward/return
→ Restart. The complete `npm run verify` gate passes on runtime6a02e89:117 unit,
74 development browser and2 production browser cases, zero skips. The immutable
receipt is `.local/office-integration-full-gate-20261028/`.
Control-center departure and security were subsequently connected and passed
the security-aware integration gate; see [security](security.md) and
[current status](STATUS.md). Investments departure and the initial office
reveal/selection remain unfinished.

Run `npm run verify:office` for the core, two actual browser cases and the
missing-Up negative. `npm run verify:office-core` checks retained evidence only.
Required originals and private captures must exist; missing or corrupt files
fail setup. The native comparison requires20 checkpoints,48 local artifacts and
three retained native input observations. It compares every RGBA byte and all
represented sprite tuples, validates the complete8368-byte/180-relocation office
overlay, and carries the departure through19 flips and255 driver counts.
Altered code, an altered pixel, a missing checkpoint and zero checkpoints fail.
Wait/sound literals and the exit19a5 flush call are checked in original bytes.

Two browser cases compare all19 departure presentations with original pictures,
use real Up+Fire and the visible button, discard queued P/held keys at the original
exit boundary, earn1000 through the actual dive, return, and cancel a second
animation with Restart. Tandy receives0,4,35,34,38 in order and produces nonzero
samples. Nine existing game/system/audio browser cases and117 unit cases pass.
A missing real Up must fail the required departure entry, not setup or timeout.
The Hard Game replay retains all25 exact checkpoints and3350 inputs; this is
port regression evidence rather than original whole-campaign parity.

These focused receipts and20 browser PNGs are pinned under ignored
`.local/office-browser-accepted-20261028/`. Their current runtime/browser source
identities are recorded separately from native capture provenance. The complete
application gate still must pass; focused results do not replace it.

## Rules and evidence scope

Overlay2:02e4 is the office input loop. At03c7, direction1 selects the money bin,
3 selects the control center,7 selects investments. Other directions clear the
selection. Fire with no current direction does not reuse a previous selection.
The label is drawn before the flip and one-count wait. The three retained AL
observations are0,1,193; they are bounded input observations, not a complete
original campaign replay.

Overlay2:0000 composes MAIN3 with MAIN8 at216,32; MAIN4 at120,8; MAIN5 at33,48;
MAIN6 at136,32; MAIN7 at120,48. MAIN5's x33 differs from the opening story's x32.
The money-bin label uses original EXE string0cf8 at120,16, white on an opaque
black eight-pixel row. This matches the original selected picture exactly.

Overlay2:0182 performs the money-bin departure. After an initial flip, counter15
through3 selects signed remainder modulo3 for MAIN6, flipping each pose and
waiting seven driver counts. This loop draws MAIN7 **before** MAIN6. Two
intersecting pixels differ if normal office layering is reused. Sound4 starts
the sequence. MAIN7 then changes to frame1 with sound35 and a seven-count wait;
sound34 precedes a73-count hold. MAIN4 frames1,2,3 each flip and wait28 counts,
omitting MAIN6/7. The caller cleans up and returns code38 at0559. Sounds and
wait counts are statically inferred; their complete native device trace and
elapsed CPU/IRQ timing are not established by the pixel comparison.

`OfficeMoneyBin` consumes explicit driver/retrace advancement and the sound flag.
It has no DOM, host time, RNG, file access or skipped animation path. Its caller
must handle the branch's pre-entry sound reset, archive ownership and subsequent
activity dispatch. The browser queues system keys during this uninterruptible path, then performs
the source06bf keyboard flush before normal campaign dispatch. Driver and video
clocks remain separate. The remaining office transitions are subsequent work.

## Reproduce the native capture

Single owner: this chat. Use the exact ignored game/ pairing in reference/build.json
and the DOSBox/Ghidra tools documented in docs/original-scenario.md. The supported
EXE is MZ/EXEPACK, real-mode x86, SHA-256
fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981.
The analysis copy OFFICE_MAP.EXE is original physical overlay2 with a changed
analysis entry header only; `python3 scripts/prepare-analysis.py` reproduces it.

1. Start a fresh owned emulator, mount the real game/ directory read-only as C,
   and launch DUCKTALE. Hardware N declines the joystick. Hardware Space skips
   the story, then Enter confirms Easy after the difficulty reveal. Complete
   every emulator-side input schedule before the next one.
2. Pause and scan for `55 8b ec b8 0a 00 9a 9e 1e ?? ?? c7 46 fc 00 00`.
   Subtract02e4 from its physical match to find the office allocation. Read the
   whole overlay and compare it to the original body with its180 relocation
   words adjusted by the actual load paragraph. Never reuse old addresses.
   This post-wait launch used load01f6, DS/SS1404, overlay2 at0e0d and EGA2ed8.
   The earlier exploratory launch used01f5/1403/0e0c/2ed7 and is separate.
3. Break after the input call at overlay03c7. Save the initial raw320×200 PNG,
   the complete DS observation and registers. Use a **single-event**
   input_sequence Up-down hold; continue through two reads so the selection
   picture is visible. Save the Up picture and state. Hold Space with another
   single event, continue to03c7 and require AL193. Release both keys and remove
   the input breakpoint. No registers, game memory or device state are injected.
4. Break at0200, after each original seven-count wait. Capture all13 hits,
   requiring local signed word SS:[BP-2] to descend15..3 without omissions.
   Save a raw PNG and atomic CPU/full-DS observation per hit. Each wait must use
   the immediately previous stop ID. No multi-event timeline spans these stops.
5. Remove0200. Capture0253 after the open-door wait,02a9 after the long hold,
   and all three02d7 hits after roof-frame waits. Preserve all five states and
   pictures. Remove only this scenario's own breakpoint IDs. No partial restore
   or machine checkpoint is used. The owned capture emulator was stopped after
   collecting the fixtures.

Post-wait fixtures are under ignored `.local/office-native-postwait-20261028/`;
the manifest records checksums and source coordinates. Earlier captures before
the waits observed pending display scanout and are exploratory only. The accepted
pictures use the original existing wait boundaries, with no alignment shift,
pixel tolerance, fitted timing or output-derived control inputs.

## Focused tool limitation

Bridge0.1.1 `bridge_setup(port:8387)` saved its configuration, but the already
running bridge subsequently spawned with cached8386. `bridge_start` initially
reported the unrelated engine's handshake; disconnect/connect plus explicit
engine PID/instance validation selected the newly spawned process. Read-only
listener inspection showed both emulator processes bound127.0.0.1:8386. During
this capture the verified connection consistently returned the owned DuckTales
instance43a3d5fe3c6dabff772df78826dbcbf7/PID96675 and original code bytes. That
owned process has now been stopped; the unrelated engine was never intentionally
controlled or stopped. The original bridge port setting was restored.

A focused correction should reload safe settings into the running bridge before
spawn, reject an occupied listener, and require the spawn handshake's PID to
match the child. Until that is corrected or an isolated endpoint is established,
do not launch another native capture by assuming bridge_start selected its child.
CPU-cycle query output was not independently retained for this fixture, so this
check makes no original wall-clock/CPU-rate claim. Full launch flags, engine
capabilities and instance identity are retained locally with the capture.
