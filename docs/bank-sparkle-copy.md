# Bank sparkle at a signed screen coordinate

The actual current browser candidate completed Novay with3 lives and banked34650,
then stopped with `Invalid framebuffer copy` on the final day31 bank visit.
`.local/report-timed-winning-browser-02` is a failed candidate,not acceptance.
Its source was checked unchanged after the process terminated. The valid148-
checkpoint/7243-input prefix ends at `novay-mountain-map`;the later error is not
accepted by changing its expected diagnostic or image.

Re-executing the independent startup inputs reconstructs the failing command:
source/destination X248,Y-13,width32,height18;player tier3,rival tier2,pose1,
balance34650/28500,RNG40203 after38 draws. No checkpoint memory is restored.
Original bank1c17:0c1d..0cbc passes identical signed Y to both sides of this copy
and clamps only negative X. Original/prepared/Ghidra160 bytes and loader
relocations are pinned in `reference/bank-sparkle-copy-source.json`.

The generic rasterizer required nonnegative source coordinates and rejected this
valid original call. The correction is limited to MAC's identical-coordinate,
aligned32x18 sparkle restore. It projects the original planar byte writes onto
the current visible page. The original driver's unsigned wrapped Y+height test,
signed JG,DL row count and16-bit row addresses are retained. For example,Y-13
restores visible rows0..4;Y-18 writes no visible rows,butY-19 wraps the clipping
calculation and restores through row199. Ordinary rectangle clipping would lose
that quirk. Other restore contracts keep their strict bounds.

The driver rules reuse the16 native instruction/OUT/REP comparisons in
`reference/ega-signed-copy-work.json`,including negative coordinates. The visible projection was initially statically inferred. A separate conditional
native experiment now checks six complete320x200 RGBA outputs of the original
IT.DRV routine using authored four-plane RAM patterns and real EGA output:
Y-13,-19,-18,195,normalY0 and an X312 scanline carry. All pixels match exactly;
eight negative controls reject altered/missing data and unfinished/stale calls.
This is original primitive pixel evidence,not natural bank screenshots or timing.
Writes outside the visible page and possible hidden EGA-page/heap aliasing remain
outside this semantic framebuffer model and are unverified.
No bank RNG,input,money,day,audio or simulation timing is changed by this fix.

The browser player also needs to await the root reached after its Back action.
The simulation pilot advanced100ms after a click;the real browser could still
be in office-departure when it checked for the deadline bank. The corrected
player waits for the actual office/bank/ending or report boundary and supplies
fresh bank Fire. The final bank deliberately executes24 neutral reads before
Fire to exercise the observed sparkle path. This is a recorded player wait,
not an injected timer or state. These are automation corrections,not game-rule
changes.

```sh
node --test tests/bank-sparkle-copy.test.js
node scripts/verify-bank-sparkle-copy-source.js
node scripts/verify-bank-copy-pixels.js
node scripts/verify-bank.js
npm test
npm run build
# Clean source,new ignored output;all148 prefix states/images must match:
node scripts/standard-wages-explore.js --winning --prefix=reference/report-timed-novay-prefix.json --output=.local/report-timed-winning-next-FRESH
```

Eight focused cases,all218 unit cases,the existing original-bank comparisons and
production build pass before the new browser continuation. Browser acceptance
and a separate strict full winning replay remain required. Original assets and
captures remain ignored;no proprietary dump is committed.

## Native reproduction

[Native manifest](../reference/bank-copy-pixels.json) pins capture6115a7c,
`.local/bank-copy-pixels-native-02`,original identities,the actual consumed
argument stacks,RAM source bytes,frame alignment,private configuration and
terminal lifecycle. The recipe uses a copied emulator binary with a portable
primary configuration;it does not override HOME or change the shared bridge.
Only its generated PARK.COM directory is mounted,read-only. The original game
is not launched;unchanged original driver code is called directly in real mode.

```sh
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp /path/to/dosbox-mcp/.venv/bin/python scripts/capture-bank-copy-pixels.py --output=.local/bank-copy-native-FRESH --port=8403
node scripts/verify-bank-copy-pixels.js
```

Use a fresh output and unused private port;8386 is refused. The stable owned
PARK guest loop is verified before any CPU setup. Each case sets mode0d and its
caller inputs,then records the original far return with restored SP. Capture
waits for a changed,current EGA raw frame and a stable hash across two frame
observations. No expected final pixels are supplied to the emulator. These are
conditional routine setups,not restored complete machines or original gameplay.

Earlier probes remain unaccepted:01 stopped on generated Python cache before
launch;02 used an incorrect GET frame wait and closed on404;03 captured a stale
text-mode frame;04 passed only the observed single case. Native01 failed its
stack assertion from an interrupted ROM stop;its cause is unproven. The stronger
owned-loop entry plus recorded argument boundary succeeds for all six cases in
native02. Every launched private instance is confirmed terminal. The shared
DTRACK emulator was never changed. No emulator or graphics decoder was built as
a prerequisite,and no proprietary binaries,traces or screenshots are tracked.
