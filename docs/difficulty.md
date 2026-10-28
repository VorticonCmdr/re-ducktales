# Original difficulty menu: core and evidence

Build `dos-fb658562`, executable/resources in `reference/build.json`. The pure
selection and rendering helpers in `src/game/difficulty.js` match the captured
original menu. `src/game/difficulty-menu.js` carries the source-derived entry
reveal, input flush, seven-count polling, sound-enable gate, BIOS seed provider
and closing wipe as an independent component. This branch wires it into the
browser, with [focused acceptance and remaining integration work](difficulty-browser-integration.md).
The main checkout retains its separately verified campaign milestone until that
integration is complete.

Run `node scripts/verify-difficulty.js`. It rejects missing/corrupt private
fixtures and unsupported originals, checks the initial menu and three selected-menu PNGs exactly,
nine consumed input bytes, five original sound API calls and the native BIOS
consumption/write boundary. `reference/difficulty.json` pins eight native artifacts
and six focused browser integration receipts;
`reference/difficulty-inputs.json` separates input values from expected pixels and
state. No original binaries, decoded assets or PNGs are committed.

The same command runs a closed-loop component replay through all nine captured
input bytes, with a separately supplied BIOS input. It requires five sound36
effects, exactly one flush and BIOS read, completion and no unused inputs. It
checks the initial raster and the source-derived first-input boundary (six
driver counts do not read; seven do). Its60 retraces comprise one initial flip,
25 reveal waits, nine selected-page flips and25 exit waits. Driver/retrace
advancement is explicit and independent of the DOM. These counts are static-rule
regressions, not a native elapsed-time or browser comparison. The component's
physical joystick provider survives the keyboard flush; queued tap inputs do
not. The browser adapter still needs to make its keyboard-provider policy explicit.

## Rules and scope

Resident12f5:0aeb..0d88 is670 bytes of actual x86 LE16 real-mode game code.
Up decrements0→2, Down increments2→0. Fire is tested before movement: native
simultaneous Up+Fire returns193 and confirms the existing selection0. It does
not change to2. Selection changes and confirmation call sound36 when DS03be is
enabled. The original menu waits seven driver counts before each input poll;
CPU/file/render costs and complete elapsed-time parity remain unverified.

The background is MAIN.ARC32. Heading DS0662 is at(168,60); rows are at
y80/100/120. Selected rows use the executable's prefixed string at x168,color12;
unselected strings use x176,color15. The port's current browser rows start eight
pixels too far left. The verifier's shifted-text negative checks reject that
layout for all three selections and the initial page. An invalid selection is rejected, and the
captured Fire+Up case rejects movement-before-confirmation behavior.

The initial page differs from later selected pages: strings DS0624/0637/0642/0651
put all labels at x176, with Easy in color12 but without its `>` prefix.
`difficultyInitialCommands` matches `menu-0.png` exactly. That image was taken
at the first loop tail04ea:0cea, while the preceding initial page was still
visible; it does not establish the instant when the page flip becomes visible.
The immediate selected2 screenshot similarly retains the preceding page.
Selected-page comparisons use the following neutral input return.

The core's quit return37 is statically inferred from the source's input-bit20
branch, not exercised by this native scenario. Sound-disabled behavior, entry
animation/flush timing and cleanup are outside the core's runtime proof.

## Entry contract for application integration

Static inspection establishes this order. These rules are not yet browser
acceptance evidence.

- Resident12f5:0b11 fills the drawing page with color0,0b15 flips to black,
  and0b1c fills the other drawing page with color0,
  and helper selector9 at0b29 loads MAIN.ARC32. Selection is initialized to0.
- Initial labels are drawn before the indirect call at0ba1 through DS1fdc.
  The native pointer table captured at confirmation maps that slot to EGA
  driver1 offset0101. Other captured offsets are00e5 (flip),01b0 (drawing-page
  color fill) and0155 (visible-page striped clear), all in segment2ed7. The verifier checks these pointers
  against the authoritative driver jump table.
