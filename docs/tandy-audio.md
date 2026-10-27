# Tandy audio: current boundary and reproducible evidence

Build: `dos-fb658562`, original `game/DUCKTALE.EXE` and `game/IT.DRV` pinned by
`reference/build.json`. Decoded resource004 is12339 bytes, SHA256
`c17ef1f352cc26f470c8297a070fbcf5fd3d6eaa8b146b3486b54f076205d80c`.
This is x86 16-bit real-mode driver code, with no extender. Ghidra program
`driver-4.bin` imports the complete decoded resource at0000:0000.

## Delivered behavior

In `viewer.html`, select a Sound asset. Both speaker and Tandy renditions are
attempted independently. Translated Tandy paths offer **Play Tandy preview**;
unsupported paths stop with a visible diagnostic and no Tandy playback. A
zero-sample original request is identified explicitly. Selection stops playback
and releases object URLs. No alternate rendition is substituted for a failed one.

All121 public requests are exercised by `npm run verify:tandy-corpus`:59 complete,
37 produce a nonzero signal and22 are silent. Of the silent requests,nine return
no samples and13 produce timed silence.62 requests stop with known diagnostics,
including request069's unimplemented zero-period chip behavior. The corpus
manifest records deterministic PCM hashes as **port regressions**,not original
audio outputs. Missing requests,changed results and changed unsupported paths
fail; three negative controls check those mechanisms.

Native complete-cue comparisons cover002,025,036,067,068.025 demonstrates combined
pitch slide/vibrato:25 calls,14530 samples at44100Hz.002 has27 calls/15741 samples;
036 has6 calls/3027 samples;067/068 have17 calls/9686 samples. Browser acceptance
uses real keyboard/buttons,native audio completion and a one-sample tolerance
for the browser's microsecond-rounded WAV duration. Hardware waveform parity,
in-game Tandy,noise,engine effects and remaining commands are unfinished.

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
  resource and have channel headers0..3. Standalone far-API starts above127
  remain unsupported; compound-start opcode82 now uses the full181-record table.
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

The earlier reference commands remain part of `npm run verify:tandy`. PCM is an
independent audition provider with unverified waveform parity.

The envelope/pitch milestone passes full `npm run verify`:65 unit tests,35 browser
scenarios, all required original comparisons and the production build. Log:
`.local/tandy-envelopes-final-verify.log`. No runtime source edits occurred during
that gate. A later comment/table-identity correction records the181-entry finding;
the affected static check was rerun separately without changing runtime behavior.

## Compound sequences, control flow and vibrato

`reference/tandy-sequence-inputs.json` supplies42 authored cases, prepared by
`reference/tandy-sequence-fixture.js`. They cover28 command-handler cases,12
direct vibrato-function cases and two whole-pass scenarios with three carried
ticks. The fixture starts with the pinned resource and explicit channel/argument
patches. Expected output and captured before-memory never initialize the model.
All12339 resource bytes compare before/after, including aliased fields. Forty
isolated handler comparisons and three whole-pass checkpoints pass, with four
exact c0 writes and six negative controls. This is conditional native evidence.

- Opcode82 at0b4c..0ba8 consumes a record ID and performs the signed priority
  comparison. Channel0 clears1c9 even on rejection. Accepted records reset only
  their channel and invalidate its requested attenuation, retaining the cached
  attenuation. IDs0 and8 are ordinary sequence records here; they do not request
  the far API's reset/engine actions. Native cases include128/130/180, rejected
  and signed priorities,and replacement/rejection of the current channel.
- The signed byte `CMP BL,7f; JLE` accepts IDs above127. The verified record table
  ends at180; higher entries remain unsupported rather than reading adjacent
  sequence bytes as table pointers.
- 80/81 set/decrement a byte loop counter; zero underflows to255. The exhausted
  path advances PC by two without reading its target.84/85 addresses are
  little-endian,unlike91's big-endian delta.85 stores PC+2 in the original record
  return slots and increments byte depth;86 decrements it and loads the return.
  `SHL BL,1` wraps the index: native cases preserve overflow/underflow aliases,
  including depth4 overwriting neighboring fields and depth128 using slot0.
