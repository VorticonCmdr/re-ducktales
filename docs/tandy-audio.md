# Tandy audio: current boundary and reproducible evidence

Build: `dos-fb658562`, original `game/DUCKTALE.EXE` and `game/IT.DRV` pinned by
`reference/build.json`. Decoded resource004 is12339 bytes, SHA256
`c17ef1f352cc26f470c8297a070fbcf5fd3d6eaa8b146b3486b54f076205d80c`.
This is x86 16-bit real-mode driver code, with no extender. Ghidra program
`driver-4.bin` imports the complete decoded resource at0000:0000.

## Delivered behavior

In the game, choose **Tandy / PCjr** under **Sound device** before enabling
sound. The persistent device now handles game requests, flight-engine words
and actual completion waits. PC speaker remains available as the default.

In `viewer.html`, select a Sound asset. Both speaker and Tandy renditions are
attempted independently. Translated Tandy paths offer **Play Tandy preview**;
unsupported paths stop with a visible diagnostic and no Tandy playback. A
zero-sample original request is identified explicitly. Selection stops playback
and releases object URLs. No alternate rendition is substituted for a failed one.

All 121 public requests are exercised by `npm run verify:tandy-corpus`:111 file
previews (88 audible,23 silent) and 10 requests that use live playback. Nine
requests return no samples and 14 produce timed silence;008 is a control-only
engine request. There are no unsupported outcomes in this corpus. Missing
requests, changed results and changed live outcomes fail, with three negative
controls. Hashes are port regressions, not original waveform goldens. Live
requests001/095 finish naturally in the independent provider; the remaining
ones run until an explicit reset input stops them. Intro 001 also completes
through actual browser audio after 3558 ticks, about 48.8 seconds.

The viewer's file audition budget remains1024 ticks. Reaching it offers
**Play live Tandy** and **Stop Tandy playback**, with no partial file played.
The live player starts a fresh independent audition and advances the original
IRQ/sequencer on the audio sample clock. Unsupported paths stop with a visible
diagnostic; no alternate rendition is substituted. Asset switching and page
cleanup close the audio context. Short cues keep their native file controls.

Native complete-cue comparisons cover002,010,025,035,036,067,068.025 demonstrates combined
pitch slide/vibrato:25 calls,14530 samples at44100Hz.002 has27 calls/15741 samples;
036 has6 calls/3027 samples;067/068 have17 calls/9686 samples. Browser acceptance
uses real keyboard/buttons,native audio completion and a one-sample tolerance
for the browser's microsecond-rounded WAV duration. Hardware waveform parity and
original asynchronous wait timing remain unverified. Native status queries and
the wait predicate are verified below.

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

