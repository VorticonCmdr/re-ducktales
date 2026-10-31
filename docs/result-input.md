# Treasure award and transmitter explanation input

The ordinary treasure award now uses shared09f5(40), and the transmitter
explanation uses shared09f5(100). `ResultInputWait` backs the existing plain result
fields, preserving neutral snapshots and keeping the simulation independent of
DOM,wall time,file access and audio playback. Each wait flushes on entry,reads
immediately,waits seven driver ticks after neutral input,and exits after its final
wait without an extra read. Pause/Quit-No return to the blocked read after input
is cleared. A fresh Fire is needed after modal input.

A separate `skipped` result records only Fire actually consumed at a reader.
Only that result with enabled audio requests click24. Fire made during the final
neutral wait cannot invent a click. Original caller order is click24 → collected
flag → optional transmitter unlock/cue54 → fresh100-read explanation → optional
click24 → campaign continuation. The local synthetic audio reset was removed;
successor contexts retain their own audio policies. Award49 and notice54 are
requested only when audio is enabled at their original call boundary,preventing
requests made while muted from appearing after a later toggle.

[Original caller proof](../reference/result-caller-source.json) checks567 original
bytes and461 Ghidra bytes after exactly3 loader relocations. The existing
[pre-fix observation](award-input-investigation.md) remains historical. No native
IRQ/audio phase between drawing calls,or exact reveal/drawing-cost parity,is
claimed. Failure portraits and other legacy dialogues are separate paths.

## Earned browser route

Normal Easy startup/security → Launchpad flight → Too-Pei cave7 treasure → award
P+Fire → Pause/resume → Q+Fire → No → neutral read proves old Fire discarded →
fresh Fire → unlock/explanation → same controls → map → Restart. Cash remains
$3,400 on day3;location24 is collected and the transmitter is available.
All27 checkpoints and488 real DOM events must match exactly in a fresh consumer.
The required omission negative removes award P and must diverge specifically at
`award-pause`. Only its one deliberately removed event is deducted in the negative
input-count check; positive counts and all expected state/pixel values remain exact.

The external providers are UTC,BIOS seed0,a game clock starting at1 and8ms
presentation callbacks. This strict recording/replay is muted. There are no
memory,ownership,RNG or recorded audio-status injections. Expected outputs never
choose replay controls. Original files and traces stay ignored.

The independent result replay and all15 historical browser routes passed.
[Current acceptance manifest](../reference/result-input-acceptance.json). The
historical comparison retains343 exact checkpoints/11,601 events,all8 cave
components/2,696 presentations and the full34-checkpoint headless campaign.
194 units,40 focused boundaries and the production build pass. Whole-game native
parity,arbitrary-route finishability and Hard campaigns do not follow from these
scenarios;Hard remains deferred.

## Actual audio boundary observations

Separate normal-play probes enable Sound with S at the award reader. The actual
PC-speaker and Tandy worklets both acknowledge0,24,54,24 in order,produce nonzero
signal and allow Restart. No reset occurs between the first click and notice.
[Audio boundary manifest](../reference/result-audio-boundary.json).

These probes await real processor acknowledgements on the host while the injected
game clock is stationary. They establish actual browser/device I/O,not independent
whole-game replay,native acoustic alignment or waveform parity. Result waits do
not consume audio busy status. Successor-context acknowledgements may follow the
required prefix;their timing is outside this comparison. No completion is injected.

```sh
# Fast validation of saved current-runtime acceptance:
node scripts/verify-result-input-acceptance.js
node scripts/verify-result-caller-source.js
node scripts/verify-result-audio-boundary.js
node --test scripts/result-input.test.js scripts/guide-input.test.js scripts/atomic-input.test.js
npm test
npm run build
# Fresh recording,requires clean committed source:
node scripts/atomic-route.js capture --award --output=.local/result-FRESH
# Fresh independent consumer of fixed inputs/expectations:
node scripts/atomic-route.js verify --award --capture=.local/result-earned-browser-01 --output=.local/result-replay-FRESH
# Fresh historical-route consumer:
node scripts/verify-preserved-routes.js --output=.local/preserved-FRESH
```

Cue words above use hexadecimal notation:click0x24=36,award0x49=73 and
notice0x54=84 as decimal request words. The actual processor ACK manifest stores
the decimal words. Three saved-receipt negatives reject zero browser cases,a
missing award checkpoint and corrupt regression bytes:

```sh
node scripts/result-input-acceptance-negatives.js --output=.local/result-receipt-negatives-FRESH
```
