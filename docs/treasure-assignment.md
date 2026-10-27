# Original treasure assignment

Build: `reference/build.json`. Main115a:0314 (resident image18b4–1a30) resolves
one-based LOOT.ARC IDs before campaign play. The fourth LOC.ARC number is an ID,
not cash; zero requests random assignment.

`assignLoot` copies ordered locations. Each zero in slots1–34 consumes one RNG
draw, starting at seed%37+1. All fixed IDs are reserved, including later slots.
Rejected candidates increment while candidate+1<37, otherwise wrap to1. Thus
probing skips37 although an initial draw can select37. Fixed IDs consume no RNG.
ID9 records the special transport's location. Resource=ID-1; its signed16 value
comes from LOOT.ARC. No original record is overwritten.

Browser seed0 consumes30 company draws,then two location and twenty loot draws,
ending at45111. Easy day-one market processing reaches1960. First Klondike
departure uses54448,variant0 and race roll48: Standard/Hard race,Easy does not.
This supersedes earlier incomplete startup streams; see `docs/investments.md`.
The old screenshot is retained as an explicitly conditional rendering comparison
using captured departure seed41725, separate from the independent browser route.

`npm run verify:loot` requires the local before/after artifacts pinned in
`reference/loot-initialization.json`. Fresh-launch stops are01f5:18b4 and1a30;
actual aliases034f:0314/0490 match those physical addresses. DS/SS1403, real mode
and original code bytes are checked. Inputs come only from the BEFORE artifact.
All34 IDs/resources/signed values, final RNG and ID9 location match exactly.
Omitted-RNG, altered-ID and missing-checkpoint negative controls must fail.
This is one conditional whole-routine comparison, not a fitted campaign replay.

The restart handshake briefly cached the old engine identity. `bridge_connect`
refreshed it; new PID59942 and instance0719a1b0cdcede0b85c39577ff760639 were
confirmed through status/info. New debugger stop IDs2/3 and original signatures
also establish the capture's identity. The pending startup input schedule was
cancelled afterward. A focused bridge correction would make `bridge_start` wait
for the probed engine PID to match the spawned PID before reporting connected.

[Normal Glomgold progression](rival.md) now consumes the shared RNG at root action
boundaries. Other untranslated campaign code also consumes RNG; this closes treasure
initialization, not complete campaign RNG parity.
