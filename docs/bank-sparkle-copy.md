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
`reference/ega-signed-copy-work.json`,including negative coordinates. New visible
pixels are statically inferred and component-checked;they are not new native
screenshots. Writes outside the visible page and possible hidden EGA-page/heap
aliasing remain outside this semantic framebuffer model and are unverified.
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
