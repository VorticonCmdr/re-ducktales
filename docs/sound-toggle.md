# Original keyboard sound toggle

Supported build: the original22-file pairing in `reference/build.json`. Originals,
driver dumps,device traces and browser captures remain ignored local artifacts.
Runtime:`e994536`. This milestone changes the keyboard S handler and its device
boundary;the browser checkbox retains its separate stop-only convenience behavior.
Here "device" means the reconstructed browser AudioWorklet,not a new physical
Tandy or PC-speaker recording.

## Source and restored behavior

`reference/sound-toggle-source.json` pins59 original/prepared/Ghidra bytes at image
`13da`,Ghidra `1124:019a`,with no relocations or analysis edits. Analysis uses the
known16-bit real-mode game code in `INVESTMENT_CODE.EXE`,not a loader stub. No new
live DOSBox observation or memory-layout claim is made. The shared live emulator
belongs to another investigation and was left untouched.

Statically established:enabled S calls sound0 then hex24 **before** clearing the
global enabled byte03be. Disabled S sets03be and then calls0. Both calls must reach
the driver even when the browser drains effects after the flag has changed. The
old browser path emitted only0 when switching off. Captured before/after office
scenarios now distinguish old `[0,0]` from restored `[0,24,0]` for S-off/S-on.

The PC-speaker stop has priority16;click24 has priority0. In a zero-interrupt
composition the original entry therefore rejects that click. Tandy's reset is
immediate and its click plays. A native call batch preserves those differences,
without retrying a rejected request or inserting the speaker's host restart wait
between calls. Native batches and status reads remain FIFO,including rapid or
queued calls. The separate legacy stop/start adaptation for ordinary browser
restart/title requests remains;it is not inserted into these native batches.

The normalization has **zero inserted IRQs between calls**. Original sub-call CPU
cost and PIT phase are not recovered here. Driver-word order,priority and memory
are established within that boundary;native global timing/waveform parity is not.

## Device status is an external input

Clearing the enabled flag gates future calls;it does not prove that a driver is
idle. Active rival reports now retain their last actual status until a real device
completion. They continue their original14-tick polls and bypass fallback40 after
an observed busy result. Stop/click does not publish an intermediate Tandy reset
completion before the following click.

A muted new rival report queries an existing device instead of inventing idle.
`Game` receives `hasAudioDevice` as an explicit environment callback;the browser
supplies its actual device lifetime. A never-created/disposed device is known
silent. A live device receives a token-scoped query which changes no native driver
bytes or port output. Query busy uses the speech loop and consumes real completion;
query idle takes shared fallback40. The same provider serves normal and forced
claims. No expected outcome supplies an audio status.

Other legacy collected-location/broker input readers still need their own audit.
This milestone does not establish every caller's input cadence or global native
CPU/audio alignment.

## Verification levels

- Static source:59 original/Ghidra bytes,original resource identities and speaker
  priorities16/0. `verify-sound-toggle-source.js` rejects source/build differences.
- Conditional composition:14 new cases within91 dialogue-boundary checks. Exact
  driver memory and Tandy PCM agree with independently invoked translated entry
  points. Queries preserve driver bytes. Rapid/FIFO cases and the deliberately
  wrong legacy barrier distinguish ordering/IRQ errors. These are not new original
  machine captures. All194 existing unit cases pass after correcting their old
  stop-only expectations.
- Conditional actual I/O:six actual-browser/device scenarios cover office S-off/
  S-on,muting during speech,and muted-entry queries for speaker and Tandy. Actual
  acknowledgements,priority rejection,completion and map/Restart work. Host20ms
  waits and Game16ms advances are explicit providers;absolute frame numbers are
  not compared across runs. Same-batch frame equality is exact. Real query busy
  is an input;the resulting speech/fallback branch is checked independently.
- Production:two fresh real-clock browser cases load the user's original folder
  and verify compiled speaker/Tandy stop/click calls,flag changes and Restart.
- Closed-loop browser regression:the unchanged winning Standard stream passes
  all170 exact public-state/decoded-RGBA checkpoints and6575 inputs,including
  all26 credits,finished screen,Restart and the omitted-selection negative.

Existing original speaker-engine comparisons also pass12 native checkpoints/
408 IRQs/1128 port writes with five negatives. Existing Tandy provider comparisons
pass three carried routes,16 checkpoints,13 requests,six completions and seven
negatives. Those retain their original conditional scopes.

`reference/sound-toggle-acceptance.json` pins every receipt,source archive and
checksum. Six cases and two production cases must execute;empty/missing/corrupt
record controls are rejected. Earlier failed snapshot-field explorations and the
deliberately stopped pre-fix broad regression are excluded. Captures remain
accepted:false;the separate acceptance checker validates them within these levels.

```sh
node scripts/verify-sound-toggle-acceptance.js
node scripts/verify-sound-toggle-source.js
node scripts/verify-sound-toggle-setup-negative.js
node --test scripts/sound-toggle.test.js
# Clean committed source and fresh ignored outputs:
node scripts/explore-sound-toggle.js --device=speaker --after --output=.local/toggle-speaker-FRESH
node scripts/explore-sound-toggle.js --device=tandy --after --output=.local/toggle-tandy-FRESH
node scripts/probe-rival-mute.js --device=speaker --mode=during --output=.local/mute-speaker-FRESH
node scripts/probe-rival-mute.js --device=tandy --mode=before --output=.local/query-tandy-FRESH
npm run build
node_modules/.bin/playwright test tests/production/sound-toggle.spec.js --config playwright.production.config.js --output=.local/toggle-production-FRESH
node scripts/verify-standard-wages-route.js --manifest=reference/standard-winning-route.json --output=.local/winner-FRESH
```
