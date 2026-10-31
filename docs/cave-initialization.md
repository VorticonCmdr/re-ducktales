# Staged initial cave loading

Initial cave loading now advances through the original resource boundaries:
clear the map,load its selected CAVEMAPS byte resource,parse/copy the map,load16
EXP sprites (plus four optional A/B-drive sprites),perform minimap work,then
select the start/goal/enemy and continue to Sound0/wipe/input flush. Descriptor
headers initialize before payload waits;caller coordinates commit afterward.
Previously all initialization mutations happened synchronously in the constructor.

Raw `mapEntries` are an explicit resource input alongside parsed `maps`. Their
tables must agree;missing raw data or a mismatched map stops with a diagnostic.
Original bytes remain authoritative and are never recompressed. The constructor
may expose an unfinished map/descriptor state while busy;there are no gameplay
input reads or first-room publications during these stages.

The LZW byte path uses STOSB directly. Clear/literal setup has the same opcode
count as graphics output,but subsequent strings use three POP/STOSB/LOOP
instructions per byte and omit the graphics loop's final jump. There is no
dispatch/color/opacity conversion cost for map text. All eight original maps
pass an independent whole-string dictionary/count oracle. Together with the
46 sprites and picture,this is55 resources and14 negative controls.
[Work declaration](../reference/cave-initialization-work-source.json) preserves
the earlier graphics-only declaration as its unchanged parent.

[Initialization source](../reference/cave-initialization-source.json) pins1086
original bytes/350 contiguous instructions from Main000b..0449,excluding the
analysis-patched stack prologue. It checks the map call,16/20 sprite sequence,
optional-drive guard,post-load coordinates,minimap call before enemy RNG,and two
negative controls. The old listing had a two-byte gap near00a4 and is excluded;
the repaired listing is exact. [Tool limitation](ghidra-disassembly-coverage.md).

Sixteen carried component segments cover all eight maps on C and A/B paths.
They require the complete17/21-load sequence,zero input reads,exact map/endpoints/
initial enemy RNG and correct initial coordinates before the first wipe. Missing
raw resources and mismatched map tables reject. A focused unit checks that
sprite17's coordinates remain zero during its load and enemy RNG remains
unchanged until minimap completion. All221 unit cases currently pass.

The accounted initial load/minimap subtotal is about1.214s for C and2.367s for
A/B at the declared normal-core3000 provider. These are source-work outputs,
not fitted values or native timing acceptance. Text-parser CPU work,archive
lookup/header/seek/allocation/caller code,DOS execution/budget clamping,device
execution and original CPU phase remain omitted. A native whole-initialization
timing comparison is still required. The retained passage probe still fails on
elapsed time/final animation state,while its four phase states remain exact.

```sh
node scripts/verify-sprite-load-work.js
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_initialization_source.py
node scripts/verify-cave-initialization.js
node scripts/verify-cave-counted-loading.js --output=.local/cave-initialization-FRESH
```

The combined gate now requires12 checks,including221 units,the actual browser
room17→18 control route and a loading-only negative. Browser observations identify
resources by archive and index,so a map0 load cannot substitute for background0.
Earlier source-pinned receipts remain historical. Next:refresh the complete
Standard winning browser campaign and independent replay before further residual
timing work. Hard campaigns remain deferred.


The source-pinned initialization-admission01 passes all12 checks at commit
b80cc118ef74129560a8ac3a6bd6ab215bdc3e87. [Receipt](../reference/cave-initialization-admission.json)
pins113 runtime files,source archive,logs and completed status. Browser loading
observations and loading-only negative pass;all221 units execute without skips.
The campaign player's first-cave planner now waits for the actual exploring
boundary before reading endpoints,matching the staged application startup.
