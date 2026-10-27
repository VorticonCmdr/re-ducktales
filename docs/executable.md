# Executable identity and analysis boundary

Build identity and exact source hashes: `reference/build.json`. Only the original
`game/DUCKTALE.EXE` launched with the adjacent `game/*.ARC` and `IT.DRV` is supported.
The browser checks its required originals; `verify:build` checks all 22 files.

## MZ and EXEPACK

The 165,218-byte file is an old-style DOS MZ executable. Its MZ header declares
61,787 bytes, a 512-byte header, zero ordinary relocation entries, CS=0x0e8f,
IP=0x0010, SS=0x15ce, SP=0x0080. At file offset 0xeaf0 is an EXEPACK header ending
in `RB` (0x4252). The initial entry is the EXEPACK unpacker, not the original
application entry. Disassembly identifies the backward B0/B2 repeat/literal
operations and packed relocation table at unpacker+0x0125.

`npm run prepare:analysis` reconstructs an 87,664-byte image with 659 relocation
entries and original entry 040e:46c3. It also extracts ten appended MZ overlays
from 512-byte-aligned file offsets:

| Overlay | File offset | Declared bytes | Role currently established     |
| ------- | ----------- | -------------: | ------------------------------ |
| 1       | 0xf200      |            526 | Location/treasure setup thunk   |
| 2       | 0xf600      |           9392 | Office selection / transitions |
| 3       | 0x11c00     |           3830 | Not translated                 |
| 4       | 0x12c00     |          18572 | Launchpad flight (entry verified) |
| 5       | 0x17600     |          12514 | Mountain expedition (entry/walking compared; browser ascent) |
| 6       | 0x1a800     |          12078 | Cave expedition (entry/runtime verified) |
| 7       | 0x1d800     |           8436 | Photography (`ps.arc`; leaf routines verified against original; browser runtime pending) |
| 8       | 0x1fa00     |          26104 | Jungle (conditional state/pixels; browser completion/reward) |
| 9       | 0x26000     |           3348 | Money-bin activity             |
| 10      | 0x26e00     |           5986 | Not translated                 |

The original runtime uses INT 3F overlay dispatch. Appended overlays are distinct
from the EXEPACK compressed main image. Their inherited CS:IP header values must
not be mistaken for each overlay's function entry.

## Ghidra and address mapping

The preexisting Ghidra program `DUCKTALE.EXE` had imported only the packed image:
CODE_0 through 1000:e8ef, the unpacker at 1e8f:0010, uninitialized data, 203 detected
functions. This contains some literal game code but is not a reliable complete
application image. Do not use its unrelocated far-call destinations as truth.

Analysis uses `DUCK_UNPACKED.EXE` (x86:LE:16:Real Mode). This has main entry
140e:46c3 under Ghidra's 0x1000 load convention, data base 220e, and far calls
into translated game/library routines. Standard C functions use 16-bit far cdecl
arguments on the stack with caller cleanup; graphics-driver APIs often use RETF N
callee cleanup. Register-based helpers and stack-probe function 140e:1e9e need
special care: default decompilation sometimes invents stack variables/calls.
Meaningful widths and frame conditions were checked in disassembly.

Observed original launch:

```text
C: maps to the exact game/ folder, read-only
C:\>DUCKTALE
No joystick (hardware N key)
Main load paragraph: 01f5
Main helper CS: 0603 = 01f5 + 040e
Game DS/SS: 1403 = 01f5 + 120e
Overlay 9 code paragraph in this run: 0e0c (reused overlay allocation)
protected_mode: false, normal core
```

Main helper static 140e:0eb8 and live 0603:0eb8 both contain:
`a1 29 22 05 48 92 d1 c8 d1 c8 d1 c8 a3 29 22 cb`.
This proves the RNG mapping for this launch. It adds 0x9248 with 16-bit wrapping,
rotates right three times, stores and returns the seed. Seed initialization at
140e:0e01 reads BIOS 0040:006c. `nextRandom` preserves that exact update; the
activities consume this stream. The browser's initial seed is an explicit BIOS
clock environment value (zero); its initialization, travel, flight and cave
logic then advance their own state. Whole-campaign RNG parity is not claimed.

Live overlay 9:022a bytes (`call 0319:0002; test al,c0`) were compared with original
overlay bytes and their relocated segment. Overlay 2 was independently identified
by a 32-byte live signature matching its body+03a0. Do not apply the main mapping
to overlays, or reuse these paragraphs after a restart/changed allocation without
comparing bytes again. DOSBox debug_disassemble reports each instruction's
`offset` as a linear address, despite a segment:offset request; its returned bytes
and top-level segment/offset are the reliable mapping evidence.

## Important mechanic evidence

| Rule                                                    | Location            | Strength                                           |
| ------------------------------------------------------- | ------------------- | -------------------------------------------------- |
| Office Up selects money bin; fire enters it             | overlay 2:03cf–055e | Static + observed route                            |
| Six intro poses, alternating 0/1, delay 28              | overlay 9:0121–01b6 | Static                                             |
| Idle poses 2/3 with 14-tick delays                      | overlay 9:01b6–026d | Static + observed                                  |
| Rare coin requires next-pose counter 3 and DS:4e26 == 0 | overlay 9:0270–0287 | Static + observed timing gate and latch transition |
| Success sets DS:4e26 to 1                               | overlay 9:027d–0287 | Static + observed                                  |
| Nonzero return adds 1000 to 32-bit cash                 | main 1000:025d–0268 | Static + observed cash=1000                        |
| Failed-dive frame bytes 0–13, resource switches after 6 | overlay 9:09da–0a37 | 14 exact original checkpoints                      |
| Sprite mask keys first decoded pixel                    | main 140e:10e8      | Disassembly/decompilation + exact office pixels    |

Original bytes, unpacked binaries, Ghidra databases, screenshots and raw traces
are local-only. Committed manifests, translation code and recipes contain no
proprietary binary payloads.

Expedition preparation and flight-call mapping: [departure evidence](expedition-departures.md).
