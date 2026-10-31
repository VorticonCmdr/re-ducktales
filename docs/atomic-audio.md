# Atomic transport sound status

Runtime:`ddb844a`,supported22-file pairing in `reference/build.json`. This changes
the resident atomic controller and its browser environment boundary;original
assets,rolls,location selection and wrapped calendar rules remain authoritative.

`node scripts/verify-atomic-audio-source.js` checks124 original/prepared/Ghidra
bytes and four loader relocations in `INVESTMENT_CODE.EXE`. Success and failure
guard initial request0 on03be,wait7 driver counts,then request enabled54 or45.
Only failure queries global sound status at056b. That query is unconditional,
including when sound45 was skipped. Its busy spin has no input read or timed
driver delay. Report entry remains the shared09f5(60) reader and input flush.
The existing413-byte report/reader proof and five conditional native travel,
calendar and pixel comparisons are retained separately.

The controller now waits for an actual initial ACK or query result. Enabled45
can return busy or idle;muted failure queries an existing used device. Muting
does not invent idle. A matching idle status resumes the source spin at the
status-consumption boundary,without adding a driver tick. Stale tokens and
statuses outside the sound phase cannot release a different wait. P/Q/S during
charge or sound are not read;report entry discards them. The checkbox is the
existing stop-only browser convenience and still requests the real device reset.

## Initial silence and environment contract

Browser key handling unlocks audio on S even when the game later discards that
key. Unlocking a fresh device cannot start sound:both original driver resets
initialize idle,and both reconstructed providers remain idle with zero output
through a request-free second. `GameAudioDevice.hasRequests` distinguishes that
known initial state from any posted request. The browser's `hasAudioDevice`
provider means a live device with prior or pending requests requiring real status.
Once sequence is nonzero,even an unacknowledged reset prevents the known-idle
shortcut. No cached enabled flag,estimated duration or later idle value supplies
completion. The controller samples the provider after charge,where the original
queries status. This narrow initial-state rule preserves the existing muted
replay even when an ignored S has unlocked an unused context.

Inputs are DOM controls,BIOS0,explicit browser scheduling,and actual audio
ACK/completion events. Audio probes add host20ms waits and Game16ms advances;
these are conditional I/O experiments,not recovered CPU/PIT phase or original
sound latency. The strict muted replay uses its existing fixed independent input
stream and exact state/decoded-RGBA expectations. No fitted clocks,RNG or state
injections choose the result.

## Verification work

The194 unit checks and120 input/device boundaries pass,including nine new cases
for conditional0/54/45,unknown initial status,muting,stale status,dynamic device
presence,immediate spin return and the pending-reset negative. Four actual-browser
speaker/Tandy probes pass:entering muted and muting during45. Each starts normally,
earns Bombastium from Too-Pei cave7,selects atomic travel,waits for actual status,
enters the failure report,then the redirected jungle and restarts. The unchanged
23-checkpoint/492-event muted report replay and both omitted-input negatives pass.
The fresh complete winning Standard replay is still running;this milestone is
not yet accepted.

```sh
node scripts/verify-atomic-audio-source.js
node --test scripts/atomic-audio.test.js scripts/atomic-input.test.js
npm run verify:atomic
node scripts/probe-atomic-audio.js --after --device=speaker --mode=before --output=.local/atomic-audio-FRESH
# Repeat probe for speaker/tandy,before/during;fresh output each time.
node scripts/atomic-route.js verify --report --capture=.local/atomic-earned-report-01 --output=.local/atomic-muted-FRESH
```

Capture/replay requires clean committed source and fresh ignored outputs. Each
command owns an isolated Vite/browser and closes both in `finally`. The first
baseline attempts are excluded:one overconstrained ACK count,and the diagnostic
second attempt revealed Fire discarded by the map's drawing wait. Baseline03
waits for the actual map reader and records old `[0,0,24,0]`. The corrected muted
path is `[0,0,24,query]`. Speaker-during01 is excluded because its assertion
incorrectly expected a destination-confirmation click;the original click applies
to selection changes. Correct during cases record `[0,0,45,0]`.

Cave status handling is not changed here. Its next-milestone51-byte static proof
is `reference/cave-audio-source.json`;three terminal loops spin on global status
without driver delays,and the common exit guards0. Native whole-atomic elapsed
time,hardware waveform/phase,chapter drawing costs and Hard campaigns remain
unverified or deferred as described in [STATUS](STATUS.md).
