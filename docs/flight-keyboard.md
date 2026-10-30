# Physical flight keyboard

Only the 22-file pairing in `reference/build.json` is supported: EXE SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`,
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender.

Flight now consumes ordinary IRQ flags at its actual input calls. The browser
uses the same backend as ground expeditions, including physical make/repeat,
release, I/J/K/M aliases and keypad codes. Empty flags never fall back to the
held-control adapter. Component fixtures retain their explicit digital provider;
the original physics and already-decoded native comparisons are unchanged.

## Source rule and handoff

Overlay4:000c writes mode3c1=0. Its02ae reader follows physics, page presentation
and collision handling;02b3 stores AX and02b6 tests Fire bitsC0. At0333..0352,
pitch masks3f and accepts only1 or5. Keypad diagonals remain distinct, rather
than becoming a cardinal direction. Existing speed/physics translation is used.
Resident11c4:09f5 flushes once, then polls before each0/7 driver wait; flight
passes20. Its0a33 reader and0a3b Fire test use the same physical provider.

Mode0 retains a held raw slot. A break marks40; the next scan removes the slot
and still consumes that key once. Ascending raw scan priority occurs before
I/J/K/M normalization. The unchanged reader has its separate36-call original
keyboard regression and complete128-flag comparisons.

Departure holds a table without polling. Its unconditional portrait flush clears
early keys; reveal keys survive into the flight table, whose mode changes to0
without clearing it. Starting with a fresh table before the portrait flush is
observationally covered by that flush before any ordinary read. Input/actor
state is not initialized from a native expected checkpoint.

Flight's special-control helpers, return prompt and system-dialog flushes clear
the physical flags at their existing source sites. An OS-held key needs a fresh
make/repeat after a flush. No typematic timer is invented. On-screen action
buttons supply physical make/break taps in flight and ground expeditions;
keyboard holds remain the sustained-control interface.

`Flight` accepts an optional eight-bit byte provider, validates it at consumption,
and records its actual consumed bytes. The separate return log records the
resident prompt's polls. `Game` owns flags/mode, mirrors them into active flight
DS:276c..27eb and DS:3c1, and exposes read-only diagnostics. The DOM supplies
physical events; explicit driver/retrace time advances simulation independently.
Pause suspends the pending ordinary read; its resume flush clears held slots.
Restart discards the program and deferred input.

## Reproducible evidence

Run `npm run verify:flight-keyboard`. Missing originals/artifacts, changed bytes,
unfinished streams, skipped reads, unconsumed events or differing values fail.
The browser runner requires all nine selected scenarios, with zero skipped.

`reference/flight-keyboard.json` pins the parent native manifest, four local
Ghidra exports, current sources and an independent input-only profile. Its16
expected bytes and16 complete flag arrays remain separate from the14 hardware
events in `flight-keyboard-inputs.json`. The implementation carries its own
flight/keyboard state between reads. Source-read ordinals are an explicit
controller contract, not a fitted native elapsed-time replay.

The static packet contains45 instructions /139 bytes. Export with Ghidra MCP
`disassemble_bytes`, explicit program, `follow_flow=false`,
`include_instructions=true`, `max_instructions=60`, saving complete responses
under ignored `.local/flight-keyboard-01/`:

| File | Program | Start | Length |
| --- | --- | --- | --- |
| mode.json | FLIGHT_ANALYSIS.EXE | 1000:000c | 5 |
| reader.json | FLIGHT_ANALYSIS.EXE | 1000:02ae | 14 |
| direction.json | FLIGHT_TRANSLATION.EXE | 1c17:0333 | 32 |
| return.json | DUCK_UNPACKED.EXE | 11c4:09f5 | 88 |

These ranges contain no normalized stack probes or software-FPU replacements.
Each instruction matches the original overlay or relocated resident image.
Flight instructions also match retained native code after exact segment
relocations. The entire88-byte native return helper is checked independently.
The existing flight-input verifier checks the full17,548-byte native overlay,
248 relocations and all91 justified runtime FPU-prefix changes. This establishes
actual game code and static/native address correspondence, not a loader stub.

Three retained native checkpoints have mode0 and empty128-slot tables; the
original flight02b3 AX=0 agrees with an independently empty reader. These are
separate from the16-case independent integration stream. Neither native timers
nor outputs are replay inputs. No live emulator session, guest write or partial
machine restore is used by this milestone.

Six native/integration negatives alter a source byte, omit a release, change an
expected result, change mode, corrupt the consumed byte or leave an input
unconsumed. The byte-corruption control checks the value reaching flight, in
addition to the keyboard table's recorded return. The browser negative drops
only the mode0 M-release consumption in the served module and must fail the
explicit release-edge assertion; setup errors and timeouts do not count.

Actual browser cases cover reveal carryover, source flushes, aliases, release
edges, keypad direction, button taps, Pause and Restart. Two natural crash cases
check all20 neutral return polls and a fresh Fire ending at poll2. The remaining
six scenarios retain automatic departure/pixels, destination controls, banking,
and the complete cave landing/failure/retry/treasure/return route.

The new departure/destination runtime-refresh manifests require their immutable
parents and exact equality of every old input, expected value and comparison
rule. Only source identities change. Historical manifests/receipts are preserved.

## Limits

This establishes shared native keyboard rules plus independent integration and
browser behavior. It is not a new uninterrupted original flight/actor replay or
complete timing acceptance. Modifier/BIOS behavior, original repeat cadence,
mouse/joystick input and physical IRQ delivery across other scene boundaries
remain open. Ground input, drawing/audio budgets and broader campaign source
receipts retain their separately documented limits. The full `npm run verify`
remains red; the focused gate does not waive it.

The manual in-app browser bridge currently fails to reconnect with
`browser.user is unavailable`. Its tab inventory still works and the existing
Playwright runner works. A focused bridge correction should repair existing-tab
resolution/reload without relying on the unavailable user-browser interface;
no replacement browser framework was built for this issue.
