# Global pause, sound and quit controls

Supported build: [build.json](../reference/build.json). The original input routine
`1124:0002` maps P to pause,S to sound,and Q/Escape/F1 to the quit question.
The browser now exposes those keys and equivalent buttons. Back/Office remains an
explicit navigation adapter. Escape no longer means Back/Office.

## Behavior and implementation

`src/game/system-controls.js` owns the blocking dialog state and original layout.
`application.js` blocks gameplay updates while a dialog is active; rendering
continues over the current scene. Flight's driver/retrace clocks keep advancing.
Audio completion remains an explicit external
input and can arrive during a dialog. Input/audio/time do not come from rendering.

- Pause `11c4:047f..066c` draws white-on-blue13-column text with a white border at
 104,80..207,103. It waits35 driver ticks,flushes input,and accepts P to resume.
 Other keys do not close it. Resume restores the scene,optionally plays sound24,
 waits7 ticks,then flushes the BIOS input queue and128-byte key table.
- Quit `11c4:02a7..047e` draws the original29-column question and Y/N instruction
 with border39,87..272,104. Fire,arrows,P,Q and Escape do not answer it.
 N restores the scene and flushes input. It does not advance a campaign action,
 bank accounts or consume RNG. Y enters credits `12f5:1098` and exits after the
 original farewell. It skips winner comparison,banking and the Play Again menu.
 The browser finished screen retains Restart as an adapter.
- Global input `1124:0002..036d` handles S by changing DS03be. The sound-off case
 is observed at the actual store's following instruction `0319:01c4`. Browser S
 updates the existing sound checkbox and audio provider. The short original click
 emitted just before switching sound off is omitted by the browser mute adapter;
 reconstructed audio remains outside full original device fidelity claims.
- Dialogs cannot nest. Confirmed quit blocks new pause/quit dialogs during credits.
 Restart clears the overlay and exit latch. Sound settings remain adjustable.

The original routines are blocking calls from the input reader. Money-bin global
keys wait for its actual idle input poll; its intro and dive do not read them.
Flight keys wait for the post-collision input call or final dialogue poll.
Other scenes currently consume global key events on the next driver tick. Exact
alignment with every original activity's input-poll boundary,especially uninterruptible
animation/audio waits,is **not reproduced**. Original IRQ clocks keep running
inside the dialogs. Flight now preserves that device-clock advancement while
holding actor updates; other activity clocks remain frozen. Long-pause expedition
timing has not been compared with a carried original replay. These are remaining
fidelity gaps,not a whole-game timing claim. S during Pause's35/7-tick locks is
discarded by the original input flush; the browser sound checkbox remains an
immediate setting adapter.

### Money-bin input boundaries

Overlay9 has exactly one input-reader call,at022a. The six intro poses each wait28
driver ticks,then the first poll runs before any idle pose is drawn. Subsequent
idle poses wait14 ticks before polling. No input reader runs during a dive.
Its final0b07 call flushes the BIOS queue and128-byte custom key table.

The IRQ9 handler (`140e:1aa9..1b55`) stores80 for a press and40 for a release
whose key flag is still present. The custom reader19c5 consumes the released flag;
therefore a short P during the intro survives until the first idle poll. Keys are
scanned in scan-code order,not arrival order. Escape/Q precede P/S; F1 follows
them. Duplicate presses during a wait occupy one key slot. A global dialog's
flush discards the remaining queued keys and Fire. The browser retains these
semantic key slots in `pendingBinSystemKeys`; native keys retain their scan code.
The sound checkbox remains an immediate browser setting adapter.

`MoneyBin.pollInput` is an explicit caller interface. A blocking dialog suspends
that input call with `waitingForInputPoll`,preserving the last displayed pose.
On cancellation/resume,the call returns no Fire and the next idle pose is drawn.
Sound effects from that resumed pose are collected immediately. The global clock
continues while the call is blocked; money-bin pose waits begin after the call
returns,so no expired animation wait is carried through this pause. This narrow
result does not establish clocks for active flight or expedition levels.

`reference/money-bin-input.json` adds17 mandatory local artifacts and10 original
comparisons to `verify:system-controls`. Whole overlay9 (2836 bytes,65 relocations),
resident input/pause/wait code and the IRQ/key-reader bytes match the supported
EXE after this fresh launch. Released P is40 at first poll,next-pose2 and final
intro sprite1. Pause preserves that pose; resuming draws idle sprite2. A separate
idle pause preserves sprite2,next-pose3 and returns AL0. Accounts,date,coin latch
and RNG remain unchanged. During the captured dive,Q/P/S all reach release flag40
without opening either dialog or changing sound; the final flush clears all128
key bytes. No memory/CPU injection or checkpoint restore was used.

