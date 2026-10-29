# Office entry and selection

The isolated development branch now runs the original office clear/reveal and
input loop before money-bin, control-center or investment departure. Main3973cc7
remains unchanged on5187. The focused command passes; full campaign migration,
the complete branch gate and main integration remain pending.

```
npm run verify:office-menu-core
npm run verify:office-menu
```

## Source rules and environment

The supported22-file build and original executable hash are in
`reference/build.json`. This is the same MZ/EXEPACK real-mode x86 build with
overlays and no extender. Ghidra `OFFICE_MAP.EXE` contains original overlay2;
the native capture validates all8368 bytes after180 relocations.

Overlay2:02e4 composes the office, clears the old visible page through graphics
slot1fe0, plays6 when enabled, then reveals the drawing page through1fdc. Each
graphics operation copies five interleaved row groups and waits five retraces
per group:50 entry retraces in total. Sound0 precedes composition when enabled.
There is no19a5 flush at this entry site. The renderer supplies its previous
visible page to the wipe as presentation history; it never supplies game logic,
input decisions, time or RNG.

At03c2 the original reader supplies a byte. Direction1 selects the money bin,
3 the control center,7 investments; other directions clear the selection. The
caller draws the label, flips at0406, waits one driver count, then checks Fire.
Neutral Fire cannot reuse an earlier selection. The common departure cleanup
at06bf flushes the key table before returning to the dispatcher.

The keyboard IRQ records80 for held keys and40 for released keys whose slot
remains present. Released slots are consumed once; the reader scans by scan
code. The office's zero3c1 flag collects the full poll, so Down outranks Right,
Right outranks Left and Left outranks Up in the tested arrow chords. Enter and
Space supply Fire. The office adapter carries explicit ordinary key slots;
global keys use the existing ordered system-input provider. The independent
input profile contains19 key-state events and63 read boundaries, transcribed
from the fixed capture recipe, without expected pixels or final-state values.

## Reproducible original evidence

`reference/office-menu.json` pins117 private artifacts from capture03, the recipe
at2eb25b1 and the separate input profile. Native entry is anchored before resident
main013a's original `INT3f` office dispatch, using fresh RNG/call-site/helper byte
correspondence. The allocated overlay is identified from its stack return02ef
and its complete original bytes, rather than a guessed allocation address.
The fresh graphics table and332 driver bytes are checked against IT.DRV1.
All observed stops are real mode.

The reference checks29 exact pictures:ten entry row groups and19 stable input
labels/neutral pictures. All63 input values are cross-checked with the original
CPU snapshots and a closed-loop component driven by the19 authored key events.
Eight direction/chord cases include make, held, released and neutral reads.
Neutral Fire and final Right+Fire also match. The original returns40, clears
all128 key-table bytes and leaves RNG unchanged. The owned process was confirmed
absent after capture. There are no memory injections or partial restores.

Native pictures are sampled after the original row-group waits; model pictures
are compared after the same row group is copied, before its wait advances to the
next group. Wait counts are checked separately. This is explicit copy-boundary
alignment, not a timing tolerance or a fitted timer. The initial page is an
independently authored black page after difficulty exit; its native picture is
also checked. This fixture does not prove the old-page pixels of every later
office return, whole Game state, CPU/IRQ timing or audio waveform parity.

Captures01/02 failed only during setup and are retained separately. The timed
startup sequence stops progressing while the debugger is paused. Setup03 ends
conditionally at the verified office-call boundary and explicitly cancels the
unused startup tail. Its status retains two cancelled events as `remaining`
despite `active:false`; these are recorded setup history, not unfinished required
experiment inputs. All required office sequences finish with inactive/zero
remaining status. Final releases are dispatched after the compared return40
endpoint; that later guest execution is excluded from the segment.

A focused bridge correction would distinguish cancelled historical events from
live pending events in replay status and document the paused PIC timeline. Also,
the installed `input_key(pressed:true)` wrapper appends a release: use explicit
`input_sequence` pairs when a held key is required. No shared8386 session or
global bridge configuration is changed by this recipe.

## Browser acceptance and limits

The new real-browser route compares the same29 pictures and63 input results,
using the authored key schedule, then enters the control center, completes
security and reaches the map. Tandy receives36 for difficulty confirmation,
then0,6 for office entry. A second route queues P and Up/Fire during the reveal,
observes no early poll, resumes pause and verifies that the flush discards held
controls. Restart cancels the live office component.

The focused command runs those two cases plus the five office/trading regression
cases. It rejects omission of the chord's real Right key at the original input
boundary. Five component negatives reject missing events, lost releases, wrong
chords, altered pixels and altered original code. Missing/corrupt required PNGs
also fail, and their restored originals must pass again. These comparisons do
not substitute for the pending complete branch/campaign gate.

The retained browser receipt pins29 actual canvas pictures, the seven individual
Playwright CLI case results, passed runner status and163 runtime/test/config
source files at5e5cb13. The checker validates the original-exact saved pictures
again and rejects removed, skipped or incorrectly counted case reports. The
source note distinguishes a later addition to the unused default verification
chain from the unchanged focused command that actually ran.

The current ordinary-key adapter implements arrows, Enter and Space. Original
letter-direction aliases are not implemented here yet. Wider cross-scene key
history and headless campaign adapters still need migration; this fixture does
not establish complete original keyboard behavior in every context.

Reproduce with the installed DOSBox MCP Python environment and the same
`DUCKTALES_DOSBOX_MCP_ROOT` setup described for
[investment departure](office-investments.md):

```
python scripts/capture-office-menu.py --output .local/office-menu-new --port 8387
```

Use a new ignored output directory. The recipe preflights the isolated port,
mounts the authoritative originals read-only, owns one emulator, batches reads,
uses current stop IDs, and stops only its own process in finally. Missing private
fixtures produce setup errors; they are not silently skipped or regenerated.
