# Expedition guide input boundary

The next confirmed input-boundary gap is the chapter/guide screen, before an
expedition starts. Its ordinary neutral countdown works, but global keys are
handled immediately rather than through the original input-reader boundary.
This has not yet been fixed.

## Original rule, statically inferred

Resident `12bb:00fe` ends by pushing30 and calling `11c4:09f5`. That shared helper
clears input once, reads immediately, waits seven driver ticks for each neutral
read, and returns after thirty waits without a thirty-first read. Pause and
Quit-No must return to the blocked read before a new seven-tick wait begins.

The [manifest](../reference/guide-input-investigation.json) pins300 original guide
bytes and88 shared-helper bytes. Ghidra's `INVESTMENT_CODE.EXE` is the real-mode
analysis image, not the game executable to run. Its guide bytes match the original
exactly after one explicitly recorded compiler stack-probe normalization and
three loader relocations by0x1000. No other guide-byte differences are permitted.
The checker validates the analysis executable hash, transformation manifest,
original build pairing, saved Ghidra bytes and language before using its C for
understanding. The original call bytes themselves confirm `09f5(30)`.

## Browser observation

Normal Easy play earns the transmitter via Too-Pei cave7. Six additional initial
neutral input reads naturally produce a misdirection; the player uses Pause,
Quit-No and Fire in the report, then reaches the redirected jungle guide.
At browser time92545/driver tick6741 the guide has remaining210 and no overlay.
A fresh P opens Pause by time92561/tick6742 while guide remaining stays210.
That demonstrates current global-key dispatch outside the guide's wait reader.
There is no RNG, memory, unlock or audio-status injection, and Restart succeeds.

The initial probe assumed eight milliseconds would consume P. It did not, and
its assertion failed before any overlay appeared. Its script/log remain pinned
as rejected exploration. The corrected probe waits for an overlay or the next
seven-tick boundary, rather than assuming one display frame consumes input.

This combines a browser observation with a static rule. It is not independent
replay of the guide defect or a live original-guide key capture. Exact original
chapter drawing/reveal costs and the absolute time of its first read remain
unverified; no whole-game timing claim follows from the16ms observation.

```sh
node scripts/verify-guide-input-investigation.js
# Missing analysis image has an explicit setup failure. Recreate locally with:
python3 scripts/prepare-investment-analysis.py
```

The next implementation should replace only the guide's legacy wait with the
verified reader contract: entry flush, immediate read, seven-tick neutral waits,
Pause/Quit resumption, and no final extra read. Preserve guide RNG/clue selection,
rendering and unchanged neutral-route snapshots. Other legacy dialogue callers
need their own targeted source/input evidence before expanding this change.
