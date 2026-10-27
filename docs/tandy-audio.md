# Tandy audio: current boundary and reproducible evidence

Build: `dos-fb658562`, original `game/DUCKTALE.EXE` and `game/IT.DRV` pinned by
`reference/build.json`. Decoded resource004 is12339 bytes, SHA256
`c17ef1f352cc26f470c8297a070fbcf5fd3d6eaa8b146b3486b54f076205d80c`.
This is x86 16-bit real-mode driver code, with no extender. Ghidra program
`driver-4.bin` imports the complete decoded resource at0000:0000.

## Delivered behavior

In `viewer.html`, search `Sound 036`, `Sound 067` or `Sound 068`, select the sound,
then press **Play Tandy preview**.036 terminates on its sixth sequencer call,
using3027 mono PCM samples at44100Hz.067/068 run17 calls with opposite pitch
deltas and9686 samples each. Switching assets stops playback and releases object
URLs. The existing PC-speaker audition remains available alongside each preview.

Only036/067/068 are exposed. In-game Tandy audio, other sequences, noise,
vibrato, engine modulation and sampled audio are unfinished. Unsupported paths
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
  word stack argument. Priority comparisons are signed bytes. Native start
  checks include extended records121..123 within the181-entry table at0fb1. The table ends
  at111b,also its minimum sequence pointer. All181 pointers lie inside this
  resource and have channel headers0..3. Standalone starts above127 and
  compound-start opcode82 remain explicitly unsupported in the translation.
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

The initial preview integration passed63 unit tests,33 browser scenarios, all
required original comparisons and the build. Its logs are local
`.local/tandy-driver-final-verify.log` and `.local/tandy-driver-assets.log`.
An earlier full run failed after a Vite
reload during the cave replay and on a symlink directory upload; the unchanged
gameplay checks pass with a frozen source tree and the resolved original folder.

## Envelope and pitch expansion

`reference/tandy-envelope-inputs.json` is the independent, authored initial-state
stream for26 conditional native cases. Each starts from the pinned004 resource,
patches the named channel fields, sets the selected output slot to17, and places
the authored envelope in zeroed scratch memory at5000. No expected output or
captured before-state supplies the translated model's initial state. The checker
compares the prepared state against the capture before executing the translation.

The six envelope modes are now translated: inactive, initial level, rise, fall,
hold and release. Native evidence confirms that the nonzero-target fall branch
at09e4..09ed leaves the current level unchanged while advancing the stage. Zero
targets instead clear the level and envelope mode. Positive overflow, negative
underflow, saturation, release and index wrapping are covered. In0942, flat
stages increment BX as a word; ramps increment BL as a byte. All12339 driver
bytes and the unchanged512-byte scratch envelope/5-byte call harness compare
exactly. Four negative controls reject altered state, missing cases, missing
inputs and mismatched initial state.

Reproduce using the same allocated459c fixture described above. At4000 install
`CALL near entry; JMP short4000`, with return marker4003, and a private stack
atfef0. Set DS/ES/SS=459c, DI to the selected channel and SI=5000. Cases specify
entry0910 (24 envelope-wrapper calls) or0942 (two stage-selection calls).
Capture CPU, full resource body, scratch envelope and five harness bytes before
and after each native call. Reload the original resource and authored patches
for each independent case. `reference/tandy-envelope.json` pins all26 artifacts
and setup/cleanup evidence; `npm run verify:tandy-envelope` is the strict check.

Opcode91 at0c6a..0cb0 configures an unsigned byte frequency accumulator and a
**big-endian word delta**. Handler0f3f..0f5a adds that delta to the wrapping period
only when the accumulator carries. It does not approach a target or clamp.
Native067 uses deltaffff;068 uses0001. The asymmetric068 operand caught and
corrected an initial little-endian interpretation. At native checkpoint16 their
periods are16 and30, respectively. No waveform or host-frequency adjustment was
used to correct the discrepancy.

`reference/tandy-cues.json` pins two independent reset/start scenarios,17 native
sequencer calls each,38 full-body checkpoints and84 exact OUT writes. The
17-call schedule follows the original16-count note duration and terminating
command; it does not inject an expected final state. Driver state carries across
every call. Separate `*-events.json` files retain the actual IN61 consumption
stop before OR60 and the BIOS byte consumed at each call. These values are not
reconstructed from expected OUT bytes or post-call state. Five negative controls
reject altered state/port data, missing checkpoints, missing external events and
missing cue inputs. `npm run verify:tandy-cues` is the strict check.

For those scenarios, reload the original resource once per cue and use the same
4000/4003 near-call harness. Call0727 for reset, then a fixed scratch wrapper at
4100: `PUSH word soundID; CALL FAR459c:0415; ADD SP,2; RET`. The wrapper bytes are
`68 id 00 9a 15 04 9c 45 83 c4 02 c3`. Call0403 exactly17 times, retaining driver
state. Watch the14 previously listed c0 OUT sites, OUT61 at072b and IN61's
post-read instruction at0729. Capture each OUT stop and CPU/body/BIOS before
and after each call. The final breakpoint counters account for all84 writes;
the return marker counts64 calls across26 envelope cases and38 cue calls.

Cleanup removed all owned breakpoints, restored caller general/segment registers
and port61 control, and freed the block while the original DOS owner remained
active. Live caller is now0ed6:046e,stop897. Flags/clocks/BIOS effects are not a
restored machine checkpoint. Breakpoint deletion returns `status:removed`, not
`status:ok`; an overly strict cleanup response check stopped after removing its
first breakpoint. The remaining owned entries were inspected and removed before
restoring/freeing the fixture. No original game instruction was stepped during
this experiment's entry or cleanup.

All three reference commands run through `npm run verify:tandy`. Browser native
input/audio acceptance covers all three exposed IDs; PCM remains an independent
audition provider with unverified waveform parity. Next: companion-sequence
opcode82, vibrato/noise and engine paths before enabling in-game Tandy playback.

The envelope/pitch milestone passes full `npm run verify`:65 unit tests,35 browser
scenarios, all required original comparisons and the production build. Log:
`.local/tandy-envelopes-final-verify.log`. No runtime source edits occurred during
that gate. A later comment/table-identity correction records the181-entry finding;
the affected static check was rerun separately without changing runtime behavior.