- 87,8c,a9 store octave,transpose and tempo bytes.95 sets rate,shift,span,
  half-span,delay and modulation handler0f05; it does not reset unrelated phase
  fields.0f05 decrements a nonzero delay before touching its accumulator. Carry
  advances/reverses the signed word step,with wrapping phase counters and word
  period additions. Native tests cover those boundaries,including zero values
  and negation of8000. No generic sine-wave replacement is used.
- The sequencer traverses channels3→0. Authored native programs `82 79 88` prove
  that a companion on a channel already visited waits for the next call; a
  channel still ahead executes in the same pass. These programs start the real
  record121 and retain model/native state across the two-call case.

Reproduce with the allocated459c fixture/privatefef0 stack described above.
Reload each authored initial body and put its arguments at3000. Control cases
enter the specified original handler and stop at083e,before the next dispatch;
that boundary has no synthetic RET. Vibrato cases use the4000 near-call harness
to enter0f05 and return at4003. The whole-pass cases call0403,retaining state.
Capture CPU/full resource/32 argument bytes/five harness bytes at each boundary;
whole-pass cases additionally capture BIOS0040:0018 and every c0 write. Separate
`runtime-events.json` contains the consumed BIOS input stream. The strict command
is `npm run verify:tandy-sequence`; its manifest pins setup,all42 case files,
events and cleanup. The CS-alias scratch jump moves between paused boundaries
without modifying original resource instructions or stepping original game code.

`reference/tandy-sequence-cues.json` adds two original-resource scenarios: reset,
far start002/025 and27/25 manual sequencer calls.56 carried full-body checkpoints
and129 exact port writes match. IN61 and BIOS inputs remain in separate events
files. The existing cue checker runs in `--sequence` mode with fixed counts and
five negative controls,via `npm run verify:tandy-sequence-cues`. The two scenarios
each reload the original resource; they have no synthetic sequence patches.
The final port-breakpoint counters account for133 writes:four earlier scheduler
writes plus129 cue writes. Register restore/free/empty breakpoint and allocation
registries are checked. Live original caller is0ed6:046e,stop1232. This remains a
partial caller restore,not a machine checkpoint; clocks/BIOS effects are retained.

The viewer tries every request through the same strict renderer. It precomputes
the whole Tandy audition before making audio available,so failure cannot play a
truncated approximation. Speaker controls are a distinct rendition and do not
autoplay after Tandy failure. The full corpus audit's59 completed requests prove
termination/implemented-path coverage and deterministic provider output. They
do not establish original parity for all those requests. Native browser checks
cover five captured cues,an unsupported noise request and a zero-sample request.

Tool limitation: Lua cannot access CPU/debugger/port I/O,and `batch_execute`
cannot batch debugger continuation/stops. Capturing each OUT therefore requires
repeated pause/resume RPCs. A focused bounded capture operation—owned temporary
breakpoints,requested register/memory snapshots and an OUT-event buffer until a
specified stop—would reduce that overhead. No general emulator/compiler was
added as a prerequisite; the present experiments use a short fixed call/jump
harness and documented tool limits.

Next audio milestone: noise/control commands90/97/aa/9d and exact zero-period
chip behavior,then engine and audio-status APIs for a persistent in-game Tandy
driver. Precomputed independent auditions are not a substitute for that driver.

The sequence milestone passes full `npm run verify`:65 unit tests,38 browser
scenarios,all required original comparisons,the121-request strict corpus audit
and production build. Log: `.local/tandy-sequence-final-verify.log`. Runtime
source files remained frozen throughout this final gate.
Additional setup-receipt assertions were then checked by `npm run verify:tandy`;
log: `.local/tandy-sequence-focused-final.log`. Runtime behavior did not change.
