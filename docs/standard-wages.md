# Standard Wages campaign route

The original difficulty1 now has a continuous browser regression through day31.
Startup selects Standard Wages with an actual Down/Enter sequence. The player
flies to Too-Pei,completes its cave,earns $3,400 including coins,unlocks the
transmitter,reads rival reports and deposits the money. A three-day flight to
Yellerstone loses its race. Reading the rival claim returns normally to the map
at that destination. A new flight reaches Kenya,the photographer captures the
target animal,and the $500 proceeds are banked. The route ends on the map with
$3,900 banked. This day13 prefix remains separately accepted.

The current route continues to Great Outback jungle layout2 and Lost World
mountain layout0,completing both with all three lives. Deposits total$10,250.
Normal bank/office travel advances the calendar to day31;the rival has$36,000
banked,so the original winner comparison produces the defeat cover. Restart
clears the campaign. This verifies one full playthrough through all four families,
not a winning Standard strategy,every Standard layout,credits or native parity.
Hard remains deferred. No gameplay rules changed for this milestone.

The full route was rerun after the repair-reader change at`cabc06c`:85 exact
state/image checkpoints and5,071 unchanged events passed in a fresh browser,plus
Restart and the missing-selection negative. The latest saved acceptance is
[repair input acceptance](../reference/repair-input-acceptance.json). Historical
receipts below retain their original scope and runtime guards.

## Reproduce and verify

Use the22 original files declared in `reference/build.json`. Missing or changed
files fail setup. No additional edition or resource pairing is accepted.

```sh
# Validate saved browser evidence against the current game runtime:
node scripts/verify-repair-input-acceptance.js
# Check rejection of empty,missing and corrupt fixtures:
node scripts/verify-standard-wages-route.js --manifest=reference/standard-wages-full-route.json --setup-negatives
node scripts/verify-standard-wages-setup-negative.js
# Fresh browser replay and a semantic input-omission negative:
node scripts/verify-standard-wages-route.js --manifest=reference/rival-standard-route.json --output=.local/standard-full-replay-FRESH
node scripts/verify-standard-wages-route.js --output=.local/standard-replay-FRESH
# Produce a new exploratory recording;this never certifies itself:
node scripts/standard-wages-explore.js --safari --output=.local/standard-capture-FRESH
# Full campaign browser exploration from the pinned independent player plan:
node scripts/standard-wages-campaign.js --plan=.local/standard-wages-actions-plan-04 --output=.local/standard-full-capture-FRESH
```

Fresh capture/replay requires clean committed source and a new ignored output
directory. Each owns one Chromium instance and one temporary Vite server on an
automatically assigned port;both close on success or failure. Existing user
servers and shared DOSBox sessions are untouched. Originals,recordings and PNGs
stay local and ignored.

## Evidence and limits

After the cave failure-reader fix,the same85 immutable checkpoints and5,071
events pass again under the current runtime in
[current acceptance](../reference/cave-failure-input-acceptance.json),consumer
`.local/cave-failure-standard-replay-01` at`aef87cb`. No expected states,images or
inputs were changed. The earlier Standard saved-receipt commands are
historical and their source guards reject this runtime change;use the current
failure-acceptance command above or a fresh Standard replay.

The [full scenario](../reference/standard-wages-full-route.json) pins85 checkpoints
and5,071 required DOM events. Its [saved acceptance](../reference/standard-wages-full-acceptance.json)
records a separate fresh browser consumer,exact complete state/RGBA comparisons,
Restart,a semantic missing-selection negative and three setup negatives.
Producer:`4a66248`;consumer:`577dd13`;setup negatives:`d4e8b80`.

The [player plan](../reference/standard-wages-campaign-plan.json) was explored by
carrying the existing browser input stream from startup in the simulation;no
checkpoint memory was restored. Its explicit100ms diagnostic tail is an external
neutral delay. Existing authored jungle/mountain controls are only player recipes;
using a recipe discovered on another difficulty never changes game difficulty.
The first Easy mountain recipe failed Standard. Another existing recipe completed
it. The browser then independently executed the complete schedule and matched all
85 planned states;its actual images became immutable port-regression expectations
for a second browser. Expected outputs never choose replay inputs. A failed
player recipe or a natural losing campaign is not by itself a port defect.

The full route ends at the ready defeat cover;it does not exercise the subsequent
celebration/replay/credits controls. Those remain separate ending scenarios.

The earlier day13 prefix is retained unchanged:

[Scenario manifest](../reference/standard-wages-route.json) pins the original build,
producer revision,starting recipe,environment,independent DOM input stream,
36 expected checkpoints,artifact checksums and comparison rules.
[Saved acceptance](../reference/standard-wages-acceptance.json) pins the separate
consumer and its result. Producer:`4cf9890`;consumer:`eb0fad2`.

The fresh browser consumes all3,177 required events from startup,compares complete
state and decoded320×200 RGBA hashes exactly at every checkpoint,and exercises
Restart. No checkpoint is skipped,no expected output supplies an input,and no
state/seed/actor memory is injected or restored. The negative removes the first
Down make and must fail the state comparison at `standard-choice`,rather than
merely failing an event count. Empty checkpoint,missing fixture and corrupt hash
controls must also fail.

The environment explicitly supplies BIOS seed0,UTC startup,muted audio and an
8ms display schedule from clock origin1. The explorer observes present game state
to choose player controls;the consumer never runs that policy. The capture remains
marked exploratory and is accepted only by the separate replay. This is a port
regression,not new original DOS runtime evidence or native timing/audio parity.
All earlier runtime/source caveats in the status document remain applicable.

A separate simulation diagnostic also matches all36 state checkpoints and renders
2,568 flight presentations without errors. Its declared100ms endpoint tail is
exploratory;it is not part of browser acceptance. The initial stopped race-loss
recording remains preserved in
[exploration evidence](../reference/standard-wages-exploration.json).