The manifest records exact capture addresses,independent input schedules and
checksums. Intro and dive schedules are emulator frame events,armed while paused;
their status must show all2/all2/all6 events dispatched,no remaining events and inactive.
Earlier timed scheduling attempts had zero events dispatched when the early stop
was reached. Those observations are excluded from acceptance. `events_scheduled`
alone is not evidence that a key reached the guest. A focused bridge improvement
would document how paused time affects PIC schedules and provide atomic arming
of a relative input schedule with debugger continuation. Frame scheduling plus
explicit completion checks is sufficient here; no general input tool was built.

Independent controller and real-browser scenarios now require the intro to keep
moving after P,open Pause at its first poll,freeze there,and resume to idle. They
also press Q/P/S during a real dive and require uninterrupted completion,unchanged
sound and no delayed office dialog. Omitted-P and corrupted-state negative controls
must fail. CPU drawing costs,whole original timing and other scene poll boundaries
are excluded explicitly; no expected output supplies replay input timing.

### Flight input, clocks and final wait

Flight overlay4:02ae calls the input reader after rendering and collisions.
Crash,landing,boost and other scripted animations do not read global keys there.
The port's `Flight.readInput` can suspend at this call; Game supplies its queued
scan-code slots and resumes the same generator after Pause or No. Actor/scene
state remains frozen while `Flight.tick` and its retrace counter keep advancing.
Resume flushes held controls before the pending input call returns.
That flush also discards a tapped Fire request,so it cannot shorten the final
flight wait after Pause or cancelled Quit. The regression was verified to fail
before that request latch was included in the flush.

Flight pacing uses **198e:01d8**,an independent32-bit deadline at DS27f8 with
interval6 at27fc. Pause's `140e:0dcc` resets a different timer base at2221.
Observed original flight frame2 and its actors/RNG remain unchanged through
Pause,while driver clock2225 advances49639→49830 and the separate deadline stays
49643. The next deadline helper consumes zero driver ticks and sets49836=current+6.
The port therefore processes overdue flight physics immediately on resume; it
does not add a fresh six-tick delay. Unit and browser cases require this boundary.

At final flight cleanup,0f27 calls `11c4:09f5(20)`. That helper flushes all input
once,then polls before each of twenty7-tick waits. The original capture's local
counter advances0→20 with result0 and driver clock50423→50563,exactly140 ticks.
The browser now includes this wait,keeps the completed flight visible,and accepts
a new Fire at a poll. Keys entered during crash/landing are discarded by the
initial flush. Airship/tether input-flush helpers also clear held controls and
queued global keys. `returnWaitTick` records the injected driver clock at entry.

`reference/flight-input.json` pins18 local artifacts and9 original code/state/
deadline/wait/popup/input checks,plus one independent controller replay. All
three frame schedules require complete dispatch (2/3/4 events). Negative controls
remove P,drop device clocks,change preserved RNG,corrupt a popup pixel and change
a FPU operand. No memory/CPU injection or restore is used. This capture scenario
ended paused at the completed final wait,stop514. This is a naturally reached flight
with conditional comparison boundaries,not a whole-flight original input replay.

The original hardware-FPU handlers rewrite executed CD34..3b/3d prefixes in
place. Their resident129-byte span at19c4:0755..07d5 and live interrupt vectors
are matched against original bytes. The complete17548-byte flight overlay has248
relocations plus exactly91 such executed rewrites at pinned offsets. The checker
derives each two-byte replacement using the original subtraction and conditional
WAIT/NOP predicate. Every other byte remains exact; no bytes are masked. This
execution-history code state is separate from replay inputs and the analysis-only
FPU normalization described in flight.md.

The real browser case loads assets,flies,uses P and Q/N,waits while paused,
checks clock/actor separation and original popup pixels,then causes a real crash.
Q/P/S pressed during that crash cannot interrupt it. The final flush discards them,
and natural return requires140 driver ticks before repair processing. Existing
crash/calendar comparisons remain at their original0ee6 boundary; the new final
wait is checked separately. No original runtime flight Quit-No capture or whole
flight pixel/audio/wall-clock parity is claimed. Expedition poll boundaries remain
the next investigation.

## Verification and evidence

