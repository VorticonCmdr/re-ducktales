# Macaroon bank

The browser now enters the bank after normal Macaroon travel and before the final
score screens. Deposits still occur once, before presentation. The bank shows
the original scales, piles, portraits and balances, waits for Fire, performs its
final forty-read wait, then returns to the map or campaign ending. An office leg
that crosses day30 forces a new final bank call even when the preceding normal
bank was visited on day28. Bank idle time consumes the shared game RNG, so its
resulting seed must carry into market and rival processing.

## Build and runtime boundary

`reference/build.json` pins the executable and resource pairing. DUCKTALE.EXE
SHA-256 is `fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Physical appended overlay3 starts at file0x11c00:3830 bytes,512-byte MZ header,
3318 code bytes, SHA-256 `bd8fa987de02abbf5bf0127a3611718fded28042d4a8ad8b40652216e56201b0`.
It is logical INT3f6, distinct from appended overlay6 (caves). `MAC.ARC` is now
required by the browser's original-folder loader; originals remain authoritative
and excluded from Git and production output.

The game is x86 LE16 real mode, MZ/EXEPACK, with no extender. The resident caller
at main1036..107f, entire relocated bank overlay and EGA flip/wipe/reveal code
are compared against live bytes. On the fresh capture launch resident base was
01f5, DS/SS1403, bank overlay0e0c and graphics driver2ed7. These addresses must be
revalidated after relaunch or allocation changes. Ghidra `BANK_CODE.EXE` combines
resident code and actual bank code; it is not a loader stub. The source preparation
command is `npm run prepare:bank-analysis`. Its ignored patch manifest records
stack-probe normalization and relocations. The analysis copy is never executed.

`BankScene` receives original resources, banked amounts, seed, digital controls,
audio enablement and input/flush callbacks. Driver and retrace clocks are injected
separately. Rendering observes immutable command lists for two pages and an
independent background surface. It uses the existing EGA rasterizer; it cannot
supply RNG, input or timing. Initial wipe pixels come from the previous browser
frame as a presentation-only input. The caller's final clear/page flip supplies
the black frame before the ending wipe.

## Source rules

- Entry0000 wipes, clears the drawing page, loads MAC0..14, requests sound0 if
  enabled and flushes unread keys. EGA wipe/reveal each use five row groups with
  five retraces per group. Sprite positions/descriptors follow the original
  twenty-byte layout; allocator pointers are outside semantic comparison.
- Helper05a8 divides each **signed**32-bit banked amount by10000, clamps a signed
  quotient above4, then retains AX as a signed word. Exact zero instead gives−1
  (no pile). The difference of rival/player words selects one of five target
  poses. Signed wrap and low-word behavior are deliberate, not unsigned division.
- Scale motion starts at pose2, reflects at0/4 with sound67/68, contracts to1/3
  near a middle target, and repeats its final pose. The all-zero case presents
  pose2 twice. Each page flip waits one retrace; only the first frame is revealed.
  Original MAC sprites form both stacks and supports at the source anchors.
- Helper02a6 rolls both balances from right to left, one digit per pass, at
  y191/179, right edge186. Each pass flips then waits14 driver ticks. The completed
  digits are drawn on the other page too. The portraits take the final pose;
  pose4 performs the original seven pairs of celebration frames.
- Before the idle loop, the completed drawing page becomes the background and
  input is flushed. At every idle iteration Fire is checked before RNG. An RNG
  draw occurs even when a sparkle is already active. A roll modulo100 <=50 with
  frame0 restores the background and waits73 ticks; otherwise a new sparkle may
  consume side/position draws, or the active frame advances. Sparkles use aligned
  32-by18 background restores, five frames, page flips and seven-tick waits.
  The original hard-coded player-side width shift is retained for EGA.
- Fire requests36 when sound is enabled, flushes and returns to entry01fa.
  Shared11c4:09f5 receives40, flushes, reads immediately and waits seven ticks
  after each neutral read. A neutral run is280 ticks. Main1076 clears the drawing
  page and flips once before returning. Audio completion does not control this
  routine; audio requests remain guarded by the current sound setting.

Digital held Fire remains readable across a keyboard-buffer flush, as with an
original physical joystick. Browser keyboard holds supply that digital provider;
semantic tap/global-key queues are flushed separately. This is an explicit
browser input contract, not a claim about DOS keyboard typematic timing. P/Q/S
wait for bank input polls. Global dialogs suspend the reader and actors while
clock observations continue; resume clears held controls before returning.

## Original experiment and evidence

Single emulator owner: this chat. The supported folder was mounted read-only on
C in DOSBox MCP0.84.0-vc1 f6d9b, protocol1.14, normal core, EGA mode0d on svga_s3.
The bridge does not expose the current cycle setting; CPU-time parity is not
claimed. The existing externally attached process was exited through Q/Y and
credits, then DUCKTALE was launched from the DOS prompt. Native input schedules
are exploratory startup recipes, not a recorded full-machine replay: N and Space
through intro/difficulty; office Right held with Fire; acknowledge security;
move on the map and visually confirm Macaroon. Its info prompt must finish
presentation before Right/Fire. The bank remained reachable without state writes.

Stop main01f5:1036 before deposit, then overlay0e0c:0000 and05a8. Save CPU/data,
all3318 relocated overlay bytes and2599 graphics bytes. The verifier validates
resident caller bytes, RNG bytes and the relevant graphics code range. The
complete original resource identities are also required.

Eight arithmetic cases use declared player/rival inputs in `reference/bank.json`:
zero, tier boundaries, maximum signed positive, sign-bit and negative cases.
They run original05a8..06c7 and stop06c8 before graphics, RNG or allocation work.
The MCP API can read EIP but cannot write it. A five-byte far jump temporarily
placed at the **post-comparison**06c8 redirects to05a8 when stepped once between
cases. Saved general/segment registers and136 stack bytes are restored, alongside
the authored score fields. CPU flags are not restored; the bounded segment
establishes its own arithmetic flags before consuming them. It performs no
allocation, RNG or device I/O. The original five bytes are restored after a ninth,
zero-score cleanup pass. A restoration receipt is required. This partial restore
is valid only for this pure segment; clocks, PIC, BIOS and other device state are
not restored, and it is not a machine checkpoint. A focused tool improvement
would expose a validated instruction-pointer write while paused, avoiding the
post-boundary redirect. No general emulator/compiler was added.

Continue the zero-score presentation to074a (first completed reveal) and0aac
(before first idle input). Both full320-by200 original PNGs match exactly, as do
observable sprite coordinates/dimensions/frames and the seed. No tolerance,
frame search or expected-derived input is used. A first RNG return checkpoint at
0ae2 independently matches the original rotate/add RNG.

A second natural bank visit from the current Macaroon marker starts a separate
carried-input scenario. Its reloaded overlay is compared again. Stop0aac before
the reader, then0ab1 immediately after each reader return. The captured AL values
are `[0,0,0,192]`. After three neutral readers, the emulator schedules Space down
at0ms/up at10000ms; it cancels/releases on observed Fire. Every actual returned
input byte and every pre-consumption seed/local checkpoint is saved. Port replay
uses these input bytes and carries its own state, rather than deriving input
counts from the final RNG value. Removing an event or changing a carried seed
must fail. The final Fire reaches helper03b9:09f5 with argument40, then main1076.
The recorded driver/base counters advance280 and the seed stays unchanged. A
separate declared neutral provider verifies that shared forty-read wait in the
port; this is conditional wait evidence, not an exact hardware/CPU timing replay.

Two earlier attempted outro/caller captures missed their stops and remain only
as `*-unfinished.json`. An earlier timed Fire-return observation lacks a consumed
input stream. Those files are excluded from acceptance; they are not used to fit
a timer, input count or RNG seed. After capture, the emulator is paused at
main01f5:1076, stop1478, DS/SS1403, day4, banked balances0, with no owned breakpoints,
allocations or active schedules. Original code bytes have been restored.

## Verification and remaining scope

Run `npm run verify:bank`, `node --test tests/bank.test.js`, and
`npm run test:browser -- tests/browser/bank.spec.js tests/browser/ending.spec.js tests/browser/ending-audio.spec.js tests/browser/ending-presentation.spec.js`.
The full `npm run verify` includes the bank verifier. Missing/corrupt original
files or local artifacts, zero/incomplete cases, skipped checkpoints, unsupported
rendering or unconsumed required inputs fail. Five native-checker negative
controls cover changed arithmetic, omitted cases/cleanup, altered pixels,
removed input and changed carried seed. Eight controller cases separately cover
row waits, motion, digit/page retention, physical versus tap input, RNG/wait
order, blocking, the outro and strict diagnostics.

Browser acceptance uses actual title/office/map travel, a zero-score bank matched
to native pixels, pause/quit cancellation and return, and an earned1000 deposit
with rolling digits. Ending routes pass through each normal bank and the forced
final bank. Legacy campaign account/date fixtures keep their original artifacts;
only their explicit port input schedule now includes a held digital Fire/release
to advance the bank. Their scope still excludes original bank elapsed time/RNG.

Nonzero full-animation/sparkle pixels and complete original CPU/IRQ/input timing
remain unverified. Unusual signed-overflow pile aliases outside the translated
sprite descriptors stop with a diagnostic; their arithmetic is preserved but
those rendering paths still need evidence and translation. The first full gate found one legacy browser journey attempting Back/Office
before supplying the restored bank Fire input. That required input was added
without raising its timeout; the corrected route passes. The earlier failure is
retained at `.local/bank-full-verify-first-failed.log`. The whole-game goal remains
incomplete. Screenshots and captures stay local and ignored.
