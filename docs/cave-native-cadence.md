# Original cave passage and current divergence

The85bc2f3 investigation found a passage-order mismatch and a conditional timing
divergence. The ordering is now [corrected](cave-passage-order.md);timing remains
open. Runtime was unchanged during the original investigation. The existing
winning-route acceptance remains evidence for its recorded route,not native cave
animation timing.

## Original reference

[Manifest](../reference/cave-native-cadence.json) pins224 local artifacts from
`.local/cave-cadence-native-02`,capture source `4d984d4`. A fresh private portable
emulator runs the supported22-file original build read-only,normal core3000
cycles/ms,svga_s3,16MiB,vmem_delay off. Natural security/map keys select45,68,
Carlsbad Caverns. The shuffled location is19,variant1,Easy,day4,seed59536,cash0.
Only a naturally nonracing flight uses the authored crash setup. No game memory,
CPU or destination/racing flags are written and no state is restored.

The actual11054-byte cave overlay is checked after196 relocations at entryIP0.
The first returned input09a6 is neutral,room45,torch1,enemy27,seed17977. All
breakpoints are then removed. Independent engine inputs make Right+Space at
relative rendered frame0 and release both at10. A read-only Lua observer records
480 consecutive callbacks across479 frame intervals and498 resident counts,
about6.834s. All four inputs finish. Only the final manual pause adds a stop,
222→223. The owned emulator closes with return0 and leaves HOME/shared session
unchanged.

Original transition brackets relative to the first observer sample:

| Change | Milliseconds |
| --- | ---: |
| Room45→46,entering flag set,torch still1 |256.827..271.096 |
| Torch1→2 |2796.564..2810.832 |
| Entering flag cleared |5421.910..5436.178 |

The last sample is still in the second-room entrance animation;cash remains0.
It is not a complete passage/reward reference. Party coordinates/frame,RNG and
enemy state are retained. Page changes are sampled lower bounds,not exact flip
or CPU timestamps.

```sh
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-security.py \
 --cave-page-observer --port 8404 --output .local/cave-cadence-native-FRESH
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_cadence.py
```

The saved checker validates source archive,originals,actual emulator binary and
configuration,complete cave identity,three EGA code ranges,all480 samples/input
completion and owned shutdown. Five negatives reject missing samples/fields,
skipped frames,missing release and altered code. Missing/corrupt evidence and
Python optimization fail. Full flight/FPU-handler/IVT checks occur in the
archived capture recipe;this saved checker does not independently recompute
those flight snapshots or other EGA code/mutable copy operands.

Capture01 (`23a100e`) is excluded:the script completed but its structured output
hit the tool's2000-node serialization limit,returning142 complete rows plus a
partial143rd. `output_truncated:true` correctly failed capture. Its owned process
also closed. The engine advertises2000 output nodes and65536 output bytes;the
initial recorder comment's32KiB assumption was wrong. Compact13-column integer
CSV in capture02 uses20137 characters and avoids the node limit. Counts/column
widths remain strict;no partial output is accepted. This is a focused recorder
format change,no emulator modification.

## Port probe and source order

```sh
node scripts/probe-cave-native-cadence.js
```

This exploratory strict comparison currently **exits1**. It is not an acceptance
gate. It starts the current Cave component from native ENTRY memory/contract,
carries its own state with zero-phase driver/retrace and actual graphics wakes,
and supplies immediate OrdinaryKeyboard mode0 makes at0ms and breaks at142.682ms.
Both controls release before any500ms repeat. No expected outcome supplies an
input,timer or intermediate state;expected first-input/observer data are read
after simulation finishes. Native IRQ/i8042 phase and resource-loading CPU costs
are not reconstructed. This is injected component initialization,not an original
machine restore or browser campaign. An initial disposable diagnostic accidentally
sent makes at the release boundary;it is excluded. The versioned probe sends
and requires both proper breaks,and reproduces the divergence.

All nine first-input gameplay fields match. Before the ordering fix,the first recorded divergence was
the port changing to room46/torch2 at1712.182ms,where the native room change was
256.827..271.096ms with torch1. The port clears entering at1883.400ms and awards
$50 at3666.923ms;the original has cash0 through6834ms. This cannot be admitted
as timing parity or repaired by fitting a global speed multiplier.

Ghidra `CAVE_CODE.EXE` alias1ce1:02b1..03de supplies106 contiguous instructions,
302 bytes,all checked against the original cave body after analysis relocation
bias1000. The right-passage branch increments DS4d32 at02f6 and sets DS8eb2 at02fa,
then loads the transition resource at0325 and calls exit animation at03d4. The
JavaScript at85bc2f3 instead updated those fields after the exit animation. This
order mismatch is statically confirmed independently of unknown native clock
phase. Original resource loading also occurs inside the measured interval;its
contribution is now isolated by the loader experiment linked below.

The ordering fix now passes all four passage directions and the browser cave
scenario. [The loader measurement](cave-loader-work.md) isolates84 conditional
driver counts for sprite10 alone. The remaining work is to count/schedule original
loading work and repeat this strict probe and affected campaign checks. A fixed
delay inferred from these samples is not accepted.
