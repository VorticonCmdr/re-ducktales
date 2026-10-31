# Cave failure portrait input

The failure portrait now uses the original shared09f5(20) reader. It flushes on
entry,reads immediately,and performs seven driver ticks after each neutral read.
After20 reads the final neutral wait completes without a21st read. Pause and
Quit/Sound makes wait for a reader boundary;Pause and Quit-No resume the blocked
read after clearing old input. Only a consumed fresh Fire with enabled audio
requests click24. A Fire made during the last neutral wait cannot add a click.

The old browser path dispatched Pause immediately. Its preserved observation
opens Pause with139 ticks remaining. The current browser still has no overlay
at that observation and opens Pause at133,the next reader boundary. All existing
result fields are retained;the shared controller also continues to serve the
40-read award and100-read transmitter explanation.

## Browser scenario and verification

Real startup/flight → Too-Pei cave → original-map passage controls into a pit →
failure portrait → queued Pause → resume → Quit with queued Fire → No → neutral
read → fresh Fire → map → same-location retry → cave → Restart.

The11 full state/RGBA checkpoints and454 recorded DOM events compare exactly in
a fresh consumer. Omitting the first failure P make must fail specifically at the
Pause state comparison. Setup negatives reject empty checkpoints,missing files
and corrupt fixture hashes. Cash stays$150;the failure spends one day(2→3),does
not collect the treasure or unlock the transmitter,and retry creates no flight.

```sh
node scripts/verify-cave-failure-input-acceptance.js
node scripts/verify-cave-failure-input-source.js
node scripts/verify-cave-failure-input-setup-negative.js
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js
# Fresh browser replay;requires clean committed source and new ignored output:
node scripts/verify-cave-failure-input-browser.js --output=.local/failure-replay-FRESH
# New exploratory recording;does not certify itself:
node scripts/explore-cave-failure-input.js --controls --output=.local/failure-capture-FRESH
```

The [scenario](../reference/cave-failure-input-browser.json) pins the producer,
input stream,expected checkpoints,environment and artifact checksums. Each run
starts from a new application with BIOS seed0,UTC,muted audio,clock origin1 and
8ms presentation callbacks. No game memory,RNG,cash,ownership or actor state is
injected or restored. Expected output never chooses replay inputs. Each operation
owns a temporary Vite server and Chromium instance and closes both on exit.

## Source and scope

[Original source proof](../reference/cave-failure-input-source.json) checks34
original cave-body bytes against Ghidra CAVE_CODE.EXE1c17:1a90 after one declared
segment relocation. The entire11,054-byte cave body matches the original
executable directly. The caller passes20 to resident shared09f5,tests its return,
then checks enabled byte03be before requesting24. Existing shared-reader proof
and its original widths/flush/read/wait behavior remain authoritative.

This is static original evidence plus a browser port regression. Native portrait
reveal/drawing timing and acoustic alignment are not established. The browser
case is muted;enabled/muted click requests and final-neutral-wait behavior are
covered by focused conditional simulation checks. The existing click worklets
are unchanged. Other legacy dialogues remain separate investigations.
