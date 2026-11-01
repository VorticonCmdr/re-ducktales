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
