# Security-aware Easy mountain summit

The original 764-sample El Capitan controls now work through the first-map
security challenge and its carried random state. No game state, seeds or timer
values are injected. Historical `reference/mountain-ascent.json` remains unchanged.

The browser starts from BIOS seed0, skips the opening, selects Easy, answers the
security challenge with Right/Fire and makes two ordinary bank trips. It departs
for El Capitan, crashes, pays the repair delay and enters the mountain on day16
with seed5159. The controls reach row24, collect100 dollars and earn the8000-dollar
summit reward. Return passes a rival report, and revisiting passes a second report
and the player-collected notice without awarding the treasure again. Restart
returns to the title.

The capture controller and an independent timestamped DOM replay match27 complete
application snapshots and27 exact320×200 decoded-pixel hashes. The separate Game
replay consumes all104 recorded events from startup, checks all27 snapshots and
74 flight presentations, and ends with no held keys or pending required events.
Final state: day17, money8100, playerCollected[31], three lives,764 mountain input
samples,870 presentations and mountain seed62669. These are port regression and
browser evidence; native whole-level timing parity is not established.

The first missing mountain Right make is detected at input480. The strict checker
also rejects changed expected state, omitted checkpoints, wrong security input,
changed pixels and omitted browser checkpoints. Missing or corrupt local evidence
is a setup failure. Raw capture has completed=false and deliberately throws after
saving; it is never accepted as a green test.

Original binaries and decoded pictures stay in ignored local storage. The public
manifest `reference/security-mountain-ascent.json` pins fixture checksums, the
capture and browser producer commits, input provenance and current checker hashes.
The capture procedure is the actual browser test:

```
DUCKTALES_CAPTURE_MOUNTAIN_ASCENT=.local/security-mountain-ascent-new npx playwright test tests/browser/mountain-ascent.spec.js
```

It is exploratory and exits nonzero after recording. New captures require review
and independent replay; do not replace accepted fixtures automatically.

Verification:

```
npm run verify:security-mountain-ascent
```

This checks retained evidence, reruns both browser modes and requires the missing
movement negative to fail for the expected state mismatch. The complete game and
full branch integration remain unfinished; see [current status](STATUS.md).
