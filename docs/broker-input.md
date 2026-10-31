# Broker confirmation input

Build:`reference/build.json`,the supported22-file DOS pairing. Trading overlay10
is the5986-byte MZ at DUCKTALE.EXE file26e00;its original body is mapped at image
c170 in the analysis-only `INVESTMENT_CODE.EXE`. The executable is never run.

`node scripts/verify-broker-input-source.js` checks105 original/prepared/Ghidra
bytes and exactly two loader relocations. Overlay10:02b8 calls shared09f5(50).
That reader flushes entry input,reads immediately,waits seven driver ticks after
neutral input,and returns after the50th wait without an extra read or final
flush. Only consumed Fire plus enabled03be requests24. The graphics1fe0/1fdc
calls are not audio resets. Office entry separately requests enabled0,then6
around its drawing/reveal. The original trading and calendar routines remain
unchanged;`npm run verify:investments` checks their existing native segments.

Pause and Quit-No resume the suspended broker read after clearing old input.
Quit-Yes takes the existing credits exit. S is consumed at the broker poll;
muting before Fire suppresses the broker click. The portfolio exit Fire is
flushed and cannot shorten its own confirmation. Leaving without a successful
trade bypasses the broker. The next trading visit clears3bb4 but retains shares.

An unread key during the last neutral wait belongs to the next reader. The
broker frees its resources and returns via resident0310/0304 to office35,with
normal rival/market cleanup between. Office entry has no19a5 flush. For the
day1/no-rival-report route,late P must open Pause at the office's first input
read,after its reveal. The port transfers that unread semantic scan slot to the
office queue. An intervening rival report flushes on entry instead. No extra
broker read or click is invented. This handoff rule is statically inferred;
the new late-key browser case is port regression,not a native whole-handoff
timing comparison. The shared-reader proof is in `result-caller-source.json`,
and the original office component evidence in `office-menu.json`.

## Current verification work

Runtime:`3c3a481`. The12 conditional checks in `scripts/broker-input.test.js`
use explicit funded setup;they are not an earned-cash runtime scenario. The
browser capture starts normally,earns the money-bin coin,buying one share for22
leaves978,then uses the portfolio's original exit selection. Fire and timeout
routes cover Pause,Quit-No,discarded old Fire,office return,persistent shares,
reopening and a no-trade exit. Each has13 exact public-state/decoded-RGBA
checkpoints. A third case covers final-wait P through office Pause and resume.
Independent consumers and a fresh winning Standard regression are in progress;
the broker milestone is not yet accepted.

```sh
node scripts/verify-broker-input-source.js
node --test scripts/broker-input.test.js
node scripts/explore-broker-input.js --controls --output=.local/broker-fire-FRESH
node scripts/explore-broker-input.js --controls --timeout --output=.local/broker-timeout-FRESH
node scripts/explore-broker-late-key.js --after --output=.local/broker-late-FRESH
node scripts/verify-broker-input-browser.js --output=.local/broker-replay-FRESH
node scripts/verify-broker-input-setup-negative.js
node scripts/probe-broker-audio.js --device=speaker --output=.local/broker-audio-FRESH
```

Capture/replay commands require clean committed source and fresh ignored outputs.
They own isolated Vite/browser instances and close them in `finally`. Original
assets,BIOS0,clock origin1,UTC and8ms browser scheduling are recorded. Audio
probes add explicit host20ms waits/Game16ms advances for actual device ACKs.
Neither those ACK frames nor the port's graphics scheduling establish native
CPU/PIT phase,reveal cost,isolated click audibility or analog waveform parity.

The pre-correction full campaign job `.local/broker-winning-replay-01` was
explicitly stopped for the source-proven late-key correction;its exclusion is
recorded locally. It is not acceptance. The earlier26-point broker receipt and
two audio probes retain their pre-correction source scope. The baseline
`.local/broker-late-before-01` records the lost P and is also not acceptance.
Native late-key capture,CPU-bound portfolio polling,modifier/mouse/joystick
parity and arbitrary investment/campaign paths remain outside this milestone.
