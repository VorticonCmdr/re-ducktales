# Cave treasure reveal

The first treasure presentation now uses the original EGA striped page copy.
It preserves the old visible room between copied rows, publishes five groups,
waits five display retraces after each group,and leaves drawing/display page
roles unchanged. The next fourteen treasure presentations remain ordinary flips.
The fifteen party draws and their RNG calls remain intact. This replaces one
ordinary retrace with twenty-five retraces;it is a specific timing correction,
not a whole-cave cadence claim.

## Evidence and scope

Supported build: the22-file pairing in `reference/build.json`.
Original overlay6:173d calls DS:1fdc;1770 and17b5 call DS:1fd4.
The three-iteration loop ends at17c0. Ghidra `CAVE_CODE.EXE` places the overlay
at1c17:0000;it normalizes these listings to equivalent1d39 offsets. The verifier
converts segment:offset to a physical image offset and requires every byte to
match the original overlay extracted directly from `game/DUCKTALE.EXE`.
Analysis-image bytes are never executed.

Decoded `IT.DRV` resource1:0101..0154 copies forty bytes per row,forty rows per
group,with a200-byte row stride. Group starts are0,40,80,120 and160 bytes.
Each group waits for five retraces. The routine does not execute the BIOS page
selection or page-role XOR in00e5. The new command composition copies the same
rows into the current visible page using immutable source/target drawing lists.

`reference/cave-reveal.json` pins three local Ghidra captures and the relevant
implementation/verifier/browser sources. The static comparison checks78
instructions/186 bytes. A separate synthetic mechanism fixture compares every
RGBA byte of five320x200 publications against an independently traversed row
oracle,requires25 declared retraces,and verifies unchanged page roles. It is a
component boundary check,not a restored game or original-machine scenario.
Seven negative controls cover altered source bytes,corrupt pixels,premature
full-page presentation,missing groups and a shortened wait.

Existing cave checks separately cover six conditional original runtime
checkpoints,entry state and negative controls,four independent terminal routes,
closed-loop input replay and all four passage directions. These do not establish
native treasure-reveal timing or whole-level parity.

The actual-browser cave route uses startup,keyboard flight,pit failure,retry,
ordinary room pickups,treasure award,campaign return,duplicate protection and
Restart. It additionally requires every reveal band0..4 and saves a canvas image
for each band. No game state is injected to reach the treasure.

The focused gate passed on2026-10-30:all source and mechanism checks,existing
cave regressions,177 unit cases,one actual-browser route with all five groups,
and the production build. Canvas captures for groups0 and4 were also inspected.
The [receipt](../reference/cave-reveal-integration.json) pins the accepted local
log,canvas captures and source archive. That focused receipt alone makes no
complete-campaign claim;the separate[fresh campaign gate](cave-reveal-campaign.md)
now covers the complete Easy route after this change.

## Reproduction

```sh
npm run verify:cave-reveal
```

Required originals or static captures missing/corrupt are setup failures. Source
counts,all pixels,all groups,declared waits and the browser sequence are strict;
there are no waived differences or fitted timer values. Local Ghidra captures
live in `.local/cave-reveal-01/static/`;they must remain local because they
contain original instruction bytes. To recreate them,use bounded
`disassemble_bytes`,no flow following:

- `CAVE_CODE.EXE`,1c17:172d,length20.
- `CAVE_CODE.EXE`,1c17:1770,length82.
- `ducktales-ega-driver.bin`,0000:0101,length84.

The capture response does not report a server revision;the manifest records
that limitation rather than inventing one. Static capture is not a native machine
checkpoint. No live emulator state was changed for this work.

This change invalidated the previous campaign's timing-dependent receipt after
the cave segment. Its historical captures and expectations remain unchanged.
The[fresh full campaign](cave-reveal-campaign.md) now has a passing clean combined
gate from startup,including independent full replay,actual-browser controls,
pixels and restart. Remaining cave composition/minimap/copy/CPU/device costs
and original audio timing are still incomplete.
