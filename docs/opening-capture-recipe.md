# Original opening capture recipe

Build `dos-fb658562`, executable and paired resources pinned in `reference/build.json`.
DOSBox 0.84.0-vc1 revision f6d9b, normal core, EGA, C mounted read-only to the
original `game/` directory. No memory/register injection, partial restore or
machine checkpoint was used. One operator owns the live debugger and inputs.
The accepted local captures are pinned individually in `reference/opening.json`.
Do not replace those files when recapturing; use a new directory and review the
new evidence. Run `npm run verify:opening` to reject missing or corrupt artifacts.

1. Quit the original normally through Q/Y and the farewell Fire prompt. Confirm
   the DOS prompt. Type DUCKTALE and send a separate Enter down/up sequence.
   `input_type` alone did not deliver Enter. Answer N to the joystick question.
2. Stop on the game's first INT21/AH3d self-open. Check the DUCKTALE MCB/PSP and
   actual unpacked resident bytes; this session used PSP01e5, load paragraph01f5.
   Stack/DS are1403 after startup; the loader's earlier SS is different.
   Reapply original MZ relocations to the unpacked EXE and compare the101 bytes
   at image15577 with live04ea:0d89. Repeat after every fresh launch or layout
   change. Ghidra12f5 maps to live04ea; helper140e maps to0603 in this layout.
3. For the natural run, enter at04ea:09e1 with a zero128-byte key table. Observe
   the incoming RNG word at DS2229 before any story RNG. It was1643 for this
   run, not an original constant. Capture each reveal wait tail04ea:0de3 (11),
   each arrival tail04ea:070c (5), the first kids half tails03f7/04c4 (2), and
   the first Scrooge half tails01f1/02b1 (2). Capture a raw320x200 PNG at each
   stop plus registers, skip flagDS7979, enable flagDS4e0f, timer2221..222c,
   and relevant stack locals. Finish at04ea:0aeb; native final seed41142.
4. Relaunch naturally for reveal-Fire. Initial observed seed8274. After the
   first reveal tail, schedule Space down at0ms/up at100ms using emulator-side
   input sequencing. At every input return04ea:0dcc capture AL, then capture
   the corresponding0de3 tail and PNG. First AL0, second192, remaining nine0;
   post-reveal return04ea:0a82 AL0. Along with three neutral entry guards this
   is15 reads. All11 reveals finish; native final seed8274, skip1, enable0.
5. Relaunch for dialogue-Fire; initial observed seed14008. At the first kids
   half0 tail03f7 capture PNG and seed6432, then schedule Space0/100ms. Capture
   input return03fc AL192. In the translated source input order this is read68.
   At the public sound API2f7b:0408 capture the unsigned word argument on the
   stack and return address for six calls:0,0,0,0,0,36. Final seed5485 at0aeb,
   skip1, enable0. Capture the final all-black PNG. The EGA resource1 routine
  0155 clears after story return; the early reveal skip bypasses this clear.
6. Verify each wait handle against its returned fresh stop ID and actual CS/IP.
   `debug_wait` has a15s maximum; repoll the same handle on timeout. Remove the
   persistent sound breakpoint and confirm both scheduled key events delivered,
   replay inactive/remaining0. Cancel any old replay before explicitly releasing
   a key; canceling a sequence alone can leave a key down.

The initial values and consumed input stream are separate from expected outputs
in `reference/opening-inputs.json`. Neutral reads are source-authored with no
other key-down events, not an independently recorded full keyboard IRQ trace.
The capture contains one Fire return; it does not establish sustained held-key
or typematic timing. Browser keyboard holds use the existing digital input
provider adaptation; exact DOS typematic behavior remains unverified.

The verifier carries its own state from each initial seed through every selected
checkpoint. It compares33 PNGs exactly, three exit seeds/flags, and six native
cleanup arguments. It does not inject intermediate RNG, pixels or fitted timers.
Natural whole-sequence input/presentation counts come from static source and
are regression assertions; only the selected native stops were captured.
Native driver counters include file, decompression and CPU/render costs absent
from the port. They are diagnostic outputs, never replay inputs. Minimum source
waits are translated; full native elapsed-time, IRQ and hardware waveform parity
are not established. PIC replay elapsed/drift includes paused host time and must
not be used as guest timing evidence. Default native sound driver5 was used;
these captures do not establish a natural Tandy-machine waveform comparison.

The independent browser acceptance uses initial BIOS seed0, supplies actual key
events and advances browser time. It compares the16 RNG-independent reveal and
arrival frames to these native PNGs and then enters the campaign. The BIOS seed
is supplied again on difficulty confirmation, matching140e:0e01 called from
12f5:0d75; story RNG must not leak into campaign initialization.
