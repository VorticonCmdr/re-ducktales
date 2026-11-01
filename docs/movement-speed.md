# Movement speed investigation

Movement pacing is the current priority;other port work is deferred. The
supported original remains the22-file pairing in `reference/build.json`.
Measurements must distinguish action duration,input repeat,video refresh and
CPU drawing cost. No global slowdown has been fitted.

The existing original/VGA comparisons still pass on the current runtime:
jungle walking's four transitions and mountain walking's six transitions fall
inside their original callback brackets,with exact compared positions,actions
and RNG. Safari's18 neutral loop states/RNG match;its timing is within the old
phase uncertainty,but is not admitted as exact native cadence.

The new [independent jump inputs](../reference/jungle-jump-inputs.json) hold
Right+Fire at original rendered frame0 and release both at40. Native capture
`.local/jungle-jump-native-01`,sourceb1d9238,contains120 uninterrupted samples,
119 frame intervals and123 game-driver counts. All four physical events finish.
All24056 live jungle bytes and17548 flight bytes match the original after
source-defined relocations/FPU transformations;the executed EGA ranges match too.
The owned emulator60725 closes0. No guest writes or machine restore occur.

This fresh capture used the externally updated configured engine
`0.84.0-vc1 (baf7b)`,protocol1.15,binary3580a642. Its CPU normal/string,keyboard
and PIT source files are byte-identical to the earlier f6d9b source. The new
binary/configuration and live game addresses are pinned independently;
the older fixture's binary identity is not reused. [Manifest](../reference/jungle-jump-native.json).

The component carries its own state from native ENTRY,using the separately
authored physical inputs and500/33ms keyboard repeat defaults. Only Space,the
last pressed physical key,repeats. Raw16-bit coordinate values are compared
exactly,including Yfff8 during the jump. Expected snapshots are read after the
simulation finishes and never supply waits or intermediate port state.

All seven jump movement states and final compared state match exactly. The
strict timing probe exits1:the first motion occurs at515.852ms in the port,
outside the original527.923..542.191ms bracket. The final return is1051.244ms,
versus1055.846..1070.114ms. The port action duration535.392ms is inside the
original513.655..542.191ms duration bracket. This is an early phase offset,not
evidence for multiplying all movement durations. Browser/i8042/IRQ phase remains
outside this conditional comparison.

```sh
node scripts/compare-jungle-native-cadence.js
node scripts/compare-mountain-native-cadence.js
node scripts/compare-safari-native-cadence.js
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_jungle_cadence.py reference/jungle-jump-native.json
# Known failing exploratory timing comparison:
node scripts/probe-jungle-jump-cadence.js
```

The native checker requires complete samples,exact source/asset identities,
completed inputs/owned shutdown and five corruption controls. The shared
component runner retains all five earlier walking negatives. The jump probe
reports its first difference and fails;it does not admit a new tolerance.

The explicit EGA control is now captured and strictly verified in
`reference/jungle-jump-ega-native.json`:same original build,120 callbacks,
119 frame intervals,144 driver counts,four physical events consumed,owned
emulator closed. EGA mode0D refresh is source-derived as
14318180/(8*114*262) =59.9227434Hz (use the exact expression,not this rounded text).
The manifest records source revision and file hashes. This is a different
hardware environment;the40-frame hold lasts667.526ms rather than570.727ms.
It is not an identical wall-time input comparison.

