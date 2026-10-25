# Sound resources and audition renderer

There are no WAV/MIDI files among the originals. Sound sequences and frequency
tables are embedded inside the compressed drivers in `IT.DRV`. Decode that file
using the same container/LZW routines as `.ARC`.

The current player interprets **resource #005**, a 7,253-byte PC-speaker driver.
Resource #004 (12,339 bytes) and #006 (4,142 bytes) are alternate sound drivers;
their decoded bytes are inspectable/exportable but their renditions are not
synthesized. Thus this is a usable PC-speaker asset viewer, not yet a complete
emulation of every sound hardware option.

## Verified locations in decoded resource #005

| Offset | Meaning / evidence |
| --- | --- |
| 0x021c | 16-bit PIT divisor lookup table used by the note handler |
| 0x0408 | Sound-start routine, accepts IDs through 0x78 (120) |
| 0x0456 | Loads sound pointer from table at 0x092b |
| 0x05ac | Sequence tick handler |
| 0x05eb | Reads command/note word |
| 0x0607 | Note duration / pitch handler |
| 0x08cb | Command-handler pointer table |
| 0x092b | 121 little-endian 16-bit sequence pointers |

There are 106 distinct sequence pointers. Multiple sound IDs alias the same
pointer; some point to immediate stop/silence. IDs are retained rather than
inventing gameplay labels. Each sequence starts with a priority byte, followed
by bytecode. Branch targets are absolute offsets in the decoded driver.

These offsets were established with local `ndisasm -b 16` disassembly. The
original timer is configured to PIT divisor `0x0555` (1365); the sequencer runs
once per 12 interrupts, about 72.84 Hz. A byte tempo accumulator gates duration
countdown. PIT clock is modeled as 1,193,182 Hz.

## Implemented bytecode

Below 0x80, a command is a packed octave/semitone followed by a duration byte.
The note handler looks up the divisor, shifts by octave, and adds detuning.

| Opcode | Arguments | Behavior |
| --- | --- | --- |
| 80 | u8 | Set loop counter |
| 81 | u16 | Decrement loop counter and branch if nonzero |
| 84 | u16 | Jump |
| 85 / 86 | u16 / none | Call / return (one return slot, as in original) |
| 87 | u8 | Octave offset |
| 89 | u8 | Rest |
| 8A | none | Engine pitch approach (approximate audition) |
| 8B | u8 | Note gate duration fraction |
| 8C | u8 | Semitone offset |
| 8D | u8 | Stutter |
| 8E | i16, u16 | Noise pitch slide and limit |
| 8F | u16 | Noise base divisor |
| 91 | i16 | Tone divisor slide |
| 92 | none | No-op |
| 93 | u16 | Pitch divisor offset |
| 94 | u8, u8, u16 | Noise setup (approximate) |
| 95 | four u8 | Vibrato rate, span, shift, delay |
| 96 | ignored byte | Disable noise and speaker |
| 97 | u16 | Engine target divisor |
| 98 / 99 | none | Parameterized engine state (fixed audition speed) / state check |
| 9A / 9B | u8 | Priority / game flag (ignored for standalone audition) |
| 9C / 9D | none | Disable slide / modulation |
| 9E | u8 | Engine gating (approximate) |
| A0 | u8 | Wait while retaining current sound |
| A9 | u8 | Tempo accumulator increment |

Stop handlers include 82, 88 and other entries mapped to the stop routine.
Native-call command 83 is rejected rather than executing original machine code;
it is not encountered by the supplied corpus audit.

## Fidelity and limits

- Tonal notes, rests, sequence control flow, tempo, pitch slides, vibrato and
  gating are interpreted from original tables/bytecode.
- Noise uses a deterministic approximation, not the driver's exact interrupt
  RNG, gate and timing logic. Engine ID 8 is parameterized by gameplay; the
  viewer uses a fixed midpoint speed. These previews are explicitly labeled.
- Output is mono 22,050 Hz PCM square waves. It is not an analog PC-speaker or
  cycle-accurate PIT model. High frequencies are capped at Nyquist; output may
  differ in timbre. Short fades prevent edge clicks.
- Playback uses the browser's native audio controls, with no autoplay. Selection
  changes pause playback and release its object URL. WAV export uses the same
  rendered PCM as the player.
- Previews are capped at 60 seconds. The interpreter also bounds command bursts
  so a malformed sequence cannot spin forever without a wait.
- Full-corpus audit: 121 IDs render without errors; 26 hit the preview limit,
  54 use approximate effect handling, and 22 yield silence. These counts are not
  claims that every ID is intended as an independently triggered sound in-game.

Next audio work: recover semantic sound names from executable call sites,
compare recordings against DOS execution, emulate exact noise/engine behavior,
and implement alternate driver renditions. Current output has not been
waveform-matched against original hardware or an emulator.
