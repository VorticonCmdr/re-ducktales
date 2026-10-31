# Novay control candidate after report restoration

This is player-route research,not a game-rule change or accepted campaign.
The isolated source is based on ae9b935. The main fresh Standard browser capture
continues separately with its source fixed.

The previous Novay candidate landed but its494 authored climbing reads failed.
A bounded original-resource mountain experiment reproduces the failure under
explicit conditional initialization:variant1,Standard,day26,cash23150,constructor
seed27138,fresh original memory,zero-filled locals and clock origin0. These
constructor parameters depend on the earlier candidate's observed entry;this is
not an independent whole-game replay or complete machine checkpoint.

The first adverse action transition is at read100:row9,type4 arrow advances from
X271 to255 while the player is in column15,and action7 becomes8. Life drops at
read112. The retained visible-hazard observations match the translated arrow
collision branch in `mountain-hazards.js`. This is a port-model observation;
no new native DOS comparison or original timing claim is made.

The candidate inserts16 neutral action reads before authored read57,then consumes
all494 existing controls. This510-read route completes with3 lives,cash23250 and
seed15930 in the conditional scene. Waits24/32 also complete;wait8 still fails.
The strict success check passes for16 and rejects8 with the expected diagnostic.
No seed,memory,difficulty,physics or game clock is patched to make it finish.
The waiting inputs are player controls,not fitted hardware timer values.

[Versioned investigation manifest](../reference/novay-player-investigation.json)
pins original identity,conditional environment,initial-state dependency,all case
artifacts/source archives and the failed negative. Original assets and generated
observations remain ignored. The candidate controls are in
[novay-player-inputs.json](../reference/novay-player-inputs.json).

```sh
# Clean committed investigation source and fresh ignored output:
node scripts/diagnose-novay-controls.js --conditional --wait-count=16 --expect=success --output=.local/novay-controls-FRESH
# Deliberate negative;must return nonzero:
node scripts/diagnose-novay-controls.js --conditional --wait-count=8 --expect=success --output=.local/novay-negative-FRESH
```

Next:execute startup inputs through the current Siberia award with carried game
state,then test Novay and banking without checkpoint restores. Only after that
candidate works in the actual browser and a separate strict DOM replay can it
support current full-winning-campaign acceptance. `--winning --bonus-novay`
selects the candidate route;the default route is unchanged. A valid prefix at
`cave-21-award-ready` may avoid re-exploring earlier controls,but is always
replayed from a fresh title and compared in full before continuing.

The fresh main browser producer `.local/report-timed-winning-browser-01`
completed six treasures and banked27050,but its default strategy lost normally
on day31. Its133 observations include that rejected tail. The new prefix pins
only126 exact complete-state/decoded-image checkpoints and6503 inputs through
`cave-21-award-ready`. No failed tail is promoted to acceptance.

The carried simulation `.local/report-timed-novay-plan-01` at e796637 re-executed
all126 prefix states from startup,then flew to Novay and completed all510 climbing
reads with3 lives. It banked34650,beat the rival's28500 on day31,selected replay-No,
ran all26 credits and reached closed. Its758 candidate inputs and54 observations
are pinned in [the plan manifest](../reference/report-timed-novay-plan.json).
This is closed-loop port simulation evidence;actual browser and independent
browser replay remain required.

```sh
node scripts/standard-wages-explore.js --winning --bonus-novay --prefix=reference/report-timed-siberia-prefix.json --output=.local/report-timed-winning-next-FRESH
```
