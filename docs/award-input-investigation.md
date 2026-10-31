# Award dialogue input investigation

The treasure-award dialogue is the next legacy reader gap after the guide fix.
Original resident C48..C69 pushes40 and calls shared09f5. A nonzero return and
enabled-audio byte3be then request click24. The existing award path still uses
the legacy countdown/immediate global-key routing, and its completion integration
has no corresponding conditional click request. These are targeted next changes,
not fixes already made.

The [manifest](../reference/award-input-investigation.json) pins34 original caller
bytes,88 shared-reader bytes, the recorded Ghidra bytes and a browser observation.
The34 Ghidra bytes match the original after exactly one declared loader relocation
by0x1000; no other edits are accepted. This is actual resident game code, not the
packed executable's loader stub. The supported executable/resources remain the
22-file pairing in build.json.

Normal browser play earns the Too-Pei cave7 treasure. At time84717/tick6170 the
award has $3,400 carried cash, value3000 and remaining280. Fresh P opens Pause by
time84733/tick6171 while remaining279, before the next seven-tick read boundary.
No memory/RNG/ownership injection is used, and Restart succeeds. The captured
source is the unchanged runtime/helper archive from the separate guide recording;
it was not a new archive made at award-probe launch.

This is observed port behavior combined with static original rules. Native award
input/reveal timing is not captured here. The browser was muted, so click24's
conditional call is statically inferred, not an acoustic comparison. Its ordering
against later scene/audio effects needs investigation before implementation.
Failure portraits and the longer atomic explanation are separate paths; do not
assume their rules from this40-read case.

```sh
node scripts/verify-award-input-investigation.js
```

The next implementation should preserve rewards, day changes, collection and
unlock ordering, while routing fresh controls through the original40-read wait.
Only a Fire actually consumed at a read may request click24. A make in the final
neutral wait must not invent an extra read or click. Preserve historical expected
outputs and investigate the first divergence in a new current-consumer run.
