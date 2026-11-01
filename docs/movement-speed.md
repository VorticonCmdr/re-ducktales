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
