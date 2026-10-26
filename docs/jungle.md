# Jungle expedition

Jungle gameplay is not yet connected to the browser. The current foundation
loads the three original map resources into their original sparse DS records
and locates the starting platform. The next playable route is flight/guide →
walking/jumping among the initial platforms → consequence → restart, followed
by the complete expedition and campaign reward. No substitute mechanics are
implemented while the action loop remains untranslated.

## Source identity and analysis

Use the exact22-file pairing in `reference/build.json`. Jungle is physical
overlay8, file offset0x1fa00, declared length26104, header2048, body24056 bytes.
Overlay SHA-256:
`5782001bbf7e8d68b19274144a4e698a4fe1b9b577c7b5ff0614f4ace26ab0c4`.
Original body SHA-256:
`31690756aa6a355d980964a2f22d1aaccfe59f6bccefa872184a42245d659a9e`.
The resident dispatcher at image2c1b uses INT3F entry12 with the location flags
shifted right4 as a16-bit argument. Calls use16-bit far C stack conventions
(first argument BP+6, caller cleanup, AX return). This is actual16-bit real-mode game code;
the physical overlay's inherited MZ entry points to resident startup metadata.
The browser's supported EXE is EXEPACK packed; its initial loader is not used
as game logic. See `docs/executable.md` for the executable/loader evidence.

`npm run prepare:jungle-analysis` creates a local combined resident/overlay
analysis copy at image offsetc170. Ghidra import gives code entry1c17:0000 and
helper segments equal to original segments plus1000. The prep script normalizes
recognized compiler stack probes and software-FPU escapes for analysis only;
patches, original hashes and output hash are recorded in
`.local/analysis/jungle-analysis-patches.json`. Original files stay unchanged.
Ghidra entry bytes were checked against the prepared image: the original call
to040e:1e9e is replaced only in that analysis copy by SUB SP,00d4/NOP.

The map loaders decompile coherently and agree with original disassembly and
resident scanf strings. Ghidra's generic animation helper1f97:000c currently
follows overlapping invalid flow and produces an unreliable decompilation;
consult original bytes/disassembly when translating it. No P-code export or
recompiled decompiler output is used. Jungle has not yet been entered in the
live emulator, so its runtime segment and static/runtime address correspondence
remain unknown. Do not reuse the currently paused mountain's mapping for it.

## Map resource contract

JG.ARC entries1,2,3 are generic type4 records containing ASCII level tables
(3125,2868,2956 decoded bytes). Variant0 selects1, variant1 selects2 and
variant2 selects3. Entry0 and5/6/17 are actor sprites; entry4 is a320×200 picture;
the remaining sprites supply platforms, terrain and hazards. Complete sprite
semantics remain under investigation.

`src/game/jungle-map.js` loads records using the original16-bit signed fields.
It has no DOM, clocks, RNG or device access. An optional incoming `FlightMemory`
preserves the shared resident DS; a fresh run copies the original initialized
data and zeroes BSS. This map-loading function does not initialize actor
animations, hazards, heap resources or the complete game routine.

| Section | Original loader | DS base/stride | Addressing |
| --- | --- | --- | --- |
| L | da0:06ae | 6a26/14 | Sequential, printed label suppressed |
| A | 1090:08b6 | 95ea/8 | Sequential, printed label suppressed |
| B | 1090:08b6 | 6040/50 | Sequential, printed label suppressed |
| P | 1036:0157 | 397e/38 | Printed index |
| S | 1149:027f | 7034/38 | Printed index |
| V | 118a:0061 | 5d40/34 | Printed index |
| J | 118a:0061 | 5bb2/2 | Printed index |
| M | e7a:0230 | 58cc/62 | Printed index; initial X also copied to saved X |
| X | 11d4:016a | 776e/10 | Printed index |
| F | f26:0004 | 514a/32 | Printed index |

Offsets within each sparse record follow the original scanf destinations,
including B's initial X/Y at+42/+44 rather than+4/+6. The original B count is
stored at3a42; F count at882c. The loader reads exactly the declared count.
Variant0 has two consecutive B rows labeled30; they populate records30 and31.
Its F section declares16 while containing an extra row16; that trailing row
does not initialize fish16. These are source quirks, not corrected data.
The original1090:04d2 scan visits columns0..5, rows0..2 in that order and selects
the first nonzero A cell. Starts are respectively(0,0),(0,2),(0,1).

## Verification and limitations

Run `npm run verify:jungle`. It rejects missing/corrupt originals, requires
exactly3 cases/348 declared records, compares all65536 initialized DS bytes to
pinned independent static-oracle hashes, and checks the starting scans. Negative
controls corrupt the duplicate-label record, remove a case/section, overflow a
field, exceed table capacity and select an invalid variant. Additional checks
preserve the ignored trailing F row and unrelated incoming DS bytes.

`scripts/verify-jungle-oracle.py` independently follows the original scanf
formats using Python's memory packing and a separate section scanner. It reuses
the already verified archive/EXEPACK decoders only to obtain original bytes. It
compares its results with `reference/jungle-maps.json`; it never updates expected
values during verification. No proprietary resource dump is committed.

These are static map-loading checks. They do not prove jungle gameplay,
rendering, original runtime parity, input replay, audio or timing. The original
entry next initializes animation lists, hazards and randomized pickups, then
polls joystick input at body0651 before collision/scene passes. Actor action
selection is f97:06a9 (Ghidra currently fails to decompile it); camera movement
is body0591. Actor world X/Y are DS5f46/6858, current action6882, facing3d12
and platform column/row544c/5462. Translate the generic animation helper from
raw disassembly before trusting actor frame/state advances. Translate those
boundaries next and compare the initialized scene with the original before
claiming a playable jungle milestone. Existing cave and mountain browser routes
remain the working expedition routes.
