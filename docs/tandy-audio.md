# Tandy audio: current boundary and reproducible evidence

Build: `dos-fb658562`, original `game/DUCKTALE.EXE` and `game/IT.DRV` pinned by
`reference/build.json`. Decoded resource004 is12339 bytes, SHA256
`c17ef1f352cc26f470c8297a070fbcf5fd3d6eaa8b146b3486b54f076205d80c`.
This is x86 16-bit real-mode driver code, with no extender. Ghidra program
`driver-4.bin` imports the complete decoded resource at0000:0000.

## Delivered behavior

In `viewer.html`, search `Sound 036`, select the sound, then press **Play Tandy
preview**. The original driver sequence produces three ascending tones and
terminates on its sixth sequencer call. Browser playback uses3027 mono PCM
samples at44100Hz. Switching assets stops playback and releases object URLs.
The existing PC-speaker audition remains available alongside it.

Only036 is exposed. In-game Tandy audio, other sequences, noise, non-flat
envelopes, pitch modulation and sampled audio are unfinished. Unsupported paths
throw diagnostic errors. There is no silent fallback to speaker playback.

## Source evidence

- Executable `140e:0617` initializes audio/video. Sound selector DS:204b indexes
  the table `[5,4,6]` atDS:20fc, consumed at140e:0909..0940. Detection at140e:1558
  includes INT10 AX0580, implemented for PCjr/Tandy in DOSBox's `int10.cpp`.
  This establishes004's hardware pairing statically. The captured svga_s3 game
  actually selected005, installed at2f7b:0000; its immutable routine bytes are
  checked against005. This is not a natural Tandy-machine run.
- Resource004 reset0727..0801 and reset-channel0e7c..0e9f initialize four38-byte
  channel records at01d1/0209/0241/0279. Start0415..0531 uses a far caller-cleaned
  word stack argument. Priority comparisons are signed bytes. IDs121..127 are
  internal accompaniment records in the same128-entry table at0fb1.
- Near wrapper0403 calls0802. IRQ02ed divides the1365-PIT-count interrupt by12,
  giving one sequencer call per16380 PIT clocks.0532 is sampled-audio playback,
  not the sequence tick.0802 clears BIOS0040:0018 bit08; decompiler output which
  labels this as a driver-code modification is misleading. Disassembly resolves
  the temporary DS=0040 segment override.
- Sound036 starts at1234 with header0000 and commands
  `8f00 9e40 1301 8901 2301 8901 3301 88`. Rests retain the prior tone and skip
  envelope advancement on those calls. Envelope0 is flat/hold. Captured writes
  by call are `[94,8b,1a]`, `[]`, `[85,0d]`, `[]`, `[8a,06]`, `[9f]`, portc0.

## Conditional original-function scenario

The versioned manifest `reference/tandy-driver.json` records hashes, emulator
configuration, independent inputs, counts, artifact locations and exclusions.
Proprietary captures live in ignored `.local/tandy-driver/`. Missing or corrupt
captures cause an explicit setup failure, not a skip. To recreate:

1. Launch the pinned originals in DOSBox, normal core,3000 cycles,svga_s3,
   read-only original drive. Pause at a known original caller and save CPU
   context, port61 and process/memory identity. One owner controls the session.
2. Allocate a fresh65535-byte conventional block using emulator allocation.
   The recorded run returned physical285120,segment459c. Copy the complete
   decoded004 into zeroed allocation memory. Do not overwrite the installed005.
   Revalidate segment/address and actual code bytes if allocation changes.
3. Use a private stack atfef0 and marker4000, both beyond the original body.
   Reset0727 is a near call with return4000. Capture the actual IN61 result
   before OR60; this run consumed16. Watch all reached OUT sites and capture
   CPU/DS memory at the return marker. Reset writes61=70,c0=9f/bf/df/ff.
4. Carry the resulting state through far start0415 calls with stack words
   `[4000,459c,argument]`. Arguments are the independently specified ten-word
   schedule in the manifest. Capture before/after memory and each reached OUT.
   This covers accepted/rejected priority, accompaniment channels, engine
   enable/stop and repeated stop; it does not verify engine sequencing.
