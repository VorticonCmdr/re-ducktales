# Automatic Launchpad departure

Supported identity: the 22-file build in `reference/build.json`, executable
SHA-256 `fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
This is an EXEPACK MZ, x86 little-endian 16-bit real-mode application with
overlays. The resident program and EGA driver contain actual game code.

Confirming ordinary aircraft travel now clears and wipes the previous page,
copies Launchpad's portrait, reveals the speech, then starts flight automatically.
There is no extra Fire prompt. A fresh Space press in flight accelerates the
aircraft; Down raises its nose. Restart remains available throughout departure.

## Source and environment contract

Resident `11c4:0008(3)` calls the EGA full-page fill through DS:1fd8
(`01b0`, not a page-select operation), wipes through DS:1fe0, selects MAIN[30],
copies 320×200 from RAM, then flushes input at `11c4:016d`.
Main `1000:06d9` advances the RNG for speech; `0754` reveals the page through
DS:1fdc. Each wipe/reveal has five groups of five retraces. After reveal,
`0806` advances the race RNG, `083d` optionally calls `126b:032d` to store
origin/target, and `084d` invokes the flight overlay with two 16-bit stack words.
No keyboard reader occurs between these calls.

`Departure` remains a pure prediction of the call-contract metadata.
`DepartureScene` commits the actual campaign RNG writes at the two source sites.
Its only external inputs are the original assets, explicit simulation clock,
driver ticks and retraces. Callbacks expose RNG commits, the source input flush
and race registration. Rendering never supplies inputs or advances the RNG.
The final visible reveal is published before a same-time continuation enters
flight; that continuation adds no timer delay.

Fill work counts 29 instructions, five OUT operations and one 8,000-iteration
REP; copy work uses the existing RAM-to-EGA model. Resource loading, speech
drawing, striped writes and remaining CPU/IRQ/device costs are omitted. These
are source-derived partial budgets, not measured native elapsed-time parity.
Flight still uses its earlier held-control provider; translating its ordinary
keyboard reader and cross-scene IRQ delivery remains separate work.

## Reproducible evidence

Run `npm run verify:departure-sequence`. Missing local originals or capture
artifacts cause explicit failure. No original file or previous expected stream
is rewritten. No emulator launch or partial memory restore is needed by this
command.

The clean run on `ba6a36f` passed all167 unit cases,six browser scenarios,the
stalled-handoff browser negative and production build,with no skipped cases.
Its673-file source archive,logs and browser evidence are pinned in
`reference/departure-sequence-integration.json`;all758 protected historical
artifacts remained unchanged. This verifies the focused milestone,not whole-game
completion or original whole-scene elapsed timing.

`reference/departure-sequence.json` pins six ignored static exports in
`.local/departure-sequence-01/`, all current runtime sources and the unchanged
native departure and keyboard manifests. The verifier reconstructs EXEPACK
relocations at segment 1000 and compares all 181 instructions / 463 bytes;
the driver bytes match IT.DRV[1] directly. The existing native observations
remain main `01f5:06d9`, prepared `01f5:0845`, and flight entry `0e0c:0000`,
with independently retained stack arguments and entry bytes.

Static export recipe: prepare the original unpacked resident program as described
in `expedition-departures.md`, and import IT.DRV[1] as the EGA driver. Use Ghidra
MCP `disassemble_bytes`, explicitly selecting the program, with
`follow_flow=false`, `include_instructions=true`, `max_instructions=200`.
Save the complete tool response locally, without rewriting the original binary:

| Local export | Program | Start | Length |
| --- | --- | --- | --- |
| main-tail.json | DUCK_UNPACKED.EXE | 1000:0754 | 251 |
| portrait-head.json | DUCK_UNPACKED.EXE | 11c4:0008 | 71 |
| portrait-copy.json | DUCK_UNPACKED.EXE | 11c4:004f | 45 |
| portrait-flush.json | DUCK_UNPACKED.EXE | 11c4:016d | 9 |
| race-store.json | DUCK_UNPACKED.EXE | 126b:032d | 24 |
| driver-fill.json | ducktales-ega-driver.bin | 0000:01b0 | 63 |

These bounded ranges exclude the portrait jump table and the INT3f overlay-vector
data. Native parent captures retain their own emulator configuration, source
revision and setup recipe. No new live emulator state is claimed by this export.

The conditional segment starts from the native parent's declared routine input,
uses no events during departure and checks both RNG results, flush order,
race stores, flight arguments, 50 consumed retraces and the exact completed
native portrait. Six negative controls alter source bytes, RNG, race registration,
flush, reveal length or pixels. This is not an uninterrupted original campaign
or a native capture of every intermediate frame.

Unit scenarios cover catch-up scheduling, hidden-page pause, restart at the final
publication, source flushes and race handoff. Actual browser cases use physical
keys and rendering: every wipe/reveal band, all five reveal pixel masks,
automatic flight/takeoff and Pause surviving only after the source flush.
The browser negative suppresses the handoff and must fail the required flight
assertion, without a timeout. The full keyboard cave route additionally checks
landing, failure, retry, treasure, reward and campaign return.

`reference/departure-destination-loop.json` is an explicit runtime refresh of
the previous destination manifest. Its verifier requires the parent checksum
and exact equality of every old expected value, input and comparison rule.
Only current source identities are refreshed. Two negative controls reject
altered checkpoint counts or relaxed rules. The old default source guard remains
unchanged; historical receipts retain their original scope.