The counter model now targets the NCR8496 selected by the pinned DOSBox Tandy
profile. The PCjr profile selects a different SN76496. The earlier tone-only
implementation used the [TI SN76489AN datasheet](https://map.grauw.nl/resources/sound/texas_instruments_sn76489an.pdf);
NCR-specific noise/register/zero-period behavior is checked separately below.
Period writes preserve countdowns. Nominal clock14318180/4 appears in DOSBox
`tandy_sound.cpp`; its render provider rounds that clock to3579552Hz,whereas
the audition retains nominal3579545Hz. Digital-clock checks bypass resampling;
they do not prove PCM sample alignment or original IRQ timing.

Centered,negated mixing with gain0.18 per voice and ideal2dB attenuation remains
an audition setting. The external chip source mixes unipolar integer levels
with a gain/clipping table. Chip phase,analog filtering,gain/mixing,resampling
and physical hardware output have not been matched. The preview explicitly
returns `approximate:true` for this presentation boundary.

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
autoplay after Tandy failure. The sequence milestone's59 completed requests prove
termination/implemented-path coverage and deterministic provider output. They
do not establish original parity for all those requests. Native browser checks
covered five captured cues,an unsupported noise request and a zero-sample request
at that milestone; the current noise/browser coverage is described below.

Tool limitation: Lua cannot access CPU/debugger/port I/O,and `batch_execute`
cannot batch debugger continuation/stops. Capturing each OUT therefore requires
repeated pause/resume RPCs. A focused bounded capture operation—owned temporary
breakpoints,requested register/memory snapshots and an OUT-event buffer until a
specified stop—would reduce that overhead. No general emulator/compiler was
added as a prerequisite; the present experiments use a short fixed call/jump
harness and documented tool limits.

Next audio milestone: connect the persistent device to actual game sound/engine
events and translate original status-query/wait APIs. Viewer playback alone
does not establish game integration or whole-original timing.

The sequence milestone passes full `npm run verify`:65 unit tests,38 browser
scenarios,all required original comparisons,the121-request strict corpus audit
and production build. Log: `.local/tandy-sequence-final-verify.log`. Runtime
source files remained frozen throughout this final gate.
Additional setup-receipt assertions were then checked by `npm run verify:tandy`;
log: `.local/tandy-sequence-focused-final.log`. Runtime behavior did not change.


## Period, tempo aliases and sustained pitch changes

Commands90,97,aa,9d and the noise-note pitch boundary are now translated from
resource004. Fourteen conditional native cases in `reference/tandy-controls.json`
compare every12339 driver byte,32 argument bytes and5 harness bytes before and
after each call,with no exclusions. `reference/tandy-controls-inputs.json` is the
independent authored setup; expected capture outputs never initialize the model.
The command is `npm run verify:tandy-controls`,included in `npm run verify:tandy`
and the full gate. Four negative controls reject a missing input,a missing
checkpoint,changed native state and changed authored arguments. Missing/corrupt
local captures fail setup.

- 90 at0c43..0c6a consumes one byte,zero-extends it and stores both the channel
  period and requested output period. Zero and255 compare on channels0 and3.
- 97 and a9 share handler0aab; both store the tempo byte. Native97 cases exercise
  zero and255. aa at0b18 jumps directly back to083e without reading an operand.
- 9d at0bfb..0c29 reads a note,uses pitch helper0ea0,then reads duration. It
  preserves the envelope and jumps to0906,skipping current-channel modulation,
  envelope advancement and port output that tick. Tone/noise cases compare at
  that actual jump target. These are handler comparisons,not full scheduler or
  original IRQ timing comparisons.
- 0ea0 returns immediately for channel3,leaving pitch,slope and vibrato delay
  untouched. A normal noise note still initializes its attack envelope/duration
  at084d..086e. Tone/noise normal-note cases compare at088b,before advancement.
  Three additional pitch-helper cases cover signed transpose,byte/word wrapping
  and the channel3 early return. Native SHR and signed JLE behavior is retained.

To reproduce: use the existing allocated459c fixture and privatefef0 stack,
preparing each case with `prepareTandySequenceCase` from
`reference/tandy-sequence-fixture.js`. The fixture contains original004 plus the
explicitly authored channel fields and arguments at3000. Set AX=case.note,
BX=channel*2,DI=01d1+channel*38hex; zero CX,DX,SI,BP,FS,GS. Set DS/ES/SS459c.
Enter case.entry through the CS499c scratch-alias FAR JMP recipe,or enter4000's
near-call harness for pitch-helper cases. Run to a one-shot breakpoint at
case.stop. Capture setup receipts,entry step,CPU/body/arguments/harness before
and after,and the actual breakpoint stop. All14 cases are independent fresh
fixtures. No handler consumes an external device value or emits an OUT in these
ranges. Captures remain in ignored `.local/tandy-controls/`,with checksums in the
manifest. The original caller was0ed6:046e,stop1232. Cleanup restored its general/
segment registers and recorded port61 control,freed the allocation and verified
empty allocation/breakpoint lists. That capture ended at the same caller,stop1261;
flags,clocks and BIOS effects are not a machine checkpoint.

At the control milestone,the then-existing PCM provider completed70 requests
(48 audible,22 silent),
with51 explicit failures. The11 newly completed requests are032,037,048,062,063,
078,079,080,081,083,110. At that milestone,previously completed requests retained their exact corpus
results and PCM hashes. New hashes are independent-provider regressions; they
are not original waveform goldens. Browser scenarios032 (tempo/no-op) and037
(sustained pitch) exercise actual keyboard activation,native completion,repeat
playback and asset switching. Noise and zero-period behavior were unfinished
at that milestone; the current support is recorded below. Engine playback,
at that milestone, remaining commands and persistent in-game Tandy were unfinished.
Requests006/038 reach the1024-tick audition limit; that limit does not establish
that their original sequences are invalid or should terminate.

The control milestone passes full `npm run verify`:65 unit tests,40 browser
scenarios,all required original comparisons,the121-request corpus audit and the
production build. Log: `.local/tandy-controls-final-verify.log`. Runtime source
remained unchanged throughout that gate. The two new browser scenarios also
passed in the focused eight-scenario Tandy run before the full gate.


## NCR8496 noise and zero-period behavior

`reference/tandy-psg.json` pins the four external DOSBox source files,authored
inputs,probe/capture-tool hashes and a local digital-state artifact. All four
files also match `git show f6d9b:<path>`,the running engine revision. The chip
source is `src/hardware/audio/mame/sn76496.cpp`; selection is in
`src/hardware/audio/tandy_sound.cpp`. These are primary implementation sources
for the emulator target,not evidence of physical-chip waveform parity.

The narrow C++ probe includes that existing chip implementation without changing
its algorithms. Its private-visibility shim installs the independently authored
initial periods,counters,output bits,LFSR and latch; it then invokes real writes
and `sound_stream_update`. Eight internal samples advance one digital clock.
Only logging dependencies are stubbed through an empty `dosbox.h` with
`C_DEBUGGER=0`; no game/compiler/emulator implementation is added. To recapture:

```
python3 scripts/capture-tandy-psg.py /path/to/dosbox-automation
npm run verify:tandy-psg
```

The source hashes must match before compilation. Recapture requires clang++ and
that source tree; routine verification requires the retained local artifact.
Missing/corrupt evidence fails setup. Fifteen independent scenarios consume610
write/clock events and compare625 exact snapshots of registers,effective periods,
counters,output bits,LFSR,latch and negation. Four negative controls reject
missing cases,changed LFSR,removed events and changed noise mode. The scenarios
cover all8 noise modes,all4 ignored attenuation-data registers,ignored noise-data
writes,mode-only resets,retained countdown/output,rate-only LFSR preservation,
linked tone2 periods and zero-period reloads on all3 tones.

Digital rules now implemented:

- Tone register zero reloads1024; noise selectors0/1/2 reload32/64/128 digital
  clocks. Selector3 reloads twice tone2's effective period,including zero→2048.
- The16-bit NCR feedback state uses mask8000 and taps0002/0020. Periodic mode
  feeds bit1; white mode uses XNOR of bits1 and5. Output is the shifted low bit.
- A noise mode-bit change resets only the feedback register. It leaves current
  output/countdown until the next shift; a rate-only change retains allthree.
  Data-only writes to attenuation/noise registers are ignored. Tone writes
  retain existing countdowns,and tone2 writes update the linked noise reload.
- NCR output is negated. A one-time comparison with the previous provider at
  commit`faef38b` checked all70 previously completed requests:exact bus,ticks and
  PCM lengths are unchanged; samples differ only by polarity (zero stays zero).
  This is a port-baseline comparison,not an original waveform comparison. The
  local report is `.local/tandy-psg-polarity-audit.json`. Corpus hashes were
  deliberately updated for that polarity and the newly supported cues.

`reference/tandy-noise-cues.json` adds actual original sequences010/035. Each
fresh original004 body is reset,started and advanced exactly3 times,carrying
state. All10 complete-body checkpoints and17 OUT writes compare exactly,with
separate consumed IN61/BIOS events and five negative controls. Reproduce using
the existing459c/privatefef0 fixture and4000/4003 near-call harness,4100 far-start
wrapper,and all17 documented breakpoints. Use sound10 then35. Each cue has a
fresh original body; no synthetic sequence is substituted. Save full before/
after memory and each OUT stop. Final breakpoint counts cover all17 writes.
`npm run verify:tandy-noise-cues` is included in `npm run verify:tandy`.
The installed original remains005 under svga_s3; this is conditional004-driver
evidence,not a natural Tandy-machine run. Cleanup restored original non-flag
registers and recorded port61 control,freed the allocation and removed owned
breakpoints. Original caller remains0ed6:046e,now stop1301; flags,clocks and BIOS
effects are not a full machine checkpoint.

At the noise milestone, the independent audition corpus completed109 requests
(87 audible,22 silent).
The then-remaining 12 outcomes were008 engine,009/057 command9f,060 command8d,
and001/006/013/030/031/038/095/111 exceeding the1024-tick audition limit. A limit
is not evidence that an original music sequence is invalid or must terminate.
No partial audio is offered after failure. Native browser audio scenarios add
003,010,035 and069 (the formerly blocked zero-period path),with keyboard play,
completion,replay and asset switching. Original whole-game/device waveform,
at that milestone, gain/filter/sample alignment and persistent in-game Tandy remained unverified.


The noise milestone passes full `npm run verify`:66 unit tests,44 browser
scenarios,all required original comparisons,the121-request corpus audit and the
production build. Log: `.local/tandy-noise-final-verify.log`. Runtime source
remained unchanged throughout the gate. The focused12-scenario browser audio
suite passed before that full run. No original assets or local captures are
committed.


## Engine commands, fast interrupt and live playback

`reference/tandy-engine.json` pins29 conditional original cases with 31 complete
state checkpoints,30 exact OUTs, three clock increments and three chained events.
`reference/tandy-engine-inputs.json` supplies independent authored states and
arguments; `reference/tandy-engine-fixture.js` prepares them from original 004.
No captured output initializes the translated model. All 12339 source bytes,
32 argument bytes,5 harness bytes,4 private-clock bytes and the external BIOS
byte compare before/after every call. Six negative controls reject missing
cases, changed state/input/OUT, chained events and unfinished schedules.
`npm run verify:tandy-engine` is included in `npm run verify:tandy`.

Source rules checked:

- 8d/8e select the original 0f04 no-op pitch/vibrato handlers.83 writes field 2a;
  93 reads a big-endian detune word;9a writes priority and 9b writes marker 2ea.
  8b shares9d's sustained-pitch handler. The stop aliases follow their original
  table entries at 0a0e, including a2..a8; malformed/untranslated paths still throw.
- 98 at 0dbe reloads current/target engine period from the speed word's original
  table. a1 at 0d90 reads a big-endian explicit target.8a at 0d31 compares periods
  unsigned, adds the byte step when current<=target and subtracts otherwise.
  Equality overshoots; arithmetic wraps16 bits. It writes tone 0 through OUT DX, AL
  regardless of the command's channel, without updating normal tone caches.
- 99 at 0dd7 continues while engine flag 1c5 is nonzero; otherwise it reaches the
  normal stop handler. Request 8 updates control state; it does not start a
  sequence. The previous blanket processTick rejection for engine flag 1 was
  an untranslated boundary, not original behavior, and is removed.
- 9f at 0e16 stores strobe-enable1c9 and, if nonzero, writes cached attenuation for
  channels 2/3. IRQ 02ed's02f5..0328 region gates channel 0: decrement byte 1c7,
  reload from 1c6 on zero, XOR the whole phase byte 1c8 withff, then mute on a negative
  result or restore cached attenuation0 otherwise. Rate0 underflows on the next
  call. Rate/phase/cached data are retained rather than replaced by a generic
  engine/tremolo approximation.
- The IRQ decrements 1ca and reloads 12 on zero, then increments the external
  DWORD clock with ADD/ADC and calls 0403. Finally it decrements 2dd, reloads 48 on
  zero and chains to the saved handler; otherwise it acknowledges PIC20. Strobe
  handling precedes the sequencer. Native cases include clockffffffff→0, the
  chain/clock coincidence, XOR sign boundaries and three carried interrupts.

To reproduce the engine fixture: begin at the validated original 0ed6:046e caller,
allocate 65535 bytes at 459c and prepare each case from the versioned inputs.
Keep the stack atfef0. Control cases enter their specified handler and stop at
083e or0906. IRQ cases use an authored hardware frame `[4003,459c,0202]`, private
clock459c:5000 and an IRET-only old-handler stand-in at 459c:4300;all ordinary
sequence channels are inactive. The stand-in's omitted BIOS/PIC effects are an
explicit environment injection, not a full old-BIOS implementation. Use scratch
CS499c at 4000+oldIP with `CLI; JMP FAR459c:entry`, then step exactly two instructions
and assert IF/DF clear, real mode, core and original instruction bytes. No source
instructions are patched.

Watch all 14 earlier c0 OUT sites plus OUT DX at 0d53/0d5d, PIC20 at 035a, and chain
entry4300. Use a one-shot execute stop for each case's boundary. Capture full
CPU/body/arguments/harness/clock/BIOS before/after and each OUT/chain stop. Fresh
initial states are used per case;the last IRQ case carries three calls. Native
IRET returns with SPfef6, versusfef0 at control boundaries. The final 18 breakpoint
counters account for 30 OUTs and three chains. Save setup/cleanup receipts and
checksums in the manifest;local artifacts remain in `.local/tandy-engine/`.
Cleanup restored original non-flag registers, recorded port61 control and the
saved BIOS flag byte, freed the fixture and verified empty allocation/breakpoint
lists. Original caller is now0ed6:046e, stop 1397. CPU flags, clocks, PIC and other
BIOS/device state are not a restored machine checkpoint.

`TandyPlayback` is the persistent, DOM-free sample/IRQ provider. It accepts
original driver bytes, explicit sample rate/frames and word sound inputs. Each
IRQ edge is placed at `round(index*1365/1193182*sampleRate)`;the sequencer remains
at one call per 12 interrupts. Clock/BIOS/chain/PIC effects are explicit virtual
providers;all acknowledgements/chains are consumed. Normal devices retain the
original divider 12. Asset auditions explicitly choose divider 1 and first IRQ 0,
preserving the established first sequencer tick0. This is independent audition
alignment, not a recovered original machine phase. Original port-instruction
delays, hardware scheduling, gain/filter/sample alignment and waveform parity
remain unverified.

A baseline audit against commit `76baf63` compared both old translated modules
with the new provider: all 109 previously completed file auditions retain exact
PCM, port-write sequences, ticks and durations. The local receipt is
`.local/tandy-live-baseline-audit.json`. New file results are008 (control-only,
zero samples) and 060 (99 ticks/59330 samples). The corpus now has 111 file results
and 10 live requests:001,006,009,013,030,031,038,057,095,111.

`reference/tandy-live-inputs.json` defines 10 independent carried provider routes.
001/095 run to natural endings, with 120-second safety bounds;the other eight
receive a reset request 0 at frame 44100. Engine 009 additionally receives speed
words4008/0308/8008 at independently authored quarter-second boundaries. Neither
expected frames nor output data supply inputs. `reference/tandy-live.json`
records31 exact port-regression checkpoints from 21 consumed inputs, two natural
endings and eight requested stops. Source/chip/PCM hashes, counters, effect
consumption and termination compare exactly;five negative controls reject
missing cases, altered PCM, input omission/change and unconsumed events.
`npm run verify:tandy-live` is mandatory. These are independent provider
regressions, not original whole-engine/IRQ/waveform captures.

The live viewer uses an AudioWorklet built through Vite's worker-URL pipeline.
Actual output frame requests advance the device;the DOM and wall clock do not
advance simulation. Play creates a fresh audition;Stop sends original request 0
and waits for processor acknowledgement before closing the context. Natural
ends also close it. Switching assets/page cleanup disposes independent playback.
Processor/module errors stop visibly and do not autoplay speaker fallback.
Browser tests cover keyboard engine play, nonzero native output, Stop/replay,
asset-switch context closure and the complete 49-second Sound 001 ending at 3558 ticks.
The missing-module test substitutes Vite's observed URL-export response once,
then a real AudioContext attempts a missing same-origin module. This Chromium
build does not expose AudioWorklet fetches to Page/Context request routing;
there is no AudioContext mock. A focused tool correction would expose those
worklet fetches through the context routing API.

Production acceptance uses `npm run verify:tandy-production`: build, serve the
built files, select the real original folder and play/stop the compiled worklet.
It runs after development-browser checks in full `npm run verify`. The relative
worklet asset URL is verified in a production server;no publication/deployment
has occurred. At the live-viewer milestone, gameplay integration was still pending; the
persistent in-game milestone below supersedes that boundary.

The live-player milestone passes full `npm run verify`: 68 unit tests, 47
development browser scenarios and one production browser scenario, plus all
required original-data comparisons and the production build. Sound 001's real
browser completion takes about 49 seconds and reaches exactly 3,558 sequence
ticks. Final log: `.local/tandy-live-final-verify.log`. Runtime/package/test files
remained frozen during this run. The earlier focused failure-injection attempt
could not intercept Chromium's worklet request; the corrected URL-export
injection and final full run pass without mocking audio or suppressing errors.


## Marker, playback status and wait predicate

Resource 004 exports separate far calls: 0686 returns the unsigned marker byte
at 02ea with AH cleared; 06c8 returns 4, 3, 2 or 1 for the first nonzero channel
sequence pointer, or zero if all four are zero. The duration byte at record+2
is not its busy condition. At 068d the original scans those same pointer words
in channel order, restarting at 0694 whenever any is nonzero. It returns only
after a complete empty scan. The driver table maps these to resident far vectors
DS:202c, DS:2028 and DS:2024 respectively. The initializer at 140e:0909 copies
nine resource offsets to the far-vector table beginning at DS:2010.

`TandyDriver.marker` and `playbackStatus` translate the two queries. `pollWait()`
performs one observation of the wait predicate and returns true only when it
can finish. It never advances time or clears a pointer. `active` now uses the
original pointer condition. Simulation/audio providers remain responsible for
interrupt advancement. This is a polling boundary, not an instruction-timed
translation of the original spin loop or its asynchronous interrupt interleaving.

`reference/tandy-status-inputs.json` independently defines 12 query cases and
four ordered external pointer-clear events for one carried wait. Cases include
marker 00/80/ff, each channel, competing channels, a high pointer byte, zero
pointers with nonzero durations, and nonzero pointers with zero durations.
The native wait blocks on each channel and returns after the fourth clear.
No expected output supplies a clear event. Native snapshots compare all 12,339
source/body bytes, the four-byte far return frame and two-byte return marker
without exclusions. Unsigned AX results and preserved registers are checked.

To reproduce, use the existing read-only original pairing, normal real-mode
DOSBox instance and validated caller 0ed6:046e. Allocate 65,535 bytes at 459c
(physical 285120), prepare each input with `prepareTandyStatusCase`, and write
its source/body plus far frame and marker. Set SP=fef0, SS=459c, DS=1403,
ES=a200 and general-register sentinels AX=abcd, BX=beef, CX=cdef, DX=2468,
SI=1357, DI=2468, BP=3579; their high words are 1234/5678/90ab/1357/2468/3579/4680.
Enter through scratch CS=499c: write `CLI; JMP FAR 459c:entry` at allocation
4000+currentIP and step exactly two instructions. Assert the entry's original
bytes, real mode, normal core and IF/DF clear. Query cases run to 459c:4003.
Capture CPU, entire body, fef0..fef3 and 4003..4004 before and after.

For the wait, first stop at 0694, then run to its next visit and capture the
blocked scan. Clear only the pointer word for the next input's channel, capture
again, and repeat for channels 0 through 3. DI at each blocked visit identifies
01d1/0209/0241/0279. After the last clear, run to 4003 and verify preserved
registers and SP=fef4. These clears are explicit fixture injections with IRQs
disabled, not a natural sound completion or a full-machine replay. Source
instructions remain unpatched. Stack scratch below fef0 is outside the compared
source/body and return-frame regions.

Manifest `reference/tandy-status.json` pins capture revision, configuration,
source/input/preparer hashes, 16 local artifacts, 17 checkpoints and four events.
`npm run verify:tandy-status` fails on missing/corrupt artifacts, altered state,
return values, skipped/unfinished waits and unconsumed inputs. Seven negative
controls exercise those failures; it is mandatory in `npm run verify:tandy`.
All 121 corpus outcomes and ten live-provider replays remain unchanged by the
pointer-based completion check.

Cleanup restores the original non-flag registers, frees the fixture and verifies
empty breakpoint/allocation registries. Original caller is paused at stop 1430.
Port61 control bits remain unchanged; timer/refresh observation bits 4/5 can
change as hardware time advances. Flags and device clocks are not restored,
so this is not a complete checkpoint. A fresh launch is needed before natural
runtime comparisons. At the status-query milestone, gameplay still used PC-speaker audio. The
persistent in-game milestone below connects those requests and waits.

This milestone passes 68 unit tests, all Tandy original-data/provider/corpus
comparisons, 15 development browser audio scenarios and the production worklet
scenario. Log: `.local/tandy-status-final-verify.log`. The previous full campaign
gate remains recorded separately; this change touches only driver query and
completion semantics, so its browser regression is scoped to audio. The current
bridge/environment receipt pins the same emulator instance, version, protocol,
read-only original drive and normal core. Machine/cycle setup is inherited from
the earlier driver fixture; this capture makes no elapsed-time claim. Debugger
stop records describe the last instruction stop; fresh CPU reads in the cleanup
receipt verify registers after the subsequent restoration writes.


## Persistent in-game Tandy / PCjr

With sound switched off, choose **Tandy / PCjr** in the game's **Sound device**
menu, then enable **Sound (reconstructed)**. PC speaker remains the default.
The selector is disabled while sound is enabled. These are two explicit output
choices; a Tandy failure stops with a diagnostic and never starts speaker audio.
The viewer retains its separate finite and long-sequence audition controls.

`TandyGameStream` owns one `TandyPlayback` with the original divider 12. It
keeps advancing the same device through silence, sound replacement and resets.
A new request calls the original word API; it does not clear other channels or
replace the driver. Consequently the original signed priorities, compound
starts, engine flag, channel caches and IRQ phase carry across requests.
Its providers explicitly choose initial port61=0, first IRQ at sample frame0,
virtual clock/BIOS flags=0 and the established NCR8496 digital initial state.
These choices are reproducible provider inputs, not recovered original phases.

Requests have strictly increasing sequence numbers and optional scoped game
completion tokens. The processor acknowledges the actual consumed word/token
at its audio-frame boundary. It polls the verified global sequence-pointer
condition after each IRQ and completes all pending tokens only when every
channel is idle. A reset request0 can complete them at its consumption boundary.
Completion timestamps therefore describe the source IRQ or reset, rather than
the end of the browser's output block or a guessed WAV duration. Output-block
size has no effect on PCM, driver state, acknowledgement or completion events.

The browser adapter retains ordered requests while loading its Vite-built
AudioWorklet, unlocks the native AudioContext from user input, validates every
word/token acknowledgement, and reports status through the existing
`audio-status` simulation input. Its `gameaudio` DOM event exposes consumed
acknowledgement/completion events for recording; it does not advance simulation.
Mute and game stop effects issue request0. Device switching issues a final
reset, waits for its acknowledgement with no remaining requests/tokens, and
then closes the context. Explicit failure/page teardown also disposes it.
Hidden-page suspension follows the browser scheduler's existing pause policy;
in-game P does not suspend the audio device or its IRQ clock.

Flight starts engine request9 once, at overlay4:01de..01e8. After each physics
call, 020c..022a loads float32 DS:0fae, invokes resident140e:52c2's truncating
integer conversion, shifts AX by11 and ORs AL with8. The translation emits
`(Math.trunc(speed) << 11 | 8) & 65535`, retaining the high-bit control and word
wrapping. The compiler helper temporarily ORs the FPU control word with0c00;
its original software-FPU escapes and the exact original caller ranges are
hash-pinned in `reference/tandy-game.json`. Ghidra's normalized overlay listing
is used for understanding, while the resident helper is checked as original
bytes, not trusted decompiled C. This caller rule is **statically inferred**.
Existing conditional original engine/IRQ checks validate the receiving driver;
there is no claim of an original complete-flight sound timeline comparison.
The unsupported nonfinite/out-of-int32 conversion boundary stops explicitly.
The PC-speaker audition still omits this parameterized flight-engine path.

Three independent carried provider scenarios use the separate schedules in
`reference/tandy-game-inputs.json`: two natural cues separated by idle time;
engine start/speed/effect overlap and reset; and music/effect priority/reset
followed by a new cue. Thirteen requests produce sixteen exact state/PCM
checkpoints and six token-completion events. Frame budgets and input times
are authored independently. `reference/tandy-game.json` contains **port
regression** hashes, not original waveform or full-game goldens. The mandatory
`npm run verify:tandy-game` compares all events, counters, driver/chip/PCM hashes
and eleven static conversion boundaries. It rejects missing cases, altered PCM,
omitted inputs, skipped checkpoints, false completion and unconsumed/unfinished
schedules, with seven negative controls. A second independent output-block size
produces exactly the same result. Existing native driver/query/chip comparisons
remain separate mandatory evidence.

Browser exploration confirmed money-bin output, flight speed word2008, and
flight/crash/guide/cave transitions. The first cave room does not itself wait
on a sound. Automated acceptance therefore reaches the **pit ending**, whose
final sound47 is followed by the actual `waitAudio()` before expedition results.
It records native processor acknowledgements/completions through `gameaudio`,
checks that the wait token completes at a later audio frame with status0, and
requires every issued request acknowledged. This route injects only actual
keyboard/pointer controls and an independently supplied simulation clock;
native audio time is never mocked or completed by a fitted timer. Separate
browser cases check money-bin cue continuity, mute/reset, acknowledged device
closure, continued PC-speaker playback, and a missing-module diagnostic.
Production acceptance loads the user's original folder into the compiled game
and plays/mutes/closes the real persistent worklet. No original assets are
bundled, overwritten, committed or deployed.

The earlier focused test failures are retained locally: the frozen simulation
clock initially prevented its first frame, and an initial assertion incorrectly
expected the first cave room to play the later reward cue. The corrected test
waits for resource loading before its first supplied frame and exercises the
real pit sound-wait path. Neither failure was hidden or accepted as passing.

**Remaining fidelity boundary:** browser requests are consumed at real worklet
message boundaries; simulation driver/retrace clocks are separate explicit
providers. Their phase relationship, RAF batching versus original CPU request
latency, natural IRQ interleaving, hardware waveform/gain/filter timing, title
music timing and complete original game audio timelines remain unverified.
A working selected route does not prove every campaign or edition finishable.

The sound-effect gate reads the simulation's authoritative `audioEnabled` flag,
not the checkbox that is repainted later in the animation frame. A native
browser negative control temporarily restored the old checkbox gate on an
isolated development server. During a 250ms supplied frame containing both an
S-key poll and subsequent physics, the checker observed engine word8200 after
mute and rejected it. The corrected source was restored before final testing.
The test waits for every issued request's acknowledgement before checking the
reset, so an intermediate reset acknowledgement cannot hide a later request.
The first negative-control attempt on the shared development server encountered
a hot reload before the campaign started; it was explicitly rejected as
unrelated evidence. The isolated rerun detected the intended mute defect.
The first full gate was deliberately stopped before browser acceptance to fix
this edge case; its partial log is not a passing verification receipt.

Production acceptance exposed a checkbox repaint race: a display frame can
precede consumption of its queued `audio-enabled` input. The browser now retains
that pending intent until the scheduler's consumed log contains the exact input
object. It then publishes the authoritative final state, including any later
S-key event. This also clears on load/restart. A supplied8ms display update
between input ticks verifies the checkbox stays checked; an isolated negative
control restoring the old repaint failed that exact assertion. The compiled
folder-loading/game/audio test subsequently passed. Its earlier failed full
run remains in `.local/tandy-game-production-race-verify.log`, not a success
receipt. These UI changes do not advance simulation or satisfy audio tokens.

Final persistent-game acceptance passes full `npm run verify`: 71 unit tests,
50 development-browser scenarios and two production-browser scenarios, all
required original-data checks and the production build. The runtime, package
and test sources remained frozen throughout this final run. Authoritative log:
`.local/tandy-game-final-verify.log`. Sound 001's complete native browser ending
still passes. Both game and viewer compiled worklets load and play from the
original-folder interface. The original DOSBox session was rechecked read-only
at stop1430; fresh CPU reads still show the restored non-flag caller registers.
No original machine-state restoration or complete original audio parity is
inferred from these browser/provider checks.

## Title Sound001 dispatch (2026-10-28)

The static-title presentation described in this historical milestone has since
been replaced by the [opening sequence](opening-investigation.md). Sound001
still starts once, runs independently and is reset on a skip. Natural story
completion reaches difficulty before the song ends; audio completion does not
advance simulation. Original hardware waveform/timing parity remains unverified.

The title now starts request001 on its persistent selected sound device.
`DUCK_UNPACKED.EXE` function12f5:09e1 loads MAIN.ARC2; at0a51 it checks DS:03be,
then0a58..0a62 pushes unsigned word1, calls the driver API at[201c] and removes
the two-byte argument. The interrupted intro checks the same sound flag and
sends reset0 at0a06..0a19. These decoded instructions are x86 LE16 real-mode
resident game code, not an EXEPACK stub. Original unpacked source ranges are
hashed in `reference/title-audio.json`; its build manifest pins the executable
and resource pairing. No new DOSBox runtime timeline is claimed.

The browser initially supplies sound disabled. Its first sound-enable gesture
while this title is displayed supplies the enabled startup option late and starts
request1 once. This applies to both the checkbox and S. It is an explicit browser
environment adaptation; it does not establish original S/initialization timing.
Later mute/unmute events do not restart the song. Explicit browser Restart
initializes a fresh title. Fire/Enter leaves the title and sends reset0. The
keyboard reset effect precedes the new start effect, so it cannot cancel the
first requested song. Audio runs independently of presentation and does not
advance the title when it ends.

Five controller cases check exact effect order, once-only activation, constructor
sound settings, restart and skip; a missing-start negative control must fail.
Two native browser scenarios check natural Tandy completion, no loop, mute,
restart/skip, S activation and speaker playback/skip. Exact sequence timing
remains covered separately by `verify:tandy-live`; browser stats arrive at audio
block/report boundaries. Production acceptance explicitly requires request1 at
the real original-folder-loaded title before starting the campaign.

This milestone retains the current static title presentation. Original cropped
reveals, story/security transitions, complete intro timing and hardware waveform
parity remain incomplete or unverified. Passing the sound route does not prove
those presentation paths. Verification commands are
`node --test tests/title-audio.test.js`,
`npm run test:browser -- tests/browser/title-audio.spec.js` and `npm run verify`.

The first focused native browser run completed the song and passed keyboard
playback, then rejected a test expectation which counted only one Restart reset.
The existing browser Restart handler resets immediately and the Game restart
emits its own reset before request1. The corrected test requires both native
acknowledgements in order: `[1,0,0,0,1,0]` for initial start, mute, the two Restart
resets, fresh start and Fire reset. No inputs or runtime behavior were changed to
fit that observation. The failed log is retained locally alongside the final
verification receipt.