5. Recopy the original body into a fresh zeroed fixture, reset (observed IN61=64)
   and start036. Capture that combined initial state, then call near0403 exactly
   six times, carrying state. Capture BIOS0040:0018 alongside each before/after.
   Watch all14 portc0 OUT offsets:
   `0321,0327,0493,04c5,0784,07ad,07d6,07ff,08c2,08ee,0903,0a57,0e41,0e4e`.
6. Clear only owned breakpoints; restore saved registers/control port and free
   the allocation. Verify the allocation list is empty. The recorded debugger
   cannot write EIP; an explicit5-byte FAR JMP outside original code transfers
   control. Never assume a rejected batch partially wrote registers. During
   initial setup, one mistaken debugger step executed the original RETF; both
   pre-step and post-step contexts are retained. Cleanup returned to the latter,
   original0ed6:046e,stop682. Flags, time and BIOS effects were not restored.
   **This is not a complete checkpoint or evidence of natural continuation.**
7. Save complete MCP responses with checksums and update the manifest for a new
   capture. Run `npm run verify:tandy`. It must compare all12339 driver bytes
   without exclusions at every checkpoint, carried before-states, exact bus
   writes and BIOS effects; require18 checkpoints and15 captured writes; then
   reject altered state, altered bus data, missing ticks and missing inputs.

The two reset-read values are operator-recorded observations at the native IN
boundary. The retained reset artifact stores the consumed value and subsequent
OUT stops, rather than a separate raw pre-OR CPU response; the tone setup retains
its combined initial state. Reset input bits overwritten by OR60 cannot be
recovered independently from those OUT bytes. They are explicit conditional
inputs, not claims of a strict natural input-device replay.

The harness is a conditional segment comparison. The tone model carries its
own state through all six calls, but manual calls are the input schedule: this
does not prove the original IRQ's wall-clock scheduling or whole-game playback.

Tool correction proposed: permit a paused, validated real-mode EIP write in
`cpu_write`, with documented atomic failure behavior. This would remove the
out-of-body jump workaround without adding a general emulator/compiler layer.

## PCM environment and remaining uncertainty

`TandyDriver` consumes explicit port reads and a BIOS-effect callback. It does
not access the DOM or wall clock. `TandyTones` consumes its register writes.
The audition supplies independent initial periods/counters1, output phases1,
all channels muted, first sequence call at time0 and nominal clock3579545Hz.
Sequencer spacing is16380/1193182 seconds; PCM boundaries round to the nearest
sample. Source instruction delays between OUTs are not reproduced.

The independently written counter model uses10-bit periods, clock/16 decrement,
toggle/reload and2dB attenuation steps, with15 muted, from the
[TI SN76489AN datasheet](https://map.grauw.nl/resources/sound/texas_instruments_sn76489an.pdf).
Nominal clock14318180/4 also appears in DOSBox `tandy_sound.cpp`. Period writes
preserve the current countdown. Zero-period and noise behavior are rejected.
Gain0.18 per voice is an audition setting. Chip phase, waveform shape, analog
filtering, mixing, resampling and real hardware output have not been matched.
The preview explicitly returns `approximate:true` for this presentation boundary.

Verification levels: native state/bus comparison passes; independent PCM
provider passes tone-frequency/attenuation checks; actual browser input/native
audio completion passes. None establishes full Tandy audio parity.

Commands: `npm run verify:tandy`, `node --test tests/tandy.test.js`,
`npx playwright test tests/browser/tandy.spec.js`, full integration `npm run verify`.

Final integration passes63 unit tests,33 browser scenarios, all required original
comparisons and the build. Logs are local `.local/tandy-driver-final-verify.log`
and `.local/tandy-driver-assets.log`. An earlier full run failed after a Vite
reload during the cave replay and on a symlink directory upload; the unchanged
gameplay checks pass with a frozen source tree and the resolved original folder.

Next targeted source work: envelope ramps at0942/0996/09b7. Static disassembly
shows byte-index wrapping and a notable falling-stage branch at09e4..09ed which
stores AL back to the target field atDI+0b, leaving the current level unchanged.
The decoded original bytes confirm that operand. Preserve it for a native
nonzero-target experiment before translating broader envelopes; a generic ADSR
replacement would conceal this source behavior. This branch is statically
inferred, not yet runtime-validated.
