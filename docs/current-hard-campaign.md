# Current Hard campaign investigation

The current Easy route has a clean full gate. Hard remains unaccepted. This work
changes exploratory player controls;it does not alter game mechanics,RNG,
resources,physics,damage or the rival's race calculation.

A fresh physical-keyboard Game initially loses the opening Bermuda race with the
old feedback pilot. That pilot chooses another turn from the currently published
heading while the preceding sampled turn can still be pending. Original mode0
also consumes a released arrow once more. Broad altitude changes do not fix this.

The exploratory pilot now anticipates that pending turn from the published
frame/read ordinals and actual last consumed byte. A final one-step turn is a
physical make/break tap. The carried model wins the race in262 flight actions,
arrives on day2 and enters jungle. No expected final state or copied memory feeds
the controller. The shared browser controller reproduces the exact same full input stream and
final model state. Actual browser capture now wins the race and reaches jungle frame0;it is
not complete Hard acceptance.

The preserved447-action Hard jungle recipe then loses all lives at action405
with$200 pickups. A bounded jump at the observed ledge also fails. Neither run
is accepted as success or proof of a port defect. Original platform/animation
and hazard logic remain unchanged;the next experiment records actual browser
arrival before planning a response to its first jungle failure.

[Input provenance and scoped results](../reference/current-hard-input-investigation.json).
The two later local model candidates preserve their exact producer modules and
checksums. Earlier failed revisions were not archived and are not claimed fully
reproducible. Local model clocks use8ms observations and104ms convenience presses;
browser helpers retain their verified100ms/scene-readiness input boundaries.
This environment difference is explicit and is not fitted away.

```sh
DUCKTALES_CAPTURE_HARD_CAMPAIGN=1 DUCKTALES_CAMPAIGN_PHYSICAL=1 \
DUCKTALES_CAPTURE_HARD_ENTRY=1 \
npx playwright test tests/browser/hard-campaign.spec.js \
  --config playwright.campaign.config.js --output=.local/current-hard-new
```

Capture is exploratory and intentionally cannot pass acceptance. A completed
route must subsequently be reconstructed from an independent immutable DOM
stream,with strict states,pixels,event consumption and fresh browser checks.

The entry-only switch deliberately ends the exploratory capture at the first
actual jungle frame0,after recording startup,departure and arrival checkpoints.
Omit it when continuing the four-family route. This is a preparation step for
Hard jungle recovery,not a replacement for complete Hard campaign acceptance.


The actual entry capture at`2d94739` records352 DOM events and three full
checkpoints. Diagnostic startup reconstruction matches all three states and
360 flight presentations,without a memory restore. The first jungle state is
identical to the model,including seed14989. Raw capture intentionally exits1 at
the declared entry sentinel;it is not reported as a passing full campaign test.

From that actual prefix,the baseline loses at405 actions again. Late versus
early ground-key release does not fix it. Per-read diagnostics put the first
loss at action275:x687/y48,consumedRight3,action14 then falling action2.
Existing hazard code sets14;moving-platform support flags stayzero. The earlier
ledge interpretation was only a player-route hypothesis,not an established
terrain or timing defect. Key losses at301/370 follow life resets and occur
later. Starting immediately instead of waiting three actions also fails.

```sh
node scripts/explore-current-jungle.js 0 .local/current-hard-entry-replay-01 \
  .local/current-hard-jungle-new hard
```

This remains exploratory and exits2 for an unsuccessful player candidate.
The tool preserves its exact source bytes alongside new results. Its optional
Hard diagnostics read the port's own support/actor state solely for observation;
they never initialize or modify game memory or choose inputs from expected states.

Fire at the contact point delays the hazard hit but still loses at443 actions;
a40-neutral wait instead of20 also fails (409 actions,$250). These are retained
failed player candidates. No underlying timer,RNG or damage values were altered.
The next investigation should inspect the bird response and crossing condition,
rather than treat either variation as a gameplay fix.


A bounded white-box player wait for the bird's current state advances further,
but still fails. A two-stage crossing waits outside the cell,then uses the
original Up action inside it while waiting for another safe bird window. This
model reachesx783/y48 with all three lives and no hazard action14. The next
original Up/Vine input selects17 at action352,but misses the moving vine and
falls. That is now the next observable failure;no whole jungle success is claimed.

These two controllers use the port's own current bird state to choose inputs.
They are explicitly conditional white-box player experiments,not original native
input evidence. Strict acceptance must use a separate immutable event stream
and actual browser observations. No simulation state is initialized from outputs.
The Easy waypoint compatibility check still completes in858 actions with its
unchanged outcome1,$50 and seed31622.
