# Current consumer after the atomic input fix

Source `e8320ce` passed every required check below. The [registered manifest](../reference/atomic-input-regression.json)
pins the consumer archive, result, logs and local outputs. The three receipt
negative controls also passed. The separately accepted earned-transmitter route
adds18 browser checkpoints/486 events and an omitted-selection negative.

The atomic charge/report fix changes actual runtime source. Earlier scenario
recordings must remain independent expected outputs; recapturing all expected
outputs from the changed game would erase their value as regressions.

`scripts/verify-preserved-routes.js` therefore validates each historical producer's
Git archive, complete file inventory and original build pairing, then archives a
separate clean current consumer. It replays the historical input streams and
compares their existing full snapshots and image hashes. Producer and consumer
runtime source need not be identical. The consumer's loaded source must remain
unchanged during execution. Every protected historical artifact is rehashed at
completion. Diagnostic output is written into the fresh consumer directory.

Required scope is fixed: eight cave component cases/2,696 presentations; the full
headless campaign with34 checkpoints,4,981 events and1,470 flight presentations;
and12 actual-browser cases with272 exact full-state/image checkpoints and10,117
DOM events. Browser cases are the full winning Easy campaign, Carlsbad, two
alternate mountains, two alternate jungles and all six Safari variants. Every
browser case must Restart. Missing/corrupt fixtures, zero cases, unfinished input
streams, unsupported behavior or mismatched state/pixels fail the command.
No expected outputs are fitted or regenerated, and comparison has no exclusions.

This is current-port regression against earlier accepted port behavior under
explicit clock/input providers. It does not prove native whole-game speed,
arbitrary campaign finishability, Hard campaigns or physical audio parity. The
original atomic source/conditional segment evidence and newly earned transmitter
browser acceptance are separate evidence levels; see [atomic input](atomic-input.md).
The old individual omitted-input controls remain historical; this runner repeats
positive routes, not all those negative executions.

```sh
# Fresh execution; requires clean committed source and ignored local fixtures:
node scripts/verify-preserved-routes.js --output=.local/preserved-routes-FRESH
# Recheck the registered saved result and unchanged current loaded source:
node scripts/verify-atomic-input-regression.js
# Negative controls operate on temporary consumer receipts only:
node scripts/atomic-input-regression-negatives.js --output=.local/receipt-negative-FRESH
```

The receipt checks require all12 cases, all272 checkpoints and all10,117 browser
inputs. Three negative controls separately remove all browser cases, leave one
headless input unconsumed and corrupt the consumer result bytes. They must be
rejected. These receipt controls supplement actual browser/input comparisons;
they do not execute a second browser acceptance.
