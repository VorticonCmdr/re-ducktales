# Security-aware Easy winning campaign

The current Easy browser route starts from the supported originals, skips the
opening, confirms Easy, leaves the office and completes the original security
challenge. It visits all four expedition families, collects their rewards,
handles rivals and banking, reaches the deadline and wins. Restart returns to
the title with cleared money, deposits, ownership and expedition actors.

The route uses the original destinations Okeefadokie, photography at logical46,56,
the cave at37,33 and El Capitan. Its observed balances are:

| Checkpoint | Day | Wallet | Banked |
|---|---:|---:|---:|
| Jungle reward/return |3 |1050 |0 |
| First deposit |6 |0 |1050 |
| Photography return |12 |1000 |1050 |
| Cave return after flight crash/repairs |16 |5400 |1050 |
| Mountain return after flight crash/repairs |20 |12825 |1050 |
| Second deposit |23 |0 |13875 |
| Winning ending |32 |0 |13875 |

The rival finishes with11500. Player claims are[1,30,31,32], rival claims[2,3,4,5,6,7],
and the family unlock mask is15. The jungle ends with one life; the mountain ends
with three. Both crashes and their natural repair losses remain in the route.
No outcome, money, clock result, random seed, allocator state or machine memory
is supplied from the expected ending.

The first race wins in266 physics frames/364 presentations and enters the jungle
with seed55524. That entry independently matches928 DOM events and a complete
snapshot. The old857-sample jungle stream does not survive this enemy sequence.
Bounded carried planning tried neutral waits before the unchanged stream;60 and69
samples completed it. The selected route adds60 authored neutral samples, giving
917 jungle samples. The model preserves the actual external observation time and
replays from application startup for every candidate. It never restores memory.
This is player-route planning from the port, not native keyboard/IRQ evidence.

The browser validates the selected controls and carries their actual state through
photography, the cave and the764-sample original mountain ascent. Independent Game
replay and independent timestamped DOM browser replay match all36 complete state
snapshots and36 exact decoded320×200 RGBA hashes, consuming all3516 events and1188
flight presentations. Keys are released, required events are consumed, and there
is no replay tail. The independent browser also tests restart after the win.

The captured ending PNG is a958×599 CSS-sized diagnostic screenshot. Its byte
identity and dimensions are checked separately. Logical pixel comparisons use
the actual320×200 canvas at every checkpoint, without rescaling or tolerance.
The raw capture declares completed=false and deliberately fails after saving;
it does not count as independent acceptance.

Omitting the Easy confirmation is rejected at the first campaign checkpoint.
Omitting the first jungle Right make after its entry is rejected by exact state
or required external-event comparison at a jungle input checkpoint. Changed
expected state, omitted checkpoints, changed expected pixels and missing browser
checkpoints are also rejected. Missing/corrupt fixtures fail explicitly, and their
original bytes must be restored before another positive verification passes.

`reference/easy-campaign-security.json` pins the supported22-file build, source
producers, private fixture checksums, current checker identities and comparison
rules. Producers are480d938 (first entry),1de383b (full exploratory capture) and
75ff79a (independent browser replay). Original pre-security Easy inputs, expected
results and historical winning route remain unchanged.

These are closed-loop port regression and independent browser acceptance. No
whole-original campaign/CPU/IRQ/audio timing comparison is claimed. Original
routine and asset evidence remains scoped to its existing manifests. The complete
port still has the limitations listed in [current status](STATUS.md).

Reproduction:

```
DUCKTALES_CAPTURE_EASY_CAMPAIGN=1 npx playwright test tests/browser/mixed-campaign.spec.js --output=.local/security-easy-campaign-new
```

This is exploratory and exits nonzero after saving. New recordings require review
and independent replay before acceptance. Originals, decoded pictures and traces
stay in ignored local storage; missing local artifacts are explicit setup failures.

```
npm run verify:easy-security-campaign
npm run test:easy-security-campaign
node scripts/verify-easy-campaign-browser-negative.js
```

The first command validates retained browser/source receipts, replays the current
Game strictly and requires missing/corrupt fixture rejection and restoration.
The second runs the complete browser scenario and restart. The last reruns both
actual input omissions. The required full integration gate remains `npm run verify`.
