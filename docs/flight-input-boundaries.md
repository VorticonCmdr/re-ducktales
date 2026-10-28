# Flight inputs at consumption boundaries

The original flight loop advances physics, renders, resolves collisions and then
reads controls. `Flight.frames` advances before that read. It is therefore not an
input-consumption counter. The old feedback test could observe either side of a
read depending on the driver/retrace phase; restoring the difficulty menu exposed
that assumption. No physics, RNG or clock rate was changed to make the tests pass.

`Game.snapshot().flight.inputReads` and `lastInputCode` expose existing input-log
observations. They do not mutate game state or drive simulation. The browser
helper submits actual keyboard events before each next read, checks its consumed
value, rejects skipped reads and requires the complete independent stream.

`reference/hard-flight-inputs.json` holds four frozen streams with226,307,262 and382
samples. They were observed while replaying the prior accepted3284 DOM events on
port commit57beb92. That unchanged replay still matches all24 original port
checkpoints and renders1474 flight presentations. These are port-input captures,
not original DOSBox inputs or proof of original whole-flight/campaign parity.
The observer copies completed `Flight.inputLog` arrays; it does not change input,
time, memory or return values. No target final RNG value selects the samples.

`node scripts/verify-flight-control-profiles.js` checks the independent source
input hash, baseline Git source identities, observer revision, both private
artifacts, all1177 sample values/counts/digests and three negative controls.
Missing/corrupt fixtures and zero or unfinished cases fail explicitly.
`node scripts/verify-flight-input-browser-negative.js` omits a real ArrowDown
at the first turn. The browser must reject consumed input18, rather than reach a
later actor comparison or fail setup. The ordinary Hard expedition routes retain
their existing frame/RNG/actor/outcome comparisons after this input adapter change.

## Reproduce the observation

Create a clean temporary Git worktree at the manifest's complete baseline commit.
Supply its authoritative `game/` and dependencies, plus a copy of the immutable
`.local/hard-campaign/accepted-reference-09/` artifacts. Preserve the old accepted
capture; write recapture output to a new local file. From that baseline checkout,
set `DUCKTALES_OBSERVER_BASELINE_ROOT` to its absolute path and
`DUCKTALES_OBSERVER_OUTPUT` to the new output JSON path. Then run Node with
`--import /absolute/path/to/scripts/observe-flight-controls.js`, followed by
`scripts/replay-hard-campaign.js .local/hard-campaign/accepted-reference-09`.
Require exit success,24 checked checkpoints and3284 consumed events. The decoded
observed arrays must equal the versioned run-length streams exactly.

This boundary schedule is scoped to the captured routes. It is not a general
flight autopilot and does not establish arbitrary-route finishability. The
browser still supplies independent driver/retrace clocks, real keyboard actions
and actual rendering; it does not inject a flight state or RNG value.

## Natural lightning route

`reference/lightning-flight-inputs.json` pins111 player input values observed
without changing controls or returned values during the passing baseline57beb92
browser route. The private capture script wraps Flight.resume solely to copy
inputLog. Its baseline source, observer, real DOM events, complete trace,
recovery result and passing browser log are hashed separately. The final112th
logged byte0 is caused by the strike's keyboard flush, so it is an expected
internal result, never replayed as an external neutral input. The browser keeps
Space+Down held after value111, observes read112, and verifies the unchanged
frame112/tile17/y136 strike, deceleration without new input, and recovery after
fresh keys. Full original flight timing and hardware parity remain unproven.
`node scripts/verify-lightning-control-profile.js` rejects missing/corrupt
artifacts, zero/missing controls and an altered value.
