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


## Current successful model route

The endpoint-aware grab reaches the vine. The first release cutoffx900 was
past the actor's reachable position;the original platform edge899 and actor
center offset4 allow release atx896. Stopping the final walk at the observed
platform,waiting until it raises the actor toy<=80,and pressingUp reaches the
chest in503 updates with all three lives. Pickups are$250,the award$2,000 and
outcome seed16983. These are model outputs,not accepted browser evidence yet.

[Input-only schedule](../reference/current-hard-jungle-plan.json) keeps all423
key events in a separate local artifact. The browser player consumes that file
without using model observations or expected states to select controls. Its
seven-field model outcome comparison happens only after all inputs. The final
8ms display callback consumes pending release events;it is an explicit external
clock step,not an injected game timer. Capture remains exploratory and must be
followed by independent recorded replay before acceptance.

```sh
DUCKTALES_CAPTURE_HARD_CAMPAIGN=1 DUCKTALES_CAMPAIGN_PHYSICAL=1 \
DUCKTALES_HARD_JUNGLE_PLAN=reference/current-hard-jungle-plan.json \
npx playwright test tests/browser/hard-campaign.spec.js \
  --config playwright.campaign.config.js --output=.local/current-hard-full-new
```


The exploratory browser run from commit`801b4a2` now completes the423-event
plan and matches all seven model outcome values:503 actions,three lives,$250
pickups,$2,250 total and seed16983. It dismisses the award,returns to the map
and deposits$2,250. The carried run has started its second departure. Raw
capture remains ongoing in`.local/current-hard-full-capture-01/`;this observation
is not a finished or independently accepted Hard campaign. Protected manifests
remain untouched while that capture is running.


The full capture has now terminated at the second flight:Safari's race is lost
at294 flight updates on day10,and the original rival-claim path follows with no
unsupported diagnostic. Jungle recovery and banking remain observed successes;
this is not a complete Hard campaign pass. The capture's protected artifacts
remain unchanged. A fresh diagnostic startup replay matches all12 checkpoints,
781 events and360 flight presentations through the first bank deposit.

`.local/current-hard-second-flight-prefix-01/` is an owned diagnostic copy of
checkpoints0..13. Only the last metadata name is aliased from`flight-start` to
`second-flight-start`,with provenance recorded separately. Its state/pixel
hashes and original input values are unchanged. It reconstructs startup and
never restores memory or initializes from expected actor/RNG/timer values.
The original raw capture remains untouched.


The bounded second-flight planner independently reconstructs all14 prefix
states from startup. Its baseline10..25/heading1 reproduces the actual browser's
entire final state exactly,including the race loss at294 updates and seed50923.
Alternative50..65,100..115,25..40 and0..2 altitude bands also lose. No unsupported
diagnostic occurs. No strategy is counted as successful,original captures are
unchanged,and rival speed/physics/RNG are not adjusted. The next investigation
is the first weather collision/spin,not further blind altitude changes.

```sh
node scripts/explore-current-flight.js .local/current-hard-second-flight-prefix-01 \
  second-flight-start .local/current-hard-second-flight-new 10 25 1
```

Every invocation starts from original assets and the complete input prefix. Its
output directory must be fresh;exact tool source is retained there. Exit2 means
an unsuccessful player candidate,not a passing regression or native evidence.

### Second-flight collision observations

The bounded planner now records nearby original object descriptors and the
remembered collision tile/type without writing game memory. The default pilot
still reproduces the actual browser's **entire final Game state exactly**:
race lost after294 updates,seed50923. With this observer,the first sharp speed
loss is input read49 at tile4,y71.98;the remembered type is0x12 (falling cargo).
Read56 records type0x02 from the associated body. Later losses include an airship
at read105 and clouds at reads172,191 and273. These are observations of the port
model,not independent native collision comparisons.

Earlier climb requests,steeper climbing,two lower corridors and a bounded
obstacle-aware gap chooser all still lose the race. No unsupported diagnostic
occurs. Their results and source modules are pinned in
`reference/current-hard-input-investigation.json`;the final observer run also
archives its imported player controller. None supplies successful Hard acceptance.
The optional controls change only exploratory player inputs;default behavior and
production physics,RNG,rival speed and original artifacts are unchanged.

```sh
node scripts/explore-current-flight.js .local/current-hard-second-flight-prefix-01 \
  second-flight-start .local/current-hard-flight-fresh 10 25 1
# Optional final arguments: minimum turn-request speed (0 or4),then hazards.
# Failed candidates deliberately exit2;this is research,not an acceptance gate.
```

The next experiment targets the first cargo/body pair with anticipatory steering,
then requires successful real-browser flight before continuing the Hard route.
All177 unit cases pass after the controller extensions;the complete Easy browser
gate was not rerun for this research-only change.

A later two-pose climb-braking player (`predictive` mode) also loses the second
race at267 updates,seed37329. Its input stream, exact controller and explorer
sources are retained under `.local/current-hard-second-flight-plans-03/predictive-gap`
and pinned in the research manifest. This remains unsuccessful player research.
Campaign acceptance is still incomplete. Work now also addresses the independently
established cave reveal omission rather than treating repeated pilot failures as
proof of a missing mechanic.
