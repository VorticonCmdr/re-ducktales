# Global pause, sound and quit controls

Supported build: [build.json](../reference/build.json). The original input routine
`1124:0002` maps P to pause,S to sound,and Q/Escape/F1 to the quit question.
The browser now exposes those keys and equivalent buttons. Back/Office remains an
explicit navigation adapter. Escape no longer means Back/Office.

## Behavior and implementation

`src/game/system-controls.js` owns the blocking dialog state and original layout.
`application.js` blocks simulation advancement while a dialog is active; rendering
continues over the current scene. Audio completion remains an explicit external
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

The original routines are blocking calls from the input reader. The browser
currently consumes global key events on the next driver tick. Exact alignment
with every original activity's input-poll boundary,especially uninterruptible
animation/audio waits,is **not reproduced**. Original IRQ clocks keep running
inside the dialogs; the browser freezes activity clocks while its diagnostic game
clock advances. Long-pause active-level timing has not been compared with a carried
original replay. These are remaining fidelity gaps,not a whole-game timing claim.

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
