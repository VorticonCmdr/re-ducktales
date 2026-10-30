# Current campaign investigation

The whole game remains incomplete. The production game now includes the original
striped cave treasure reveal from `d8d5442`,following the physical flight-input
runtime verified at `d36dc95`. [The refreshed campaign scenario](cave-reveal-campaign.md)
uses a fresh complete capture;the historical scenario below predates that reveal
correction. Original assets and historical expectations remain unchanged.
Only the 22-file build in `reference/build.json` is supported, EXE SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`,
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. No native emulator state
has been changed during this work.

## Historical Easy route before the cave reveal

`reference/current-physical-campaign.json` declares startup, all four expedition
families, rival progression, banking, the winning deadline ending and restart.
The clean producer is commit`cfcf193`; its archive and every source file are
checksummed. The raw exploratory capture ends with`routeCompleted:true`, no
observer error and a deliberate exploratory sentinel exit1. That is not counted
as a passing acceptance test. Its original files remain untouched.

A separate owned registration declares the completed input recording, then
strict replay reconstructs startup from those4,981 events and matches all35
full states and1,470 flight presentations. Independent actual-browser replay
exits0, matches all35 full state and320x200 pixel digests, checks the complete
DOM event sequence, and restarts to a fresh game. Both arrive at the same
winning cover on day31:banked$14,550,rival$12,500,locations1/30/31/32 collected.
Mountain uses764 authored action bytes and finishes with all three lives.

No expected state selects controls during either recorded replay. Clock1ms,
8ms display callbacks,BIOS seed0 and audio disabled are explicit environment
inputs. Prefix reconstruction starts the game afresh; it is not a memory restore.
This is a port regression and browser acceptance, not independent native
whole-campaign parity or proof for every difficulty,route or audio setting.

```sh
# Historical gate from the archived42ff402 source:
npm run verify:current-campaign
```

On current source,this stable command selects the refreshed34-checkpoint
post-reveal scenario documented in[cave-reveal-campaign.md](cave-reveal-campaign.md).

The command fails on broken fixtures,source identity,unfinished events,wrong
states/pixels,render errors or an unready ending. It also checks the producer
archive against its committed Git revision. Deliberate controls alter only an
in-memory ending/timeline or use copied fixture contracts. The browser negative
removes a real confirmation input. Missing sources and timeouts cannot count
as successful negative controls. The whole historical integration gate remains
separate and red;this scenario does not waive its older receipts.

## Evidence so far

- `.local/current-campaign-exploration-01/`: the old held-key controller reached
  jungle but delivered neutral bytes after original source flushes. It did not
  complete the route. Those failures are not game-mechanic approximations.
- `exploration-02`: explicit repeat makes restored intended direction bytes;
  the old route then lost all three lives at frame320. This is player-route
  failure, not a positive acceptance result.
- `exploration-03`: a physical player policy reached the jungle chest at
  frame858 with one life and$50 in pickups, returned$1,050 and deposited it.
  Photography then earned$500 and returned after its original two days. The
  third flight reached landing before the600-second host test limit expired.
  The whole campaign was unfinished; no timeout is counted as success.
- `.local/current-campaign-jungle-replay-01/`: independently reconstructed
  startup through jungle-return from1,792 external DOM events. All14 observed
  full states match exactly, and379 flight presentations render without errors.
  This diagnostic segment is distinct from complete campaign acceptance.
- `exploration-04`: all20 preceding browser states/pixels matched; cave treasure
  was recovered and returned on day14 with$5,400 carried and$1,050 banked.
  The fourth flight reached landing before its600-second host limit.
- `exploration-05`: all26 saved checkpoints matched, then the continuation
  stalled on the runway. The interrupted source capture had no fourth-flight
  pilot events after its final checkpoint. This was an input-recording limit,
  not a game failure. Prefix metadata now reports truncated captures/tails.
- `exploration-06`: the continuation supplies the missing pilot controls from
  actual departure state. Mountain entry succeeded, but the legacy764-action
  physical controller eventually lost its lives and returned without treasure.
  It is a retained failed player route, not positive acceptance.
- `.local/current-campaign-progress-01/`: a newly declared startup-to-cave-return
  segment, separate from the incomplete full campaign. Strict closed-loop replay
  consumed all3,804 events, matched all24 full states and rendered1,149 flight
  presentations. Seven negative controls reject altered states, missing checkpoints,
  wrong input, partial strict replay, missing fixtures and corrupt fixtures.
  Negative fixtures use copies; original captures remain untouched.
- `.local/current-mountain-plans-01/release-before-last/`: startup reconstruction
  through all28 pre-mountain checkpoints, then authored physical controls.
  Sending each break before its last desired source read (native mode0 consumes
  it once) completes764 mountain actions with treasure. Browser verification
  was followed by a complete browser capture and independent recorded replay.

## Input and replay boundary

`originalGame({physicalKeyboard:true})` selects the production ordinary-key and
destination backends before startup; its default keeps existing component
fixtures unchanged. Original assets are checked against all22 identities.

`replay-hard-campaign.js` now handles physical make/release events at the same
boundaries as the browser. `--through=<checkpoint>` requires `--diagnose`, trims
only the explicitly declared diagnostic prefix and adds no post-prefix tail.
Its output remains labelled EXPLORATORY; it cannot satisfy strict acceptance.
Normal full replay still rejects incomplete environments, skipped checkpoints,
unconsumed events and differing states. Inputs are never derived from expected
RNG, allocator state, device timers or actor memory.

The browser prefix helper dispatches actual recorded DOM events through a
shared adapter, checks every preceding full state/pixel digest, and records its
own observations. It starts the application afresh. It never initializes Game
from a checkpoint, copies a heap, fits a timer or patches executable memory.
The initial clock1ms and8ms display provider are explicit external inputs.

`current-campaign-player.json` declares an exploratory Easy/variant0 jungle
controller. It sends repeat makes before source frames, follows the existing
initial player recipe, approaches the final platform and climbs into the original
chest band before walking right. These are player waypoints, not translated
mechanics. Historical player observations suggested the approach; original
53-pixel grid, actor-center offset and chest rectangle validate its geometry.
No waypoint or successful model run is evidence of native whole-level parity.

## Reproducing the investigation

An existing capture remains exploratory until complete independent replay and
real-browser checks pass. Keep each output root fresh and retain failures.

```sh
DUCKTALES_CAPTURE_EASY_CAMPAIGN=1 DUCKTALES_CAMPAIGN_PHYSICAL=1 \
DUCKTALES_CAMPAIGN_PLAYER_WAYPOINTS=1 \
npx playwright test tests/browser/mixed-campaign.spec.js \
  --config playwright.campaign.config.js --output=.local/current-campaign-new