The EGA conditional component run also matches all seven motion states and
final RNG/state. First motion530.883ms is within the native517.333..534.021ms
bracket. The strict probe still fails:the fourth transition983.907ms precedes
its984.601..1001.289ms bracket by0.695ms;the final return1066.274ms is also early.
No tolerance has been enlarged. Neither hardware result supports a large
universal slowdown. The browser retains the existing VGA reference clock.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_jungle_cadence.py reference/jungle-jump-ega-native.json
# Known failing exploratory comparison;expected exit1:
node scripts/probe-jungle-jump-cadence.js reference/jungle-jump-ega-native.json
```

The browser scheduler advances independent driver/retrace deadlines and catches
up simulation steps after a slow render. Jungle graphics waits resume on those
clocks in both the component comparison and real application;unlike mountain
and cave,it has no separate application work wake. This inspection establishes
matching scheduling paths,not actual browser timing acceptance.

Next:verify the currently served browser build's movement timing and investigate
the cave movement first divergence. Older project checkouts can lack the drawing
work delays;do not treat their speed as a measurement of this worktree.

Current main cave probe was rerun after the EGA control (source12a7f84).
It still fails strictly at phase2:2782.296ms versus2796.564..2810.832ms,
with the same room,torch,party pose and RNG. Final pose/RNG still differ.
This confirms the remaining cave issue is present on the current runtime;
the earlier passage-order correction alone is not timing acceptance.

Manual browser exploration on the same source used actual controls from a fresh
opening through security,world-map Okeefadokie Swamp selection,travel,throttle,
flight completion and jungle entry. Right movement exercised the real adapter,
rendering and a life-loss path,without state injection. Published jungle state
reports counted drawing work (16.535ms at initial idle,24.7ms in the observed
life-loss frame). This establishes a working browser route,not quantitative
speed acceptance. An attempted concurrent DOM timing sampler could not access
`performance.now` in the browser tool's read-only evaluation scope;it yielded no
timing evidence and is excluded. No alternate clock or fitted result was used.

The isolated `codex/loader-environment` experiment at1dfbd20 now applies original
source-counted sound IRQ instruction work against this main Cave implementation.
Its control and work runs both exit1,as required for the remaining native timing
mismatch. Source/fixture preflights pass. It initializes the captured sound state
at the first-input boundary;it is conditional evidence,not complete replay from
ENTRY. The instruction subtotal adds36.451667ms to active graphics waits over5974
IRQs. Torch and entry-clear phases still land at2782.296/5379.106ms,so the first
timing difference remains. Final party pose matches with IRQ work;final RNG
still differs. No elapsed-time residual was used as an input. [Local log hashes
and source identities](../reference/cave-source-irq-movement.json).

Reproduce from `/private/tmp/ducktales-loader-environment` at1dfbd20 with
`DUCKTALES_MOVEMENT_RUNTIME_ROOT` set to this main checkout,using
`node scripts/explore-cave-irq-cadence.js --control` and
`node scripts/explore-cave-irq-cadence.js`. Both are exploratory failures,not
acceptance commands. Chained BIOS,hardware/port budgets,masked intervals and
remaining DOS/allocator/caller work are excluded;precomputed multi-part drawing
deadlines can absorb an earlier extension. These limits must be resolved before
integrating interrupt CPU work into playable movement. The next timing target
is the remaining loader/caller and scheduling boundary,not a global slowdown.

The cave probe now exposes a read-only pose trace in addition to its unchanged
strict whole-window failure. `node scripts/compare-cave-passage-motion.js`
passes12 exact exit poses and11 adjacent pose-duration brackets,with three
negative controls (missing pose,changed coordinate,changed duration). The source
boundary trace and independently sampled original callbacks have different RNG
consumption boundaries inside party calls;this segment check explicitly compares
coordinates/pose/room/torch/entry flag only. It claims no intermediate RNG parity.

The exit animation span is1298.636ms;the independently sampled original span is
1284.137..1312.673ms. The first pose starts at1383.783ms instead of the original
1398.282..1412.550ms,after the sprite10 load. Later exit poses retain this same
one-frame lead,without a growing movement-rate difference. Thus the demonstrated
absolute gap occurs before the exit animation;slowing each pose would introduce
a different error. Whole-cave timing,final RNG and entry timing remain failures.
The paired enabled/disabled audio-environment check still passes its declared
control result after adding diagnostics;neither mode accepts native timing.

Browser follow-up in this turn could list the retained jungle tab but could not
read or bind it (`browser.user is unavailable`). Rebinding through the documented
API had the same result. No new browser speed evidence is claimed. A user retest
of the current build is pending;work continues against the existing original
reference platform without assuming their answer.

The independent sustained jungle walk is captured in
`reference/jungle-walk-hold-native.json`,source4b598e6. Right is held for80
rendered intervals (twice the earlier walking profile),then released;120 samples
span119 frames/123 driver counts. All22 originals,full relocated flight/jungle
bodies and executed EGA ranges are verified. Both physical events finish;owned
emulator74698 closes0. Two naturally racing setup launches were excluded and
closed0;another port-preflight rejection launched no emulator. No flags or game
state were patched to obtain a nonracing setup.

All16 motion states match exactly,including the walk over the ledge and fall;
final compared state/RNG also match. The first strict timing difference is fall
frame4 at955.687774ms,just before955.968382..970.236567ms. The0.280608ms miss is
still a failure;no tolerance or speed multiplier was introduced. Later offsets
vary within roughly one sampled frame rather than accumulating a large speed
error. This remains zero-phase conditional component evidence,not quantitative
browser/native timing acceptance. The saved port result is hashed in the manifest.

This scenario also confirms original IRQ break64h survives samples81..83 until
the reader clears it at84. The checker requires these exact flag transitions;
held80h after the release is rejected by an additional negative. Earlier walking
and jumping fixtures retain their existing stricter zero-flag expectations.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_jungle_cadence.py reference/jungle-walk-hold-native.json
# Strict exploratory comparison;currently exits1:
node scripts/probe-jungle-jump-cadence.js reference/jungle-walk-hold-native.json
# Fresh original capture recipe (use a new local output directory/private port):
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-security.py \
 --jungle-page-observer --jungle-motion-profile walk-hold --port 8414 --output .local/jungle-walk-hold-native-FRESH
```