- EGA0101..0154 copies five sets of interleaved rows: set0 copies0,5,...195,
  then set1 copies1,6,...196, through set4. Each set copies40 bytes per row;
  the extra0xa0 stride skips four rows. It waits five retraces after each set,
  totaling25 retraces. It copies the drawing page onto the visible page;
  this is not a black wipe in the difficulty menu.
- Only after the reveal does0ba5 call140e:19a5. Under CLI this routine sets
  BIOS keyboard queue head0040:001a to its tail001c and zeroes64 words at
  DS276c, then STI. Queued intro/reveal keys must be discarded here. Raw8ec0
  loads ES from AX despite the MCP operand-formatting issue described below.
- The menu draws/flips the selected page, resets the driver wait base at0ced,
  waits seven counts at0cf9, updates joystick input at0d01 and consumes global
  input at0d06. Fire takes priority on the next loop. Confirmation plays36
  when enabled, consumes the BIOS reseed, fills the drawing page with color0,
  then wipes the visible page in the same interleaved pattern over25 retraces
  before returning. The quit37 branch bypasses that confirmation cleanup.

The manifest pins six static ranges: the complete resident menu,32-byte
keyboard flush,84-byte graphics reveal,91-byte striped clear,62-byte drawing-page
fill and14-byte retrace helper. The menu
also retains its fresh relocated native-byte check. No runtime entry-animation
or complete elapsed-time comparison is claimed.

## Native recipe

One owner operated DOSBox MCP0.84.0-vc1 f6d9b, protocol1.14, normal core,
svga_s3 with EGA driver1,3000 cycles, headless/muted, original `game/` mounted
read-only as C. The guest selected PC-speaker driver5 with sound enabled. No
Tandy-machine waveform result is claimed.

Quit normally with Q,Y, then Fire at the farewell screen. At the DOS prompt,
type DUCKTALE and send paired hardware Enter. Stop on the first INT21/AH3d
self-open. Observe PSP01e5, load01f5 and the original executable path. Reapply
the packed EXE's relocation records and compare live resident04ea:0d89(101
bytes),04ea:0aeb(670), and helper03b9:007c(58) against the loaded original image.
The verifier requires these exact bytes. DS/SS1403 and normal real mode were
revalidated after startup; the loader's earlier stack is different.

Answer N to the joystick prompt and skip the reveal with Space. Stop at
04ea:0aeb. Cancel the pending timed release before explicitly releasing Space,
Enter and N, then continue to04ea:0cea. No memory/register values are injected.
The first immediate screenshot supplies the initial-page comparison at the
alignment described above.

At each input return04ea:0d0b, capture AL and the selected byte DS8990. Start
hardware key presses at the preceding stop and release them immediately after
their observed return. The independent consumed stream is
`1,0,5,0,5,0,1,0,193`: Up,neutral,Down,neutral,Down,neutral,Up,neutral,Up+Fire.
Do not infer a continuous wall-clock keyboard trace from these debugger-boundary
steps. Timed replay elapsed/drift includes paused host time.

After each nonneutral return, stop at the validated sound API2f7b:0408. Read
CPU,SS:SP length8 and DS8990. All five unsigned word arguments are36; selection
changes return to04ea:0c3a, confirmation returns to04ea:0d72. Selected values
are2,0,1,0,0. The sound prologue is checked against original IT.DRV005 bytes.

Capture selected-menu PNGs at the following neutral input return, after the
seven-count wait. Immediate page-flip captures can still contain the preceding
presentation; other diagnostic images are preserved separately. The four accepted
PNGs have no pixel exclusions or tolerances.

On confirmation, stop at0603:0e0a, after BIOS0040:006c was read into AX and
before DS2229 is written. The consumed word18293 is an external input observed
at its consumption boundary. Capture the later DS write at04ea:0d7a, then
cleanup return04ea:0d85. The verifier compares the captured input to that write;
it never obtains the input from the expected final seed. No partial restore or
machine checkpoint is used. The native session remains paused at return stop1576,
DS/SS1403, with all replay events dispatched and no breakpoints.

Raw opcode8ec0 sets ES from AX in the BIOS helper. The Ghidra MCP instruction
text reports the operands reversed; source bytes establish the correct operation.
A focused tool correction should fix that segment-register operand formatting.