node scripts/replay-hard-campaign.js .local/current-campaign-jungle-replay-01 \
  --diagnose --through=jungle-return

node scripts/explore-current-jungle.js 0 .local/current-campaign-entry-replay-01 \
  .local/current-jungle-new waypoint
```

The planner reconstructs entry from startup each time. Its known failure matches
the actual browser's pose, lives and consumed bytes at all16 shared20-frame
observations. An earlier retrace-only observer was excluded: the browser instead
publishes data-state after each display callback. Successful planning still needs
browser verification. Planner exit2 means a failed player candidate, not a
successful test. Missing/corrupt artifacts fail explicitly.

The broader `npm run verify:shared-runtime` still requires a new complete
registered campaign regression. Its historical inventory/goldens remain intact;
neither partial evidence nor a renamed historical pass waives that requirement.


## Current strict segment and next campaign experiment

```sh
npm run verify:current-campaign-progress

node scripts/explore-current-mountain.js release-before-last
# Exploratory negative player candidate; exits2 when it fails to obtain treasure:
node scripts/explore-current-mountain.js legacy
```

The segment ends at cave-return by its declared scope. It does not stand in for
mountain, the deadline/ending, Hard campaigns or whole-native parity. Its producer
controller was uncommitted; that limitation is recorded in its manifest rather
than claiming a source archive existed at capture time. Fresh browser replay now matches all24 full states and320x200 pixel digests,
including all3,804 actual DOM events. Audio is explicitly disabled in this scenario.

The [segment receipt](../reference/current-campaign-progress-receipt.json) pins
the retained individual-command results. It explicitly does not claim a clean
combined integration gate or a finished whole campaign. The full real-browser continuation uses source commit`cfcf193` and its clean
local source archive in`.local/current-campaign-continuation-07/`. It completes
the four-family winning route;the independent replay is recorded separately in
`.local/current-physical-campaign-browser-01/`.

The [clean full-route receipt](../reference/current-physical-campaign-integration.json)
records `npm run verify:current-campaign` exiting0 from commit`42ff402`,including
177 unit cases,one complete browser route,restart,five negative controls and
build,with zero skips. All828 protected artifacts remain unchanged. This is
separate from the earlier individual-command three-family receipt.