A fresh real-browser clock measurement now uses development-only `data-timing`,
published beside `data-state` after rendering. It records the actual frame's
performance.now input,simulation elapsed time,origin and hidden-page pause total.
It never supplies simulation inputs. Resetting the browser tool session restored
the previously unavailable browser connection;no alternate UI mechanism was used.

Normal controls again reached the jungle via security,map and flight. An actual
Right hold1000ms changed X8→24 and advanced26 simulation frames. The two published
snapshots span1048.8ms of browser wall/simulation time,77 driver ticks and74
retraces. Both global tick counts equal the exact timer floor;component tick and
retrace deltas follow the same clock. Independent host read brackets are
1018..1078ms,containing the browser interval. No browser errors were reported.
This verifies the real browser consumes time at1x in this interval;it does not
claim that synthetic native key holds emit the same typematic stream as DOSBox.

`node scripts/verify-movement-browser-clock.js` verifies the saved local recording,
archived/current runtime identities,all22 originals,one completed actual movement
case and five negatives (altered tick,simulation time,wall time,missing input and
zero cases). The1e-7ms allowance covers only floating-point origin subtraction.
No native timing exclusion or presentation tolerance is added. This clock check
is distinct from the remaining strict native timing failures.

A concrete missing cost is now corrected:original allocation payload zeroing.
[Source proof and verification](allocation-clear-work.md) covers360 instructions/
862 bytes and55 resources. Native sprite10 requires19040 word stores,picture0
16000. Their budgets come from original clear loops,not elapsed-time fitting.
The first cave exit pose moves6.347ms later;the full native probe still fails.
221 units,the resource oracle,exit-pose segment,actual cave browser route and
build pass. Prior natural-clock browser evidence is historical until recaptured
on this changed runtime;its source guard is retained.

The remaining phase investigation now has a calibrated read-only PIC timestamp
provider. [Capture-tool correction and scope](native-clock-capture.md) records
61 shell-only samples,source/binary identities,owned shutdown and four negatives.
Jungle captures can explicitly select this private build and retain ENTRY time
plus per-frame PIC milliseconds. No phase is fitted from sprite expectations.
No new game timing acceptance follows from calibration alone.
