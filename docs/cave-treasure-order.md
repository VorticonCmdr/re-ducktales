# Original cave treasure presentation

The treasure sequence now wipes the incoming page,loads background0,and composes
the room twice. The first presentation uses the original striped reveal;the
second flips normally. Three further frames and ten celebration frames restore
the room cache instead of composing/reloading its light sprite. Previously the
port composed15 times and omitted the opening wipe/background load.

The original also performs an explicit caller cache copy before each3/10-loop
party draw,even though party20b8 restores the cache again. Those13 redundant
source copies are retained and charged by the verified signed copy primitive.
They are not optimized away or replaced by an observed delay. Total source
structure is2 compositions,1 wipe/background load,13 caller copies,15 party/
presentation calls and64 requested retraces. Retraces during CPU work are
separate from that requested-wait count.

[Source declaration](../reference/cave-treasure-order.json) pins371 original bytes/
144 contiguous instructions from Main16b4..1827,checked against the same original
overlay as the natural cave reference. Composition calls1715/1748 precede the
3/10-frame loops;wipe16fb,background1706 and loop copies178f/17f4 are explicit.
Two source negatives reject changed calls and incomplete instructions.

The carried shortened route exercises the actual treasure method and renders
every publication. Its counters require the complete source sequence. Replacing
only the treasure method with the pinned9f3d165 version fails that comparison;
all other dependencies stay current. This is conditional component evidence,not
an original-machine ending or elapsed-time comparison. Gameplay RNG still uses
15 party calls;no time fitting or game-state patch is added to normal play.

The full Standard candidate on source9f3d165 completed victory34650 to28500,
183 checkpoints/7261 inputs,all26 credits and Restart,with three lives at jungle
and both mountain awards. It remains historical and unaccepted because this
treasure presentation defect was identified before independent replay. Its
captured artifacts stay unchanged;the restored successor needs a fresh producer
and independent replay.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_treasure_source.py
node scripts/verify-cave-treasure-order.js
node scripts/verify-cave-counted-loading.js --output=.local/cave-treasure-order-FRESH
```

The combined gate passed15 checks on source904519a. Its
[receipt](../reference/cave-treasure-order-admission.json) pins the source archive,
119 runtime/configuration files,all logs and five actual treasure reveal images,including the actual browser complete
cave route (failure/retry/treasure/map),input case,loading-only negative,221 units
and build. Its browser helper waits for staged initialization before checking the
first room. Original full treasure timing,loader/system costs,broader campaign
coverage and deferred Hard campaigns remain open.


Earlier browser attempts are excluded:01 read the room before initialization;
02/03 exhausted the old180-second host watchdog during normal progress through
the failure/retry route. 04 reached treasure and all five reveal groups,but checked reward cash before
the source-ordered award commit. The fixture now waits for the actual award
presentation to finish before checking cash and acknowledging it. It allows420 host seconds while retaining
the8ms injected display cadence,all simulation waits,input schedule and bounded
state conditions. Its capture is scoped to phase=treasure/kind=reveal and reads
actual intrinsic canvas PNGs;ordinary room wipes/reveals cannot satisfy the five
required treasure groups. The prior fixture's broad band predicate was invalid.