`npm run verify:system-controls` requires13 checksummed local artifacts from
[system-controls.json](../reference/system-controls.json). Seven comparisons cover
pause/resume,No,Yes,sound-off,two exact popup rectangles and the static interface
audit below. Complete relocated input876/dialog966/flush32-byte spans are pinned
against the original EXE,not generated analysis copies. State comparisons require
unchanged calendar,location,cash,banked totals,RNG,rival state and collected flags.
Guard bytes and keyboard-table flushes are exact. Missing/corrupt captures,wrong
counts or differing required values fail. Negative controls change RNG and a pixel.
Underlying map pixels are outside the two original popup rectangle comparisons.

The executable unit scenarios require35/7-tick waits and block unrelated actions.
An independent browser scenario enters the real money-bin animation,pauses it,
checks identical activity state and pixels outside the popup,uses S and hears the
resume sound,earns the coin,and exercises Escape/N and F1/Y. Quit preserves the
carried1000 without depositing it. Both popup rectangles match original pixels.
The final Restart is exercised. `npm run test:browser` includes this scenario;
headless comparisons do not substitute for it. All prior navigation scenarios now
use the Back/Office button for that adapter rather than mislabeling Escape.

### Original capture recipe

Single owner; DOSBox MCP0.84.0-vc1 f6d9b,normal core,3000 cycles,svga_s3,read-only
original mount. Load base01f5,DS/SS1403,helpers03b9,input0319. Real16-bit mode and
bytes remain validated. This inherits the conditional setup in [atomic evidence](atomic-transport.md);
there are **no new memory/CPU injections** in the controls capture and no restore.

1. From atomic arrival454,continue through the expedition's idle failure to map
 day16. A P scheduled during transition is not consumed. Paired P100ms at the
 stable map stops03b9:047f (455). Capture CPU,DS64K,and the three identity spans.
2. Stop03b9:05d5 (456),after drawing,35-tick wait and flush. Capture CPU/DS and raw
 pause PNG. P100ms resumes; capture at03b9:066c (457),before RETF.
3. Escape100ms opens Quit; stop03b9:03a7 (459),capture CPU/DS. N100ms; capture at
03b9:047e (460),before RETF. Quit's first presentation has not yet reached the raw
 VGA capture at this immediate polling entry,so it is not used for pixel acceptance.
4. Q100ms opens a second Quit; capture polling entry03a7 (461). Add a condition at
 the same address: DWORD DS2225 >= incoming clock+2. Capture at462 and raw quit PNG;
 the clock difference must equal2. Delete the owned condition breakpoint. No frame
 search or clock injection chooses the image. Y100ms reaches credits04ea:1098 (463).
5. Arm execution0319:01c4 and schedule paired S after3000ms. Capture after the real
 sound-off store (465). No RNG/account mutation is allowed. Allow the pending release
 to finish,then stop the next input poll after14 driver ticks (467) and remove the
 owned condition breakpoint. Original remains paused in credits with no replay or
 breakpoints pending.

A diagnostic write watch on DS03be produced an immediate stop at credits entry
before S dispatched,with sound still1. It also remained registered with `once:true`
after two reported hits. `.local/system-memory-watch-limitation.json` records its
status/listing/replay. No acceptance result relies on that watch: the sound case
uses the execution stop after the known store. Focused bridge correction: initialize
write-watch baselines when arming,and either implement one-shot removal for memory
watches or explicitly reject/document `once` for them. Explicit owned-id removal
was used here; no generalized emulator workaround was built.

## Save/load and high-score audit

Earlier status documents incorrectly listed save/load and high scores as confirmed
missing original features. No such interface or format has been identified in this
specific DOS executable. They must not be invented as original mechanics.

Evidence: Office overlay2:02e4 has the map,money-bin and investment routes; the global
input reader provides pause,sound and quit. The end flow compares banked totals,
then replay/credits; Quit goes directly to credits. Resident strings contain no save,
load-game,name-entry or high-score menu. The only matching “saves” string is Launchpad's
failure dialogue. The bundled readmes discuss installation/media,not persistence.

Linked generic file helpers do exist: resident140e:01f7 (open/create),022d (create),
02dc (far write),0338 (near write). Ghidra reports zero callers. The checker scans
unpacked resident code plus all10 original overlays and requires no canonical far
pointers or aliased direct CALL/JMP references to those entries. This is a bounded
static audit,not a proof excluding arbitrary computed transfers,other drivers or
other editions. No persistence implementation is claimed. Browser save files or
high-score storage would be explicit additions if requested later.
