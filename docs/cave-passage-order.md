# Cave passage state ordering

The port now commits the destination room,entry flag and incoming direction
before exit animation. The torch remains unchanged during exit and advances
when the next room begins. Public phase remains `entering` throughout this busy
passage,so room changes do not falsely advertise a ready input reader.

The original [cave reference](cave-native-cadence.md) identified this mismatch.
Its302-byte/106-instruction proof checks Ghidra alias1ce1:02b1..03de against
the actual original overlay after relocation. Right increments DS4d32 at02f6,
sets DS8eb2 at02fa,loads the transition resource at0325,and calls exit at03d4.
The former JavaScript placed the room/entry writes after that animation.
The original Main decompilation has the same order for the other directions.

```sh
node scripts/verify-cave-passage-order.js
node scripts/verify-cave.js
./node_modules/.bin/playwright test tests/browser/cave-input.spec.js --output=.local/cave-passage-order-browser-FRESH
npm test
npm run build
```

The focused checker traverses Right,Down,Left,Up and revisits the starting room.
At each room commit it requires the new entry flag,unchanged torch/cash and busy
phase;it renders every presentation and checks final cash150/torch5. It then
loads the former Cave class from85bc2f3 under byte-identical dependencies and
requires rejection at the torch/order boundary. It cannot silently accept a
changed negative dependency. The native checker is a prerequisite.

The broader cave checker passes conditional native entry/runtime/RNG/pixel
checks,all four passage directions,shortened-path outcomes,carried input replays
and its negatives. Its old application harness supplied only280 ticks for a
rival report that now also needs stripe/retrace work. The harness now supplies
both clocks and requires completion within2000 steps;no report runtime changed.
The existing browser cave scenario passes actual controls,rendering,Pause/Quit
cancellation,unread-key flushing and Restart. Its screenshot now goes into the
run's own output directory. All218 unit cases and the production build pass.

This is a scoped ordering correction. It does not solve cave elapsed timing.
The strict native probe still exits1:the port's room/torch changes are separated
now,but resource loading and other stage boundaries remain different. The port
still awards50 at3666.923ms while the original has0 through the6.834s window.
No fitted delay or global speed multiplier is added. Fresh full-campaign browser
acceptance now passes:producer `.local/cave-order-winning-browser-01` and
independent consumer `.local/cave-order-winning-replay-01` match183 complete
state/image checkpoints and7261 independently recorded DOM events through day31
victory,all26 credits,closed and Restart. All seven award transitions pass105
exact stripe groups;the combined gate also passes ending/credits/bank evidence,
one omitted-input negative,three setup negatives,218 units and build. The previous
winning capture remains immutable historical evidence. Native whole-game timing
remains open.
