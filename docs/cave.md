# Cave expedition slice

Build: `reference/build.json`. Overlay6 SHA-256:
`b50b7f3163c516c298569ab3ec301f2d0e31f456a623bfafe294d6077344713d`;
body `2114197d8aef68f97c58a253a3f1d2414370d81723ebf1f28a84048129d5350d`.
INT3f index0c selects this actual game code, not a loader stub.

## Working browser route

Easy → office → map → Klondike → Launchpad → fly to airport → landing →
Junior Woodchuck Guide → cave. Hold an arrow to point and Space to move through
an available passage. A new safe room after the first awards the original $50
after73 driver ticks. Restart works. Maps, room/party/torch/passage art come from
EXP.ARC/CAVEMAPS.ARC. This is **an interactive room slice, not a complete level**.
Treasure collection, pit/capture/torch-expiry animations and campaign result
handling still stop explicitly. No successful or failed outcome is substituted.

`cave-scene.js` translates setup and normal EGA composition. `cave.js` supplies
independent driver/retrace clocks, held-input sampling, room transitions, cash,
lamp counters and pursuer movement. `expedition.js` translates main12bb:00fe/022a:
chapter screen, one RNG draw for its CLUES.ARC group, and30 seven-tick input polls (210 driver ticks), shortened by Fire.
Other activity chapters stop before their untranslated gameplay. Same-location
campaign dispatch remains unsupported pending collected-location rules.

Map bits:1 left,2 right,4 down,8 up,16 visited/start,32 goal,64 pit. All64 words
are parsed exactly, accepting original map4's trailing spaces. Entry locates
start/goal and draws RNG&63 until the pursuer differs from the player. Lamp
limits64/48/32 and pursuer intervals20/16/7 depend on difficulty. The pursuer
threshold uses distance from the player to the goal, an original quirk. Party
drawing consumes one RNG for torch-frame selection and prevents immediate
repeats. Original memory offsets and integer widths are deliberate. Rendering
observes commands and does not advance simulation.

Movement, room cash, lamp and pursuer rules are statically inferred. Browser
acceptance covers real controls, landing, cave entry, one safe-room move, $50
and restart. This is not a complete original cave replay or a completed level.
Minimap refresh order and later animations need runtime comparisons. Unsupported
terminal paths stop before a substitute result could affect the campaign.

## Original comparison

`npm run verify:cave` requires artifacts pinned in `reference/cave-entry.json`.
Continue the earlier flight repair at main01f5:0ae5, then dispatcher04b0:0002
(target6) and04b0:00c8. Overlay entry0e0c:0000 receives variant7 (Siberian), cash25,
seed51460. Original bytes begin `558becb886009a9e1e030656c646f200`; DS/SS1403 and
real mode were revalidated. Capture CPU+DS64K+32 code bytes; continue to0e0c:05ed
just after the first party draw and capture CPU+DS64K.

The actual Cave constructor uses the captured entry as a conditional starting
state. Exact comparisons cover all64 map words, actor indices, RNG51460→9142,
lamp/time fields and sprite geometry/frame bytes. Dynamic allocation pointers,
CPU, stack, device buffers and clock are outside this browser boundary. The
first presentation is pending at this stop, so an immediate screen capture can
be black. No original pixel comparison is claimed. Changed-torch, changed-map
and missing-checkpoint negative controls must fail.

The original cave was visually observed at0e0c:081f before input. That session
was later restarted for loot capture; revalidate mappings before reuse. No
partial memory restore or machine checkpoint was used.

## Static analysis

`npm run prepare:cave-analysis` combines resident and overlay6 bytes into ignored
`.local/analysis/CAVE_CODE.EXE`. Only the analysis copy normalizes stack probes;
it is never executed. Keep the resident DOS entry in its MZ header, then create
an ordinary far C function at1c17:0000 with one16-bit variant argument. This avoids
Ghidra treating the cave as startup and flattening its stack into globals.
Disassembly resolves missing register returns, including column/row helpers
2390/23b1. Originals remain unchanged.

Next: all terminal animations and campaign results; original input-boundary
comparisons for room changes, lamp and pursuit.
