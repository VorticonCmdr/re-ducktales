# Winning campaign after reward-presentation restoration

This work refreshes browser coverage after the original75-retrace award entry
changed the old fixed-timestamp campaign route. Runtime remains357d83f;only the
player/capture tooling changes. The old170-checkpoint receipt remains immutable
historical evidence. No old expected state or timer is adjusted to make it pass.

The existing Standard Wages explorer now supports `--winning`,which includes its
startup/cave/banking/Safari legs and a continuation through Great Outback jungle,
Lost World mountain,Atlantis/Klondike/Siberia caves,banking,victory,credits and
Restart. Actual observed outcomes may reject this player strategy;that is not
automatically a port defect. A capture is not acceptance.

Player controls reuse the source-authored jungle and mountain input schedules
that previously completed Standard. Inputs are delivered at actual browser read
ordinals,with no skipped frames or unfinished input tails. The pilot observes
published flight pose. Cave navigation uses a private planning copy of the map
and observed enemy position to choose keys;it never modifies the game map.
Destination coordinates come from original resources in the declared BIOS0
startup permutation and are checked against the selected live destination.

Reward readers are entered only after the live presentation completes. Keys
are not held early and fitted delays are not inserted. Global RNG,ownership,
money,days,memory and outcomes are never patched. The environment remains UTC,
BIOS0,clock origin1,8ms presentation callbacks and muted audio. Required reward
row-group observations are recorded separately from the independent DOM stream.

```sh
# Clean committed source,original game/ and local evidence storage required:
node scripts/standard-wages-explore.js --winning --output=.local/current-winning-FRESH
```

The route still needs actual browser execution and a separate strict replay
before current full-campaign acceptance can be claimed. Original uninterrupted
timing,wider route/difficulty coverage and Hard campaigns remain separate work.

The first actual exploration completed the jungle reward but failed the mountain
with the older784-read ascent recipe. It is retained as a failed strategy,not
accepted or labeled a port defect. The previously successful Standard route used
the671-read `mountain` moves in `reference/hard-campaign-inputs.json`;that file's
name does not select Hard. Browser difficulty remains1 throughout.

`reference/current-winning-prefix.json` declares only the valid54-checkpoint/
3953-input prefix through `jungle-map`. A fresh browser replays it from title and
compares every complete state and decoded image before continuing. No game state
is restored from the checkpoint, and the failed later input tail is not accepted.

```sh
node scripts/standard-wages-explore.js --winning --prefix=reference/current-winning-prefix.json --output=.local/current-winning-next-FRESH
```

The second exploration matched that54-checkpoint prefix and completed the
correct671-read mountain climb with3 lives and its2000 reward. The following
Atlantis flight crashed after its controller waited for speed4 before recovering
from collisions. This is a failed player strategy,not an accepted full campaign
or evidence of a mechanics defect. Its valid79-checkpoint/5031-input prefix ends
at `mountain-map`;the failed flight tail is excluded by
`reference/current-winning-mountain-prefix.json`.

A focused conditional input replay reached Atlantis when its pilot recovers
steering at speed1. The game mechanics,flight RNG and timing are unchanged.
`.local/atlantis-pilot-01/result.json` records that candidate at source `ed6ffb2`;
this simulation evidence still requires actual browser exploration and a separate
strict browser replay. The next explorer uses that controller only for Atlantis.

```sh
node scripts/plan-winning-flight.js --capture=.local/current-winning-browser-02 --through=departure-9 --diagnose --minimum-turn-speed=1 --output=.local/atlantis-pilot-FRESH
node scripts/standard-wages-explore.js --winning --prefix=reference/current-winning-mountain-prefix.json --output=.local/current-winning-next-FRESH
```

The third browser exploration reached all six treasure rewards and banked27050
on day25. Atlantis's speed1 recovery controls worked in the actual browser.
Klondike and Siberia completed too. The later office/bank trips reached a normal
day31 defeat against Glomgold's36000. No mechanics were changed to force victory;
this is not a current winning-campaign receipt.

`reference/current-earned-route.json` preserves only its valid129-checkpoint/
6511-input startup-to-bank25 segment. A separate browser consumer must compare
every complete state and decoded image and reject a missing Standard-selection
input. The losing tail remains in the immutable producer but is outside this
declared segment. `reference/current-earned-awards.json` separately pins all six
earned presentations against independent older completed reward pages.

Their90 row groups pass exact pixel checks. Jungle legitimately arrives black:
its original Main01e0 wipes the page before returning. The new1201-byte original/
prepared/Ghidra source check verifies that cleanup,45 relocations and one explicit
analysis stack-probe replacement. Only jungle's completed421-read success uses
the exact all-black incoming-page contract;other activities still require a
nonblank incoming page. Missing groups,corrupt pixels,blank non-jungle sources
and nonblack jungle sources are negative controls. No pixels are excluded.

```sh
node scripts/verify-jungle-award-exit-source.js
node scripts/verify-current-winning-awards.js --manifest=reference/current-earned-awards.json
node scripts/verify-current-earned-route.js --setup-negatives
node scripts/verify-current-earned-route.js --output=.local/current-earned-replay-FRESH
```

The next conditional winning strategy tries Novay's still-unclaimed7500 mountain
treasure after Siberia,using the previously authored494-read layout1 climbing
controls. It is an input-only candidate,not accepted gameplay or a difficulty
change. Preventing Glomgold from collecting that treasure can affect both scores;
actual outcomes must be observed instead of fitted.

```sh
node scripts/plan-novay-finish.js --capture=.local/current-winning-browser-03 --through=dialogue-127 --diagnose --output=.local/novay-finish-plan-FRESH
```
