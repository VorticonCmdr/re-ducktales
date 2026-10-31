# Campaign retries and collected locations

Build: `reference/build.json`, DUCKTALE.EXE SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Original resident code and actual overlay6 entry are used; this is not a loader
translation. Simulation receives controls, sound status and clocks through
explicit interfaces.

On the map, Fire on the current failed expedition opens its guide again and
enters the level directly. It creates no flight, spends no travel day and
consumes only the guide's one RNG draw before the level call. A later level
result spends its usual day. Cave maps/room rewards reset on each attempt;
carried cash persists. Jungle, mountain and photography gameplay is implemented;
see the current route and layout coverage in [STATUS](STATUS.md).

Trying a location whose treasure belongs to Scrooge or Glomgold shows the
original notice and returns to the origin's map. No journey occurs and no
cash/day/location/RNG changes occur. The money-bin coin latch clears even for
these attempts. Player ownership takes priority if both flags are present.
These checks happen before travel cost/flight, including from another origin.

| Rule | Original source | Current evidence |
| --- | --- | --- |
| Clear money-bin latch, then test player claim | resident0e68–0e82, DS4e26/4e30+slot*8 | Static, unit and browser |
| Player notice MAIN30; seven text rows x168,y60..164 | helper11c4:0008 case3; resident0e82–0f52 | Disassembly, original assets, browser render |
| Player notice80 seven-tick polls; Fire shortens at a poll | resident0f56–0f7c | Static, strict unit waits, browser |
| Rival claim blocks departure after player check | resident0312–0326, DS4e31+slot*8 | Static, unit and browser |
| Rival notice MAIN33; rows10d/11d/12c/13b at y60/76/100/116 | helper case10, resident0326–03b4 | Disassembly, original assets, browser render |
| Rival SFX6e; explicit status polling; seven-tick neutral waits | resident03a2–0437 | Static, device-boundary unit/browser checks |
| Once a busy poll is seen, completion bypasses extra40-poll wait | resident03c2–0437, local BP-14 | Static and strict unit checks |
| Sound idle before first poll uses40 seven-tick polls | resident03d8–03fd | Static and strict unit checks |
| Zero wrapped journey cost skips flight and enters dispatcher | resident0439–0454→04ca | Two original checkpoints, units, browser retry |

`campaign-visit.js` owns only notice state, not campaign state or RNG. The
application injects Fire, driver ticks, sound enablement and tokenized sound
status. Initial rival status is unknown until the real device answers; a muted
notice queries an existing device, and muting does not invent completion. Stale
completion events cannot release another notice, including after Restart.
Player notices use shared09f5(80); rival idle fallback uses09f5(40). Both flush
entry input, read immediately, wait seven ticks between reads and do not perform
an extra final read. P/Q/S are consumed by that reader, with Pause and Quit-No
returning into its suspended read and flushing old Fire. Rival speech uses the
same input continuation but seven-tick status polling. Only fallback Fire requests
enabled24; rival exit requests enabled0. Player exit has no sound reset.

`node scripts/verify-visit-input-source.js` verifies192 original/prepared/Ghidra
bytes and six declared relocations against the supported build. The original
shared reader and ordinary keyboard proofs are retained in
`verify-result-caller-source.js` and `verify-rival-keyboard-source.js`.
`node --test scripts/visit-input.test.js tests/visits.test.js` checks conditional
caller boundaries. This is static and conditional evidence, not original native
notice timing or waveform parity. Portrait striped reveals remain omitted.

## Reproduce the original retry comparison

`npm run verify:visits` requires the three ignored artifacts pinned in
`reference/campaign-retry.json`. Continue the second cave in `cave-runtime` from
0e0c:0b9c without input until failure and map return. Fire selects the current
Klondike slot15 at day6. Stop resident01f5:0439 before computing travel cost;
record CPU+DS64K+32 code bytes. Release Fire, continue to04ca and record CPU+DS.
Then continue through the guide to cave0e0c:0000 and record CPU+DS+32 code bytes.

Before: location15, target15, cash0, day6, seed62370, no ownership flags. At04ca,
AX and the travel-cost local are0 and campaign fields are unchanged. At the cave
call, seed20669 and variant0 match the port's single guide draw. Original code
signatures, DS/SS1403 and real mode were revalidated. No memory/register injection
or partial/full machine restore was used.

The verifier initializes a conditional map state exclusively from the BEFORE
artifact. It resolves every original location pointer to an authoritative
LOC.ARC resource, validates its coordinates/flags, then copies BEFORE ownership,
assigned treasure IDs, day/location/cash/RNG and prior game memory. One independent
semantic Fire event drives the actual application dispatch. An observer records
the incoming dispatcher and cave-call states without changing them; actual cave
construction still runs. Both checkpoints, one input event and all fixtures are
required. Omitted guide RNG, changed day and missing checkpoint negative controls
must fail. `npm run verify` includes this command.

This is conditional caller-segment evidence. No output-derived inputs, fitted
RNG/timers or post-call memory are used to start it. CPU/stack outside identity,
argument and cost fields, allocations, driver clocks, reveal duration and audio
completion timing are excluded. Normal Glomgold progression before the map is
not replayed by this segment; see [separate rival evidence](rival.md). Collected-notice pixels/poll timing are statically translated and
browser exercised, without an original notice capture comparison yet.

Historical capture session only:the original was paused at cave0e0c:0000, stop23, DS/SS1403, instance
0719a1b0cdcede0b85c39577ff760639. Fire was released; no active schedule or
breakpoints remain. Revalidate addresses after relaunch/layout changes.
