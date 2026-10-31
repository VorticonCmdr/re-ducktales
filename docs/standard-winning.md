# Winning Standard campaign investigation

The whole game remains incomplete;Hard campaigns are deferred. This investigation
extends the existing four-family Standard route instead of changing the difficulty,
RNG,rival,loot,physics or calendar. The supported original22-file pairing remains
`reference/build.json`. Runtime is unchanged from the repair milestone `cabc06c`.

## Player strategy and evidence level

`reference/standard-winning-plan.json` pins a successful **conditional simulation
plan**,not browser acceptance or an original-game campaign replay. It replays the
immutable DOM stream from startup through `continued-mountain-return` in
`reference/rival-standard-route.json`. That reaches day18,cash6350,banked3900 after
Too-Pei cave,Kenya Safari,Great Outback jungle and Lost World mountain. It then
collects Atlantis,Klondike and Siberian cave treasures,visits the bank and completes
normal office/bank travel. The simulated winner has banked24275 against rival21000
on day33. The deadline check follows the original caller after whole travel-day
increments;this route crosses day30 during a three-day journey.

The first additional flight crashes and naturally loses cash. Cave navigation
uses currently observed room/goal/enemy positions and original wall/pit geometry.
The player prefers a shortest path excluding the enemy and adjacent rooms. Where
that conservative buffer disconnects a corridor,it excludes the enemy's room
itself. It recomputes after each move;it never changes the live map,enemy or RNG.
The strict consumer will replay only the independently recorded controls,never
this navigation policy or expected outputs.

Failed experiments are retained separately: plan01 used the wrong entry-scene
assertion;plan02's naive shortest path was captured by the enemy;plan03's overly
conservative player buffer could not find a route. None is a proven port defect
or an accepted campaign. Plan04 succeeds without state restoration or game-code
changes. All outputs remain ignored local artifacts.

The through-mode replay ends exactly at the captured observation. The first new
input uses that same timestamp,ordered after the observation by event count.
There is no added100ms tail on this path. The frozen plan inherited a generic
tail description;the versioned manifest explicitly corrects that description
using the source and actual event timestamps,without changing any input or state.

## Actual browser route

`scripts/capture-standard-winning.js` independently runs startup and the entire
player schedule. It requires every planned complete state to match and every
retained prefix image to remain exact. It then explores the winning celebration,
replay-No selection,all26 credit names,farewell,closed screen and Restart through
real keyboard controls. It saves separate actual DOM inputs,complete public
states and decoded image hashes. Each checkpoint has a unique identity;no earlier
screenshot can be overwritten by a later visit to the same room.

The first capture attempt stopped at a same-timestamp setup assertion before
opening a browser. A second run was deliberately stopped after discovering three
duplicate screenshot identities. Neither is acceptance. The corrected capture
`.local/standard-winning-browser-03` completed170 checkpoints/6575 DOM events at
`e4f857a`. Actual browser controls reached banked24275 against21000 on day33,the
winning cover/celebration,replay-No,all26 credits,the closed screen and Restart.
Every planned state and retained prefix image matched. This capture remains
marked accepted:false. Its separate strict consumer at`e600150` passed all170
complete state/decoded-image checkpoints,6575 required events,Restart and a
missing-Standard-selection negative. Three empty/missing/corrupt setup controls
also pass. `reference/standard-winning-route.json` pins the immutable scenario;
`reference/standard-winning-acceptance.json` pins the separate consumer receipt.
That milestone's saved command is now historical after the sound-toggle change.
A new unchanged170/6575 browser consumer at`e994536` passed again,including the
selection negative and Restart. Use `node scripts/verify-sound-toggle-acceptance.js`
for current runtime evidence:194 units,91 boundaries,build,six actual-device I/O
scenarios,two production cases and this full winning route. The earlier receipt
keeps its original source guard and scope.

```sh
node scripts/verify-sound-toggle-acceptance.js
node scripts/verify-standard-wages-route.js --manifest=reference/standard-winning-route.json --setup-negatives
node scripts/verify-standard-wages-route.js --manifest=reference/standard-winning-route.json --output=.local/standard-winning-replay-FRESH
# Conditional planning;clean committed source and fresh ignored output:
node scripts/standard-winning-plan.js .local/rival-standard-capture-01 --through=continued-mountain-return --diagnose --finish --output=.local/standard-winning-plan-FRESH
# Real browser exploration;capture is never self-acceptance:
node scripts/capture-standard-winning.js --plan=.local/standard-winning-plan-04 --output=.local/standard-winning-browser-FRESH
```

Original per-mechanic comparisons remain scoped to their existing manifests.
This work cannot establish whole-campaign native timing,audio phase,waveform
parity,all Standard routes or all difficulty variants. The shared live original
emulator is owned by another investigation and was left untouched.
