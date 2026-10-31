# Original swamp movement observation

The supported original build now has a natural uninterrupted jungle reference:
[manifest](../reference/jungle-native-cadence.json),capture source `d2172d9`,local
artifacts `.local/jungle-cadence-native-01`. This is original-game evidence,not
port timing acceptance.

The private portable emulator uses normal core3000 cycles/ms,svga_s3,16MiB and
vmem_delay off. Its unchanged configured binary and all22 original files are
hashed. Originals are mounted read-only. Startup/security and ordinary map keys
select64,73,Okeefadokie Swamp. This run's shuffled campaign slot is34,variant0,
Easy,day4,entry seed2048. It uses the existing naturally nonracing flight/crash
setup,without changing destination,racing flag,registers or memory. The complete
17548-byte flight body and24056-byte jungle body are checked against original
bytes with source-defined relocations/FPU rewrites. The actual entry is overlay
IP0000;the first returned neutral input is0680. Both opening page reveals finish
before the observation starts at049a.

The independently authored engine schedule presses Right at relative rendered
frame0 and releases it at40. A read-only Lua script records120 consecutive
callbacks. No breakpoint remains during measurement;only the final manual pause
adds a stop (247→248). Both events dispatch completely. The owned emulator exits
with return0;HOME and the shared live session remain unchanged.

The samples cover119 frame intervals and123 resident driver counts,about1.7s.
Scrooge starts X8/Y16,idle action5,and ends X40/Y16,idle action5. Motion/action
changes occur at sample13 (X24,action1),36 (idle),39 (X40,action1),53 (idle).
The source life counter stays1,which means three lives remain. RNG changes and
the raw EGA page byte are retained. A sampled one-bit page can miss an even number
of intervening flips,so page changes are not claimed as an exact update count.

The original keyboard table illustrates why the input environment matters:
Right is00 at sample1,80h at2,cleared00 at13,80h again at37,break40h at41,and00 at42.
The game flushes its input table while the physical key remains held;keyboard
repeat later restores it. A port comparison must replay the independent physical
schedule through its input provider. Feeding continuous joystick Right or
deriving joystick bytes from these output samples would test a different contract.

## Reproduce and verify

Use a fresh ignored output and a free private port. The capture requires clean
committed source,archives it before launch and checks it again before completion.
The installed Python bridge package is used directly;its legacy lifecycle is
bypassed by the owned portable launcher because it overrides HOME.

```sh
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-security.py \
 --jungle-page-observer --port 8404 --output .local/jungle-cadence-native-FRESH
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_jungle_cadence.py
```

The saved verifier pins250 artifacts,source archive,executable/assets,actual
emulator binary/configuration,full relocated flight/jungle identities,and EGA
flip/wait/sprite code ranges. It requires all120 samples,both events,completed
startup/flight schedules and owned shutdown. Five negative controls reject a
missing sample,skipped frame,changed motion boundary,missing release and altered
jungle code. Missing/corrupt local evidence fails setup;Python optimization is
rejected. The original flight FPU handler/IVT are checked by the archived capture
recipe;the saved verifier reconstructs admitted flight rewrites but does not
independently recompute those handler/IVT snapshots. Other driver code and mutable
copy operands are retained but not admitted as exact by this verifier.

The initial checker incorrectly expected boolean key-table values. The retained
bytes and existing ordinary-keyboard implementation established80h/40h flags;
the checker now validates those actual values. This changed no capture or runtime.

Original IRQ/retrace phase,input latency,partial scanout and whole-level timing
remain unknown. No port speed change follows from the original recording alone.

## Conditional closed-loop port comparison

```sh
node scripts/compare-jungle-native-cadence.js
```

The current Jungle component starts from native ENTRY memory and its original
variant/difficulty/day/seed/money contract. This is an injected component initial
condition,not a complete machine restore or independent browser campaign. It
carries its own state through the whole segment with zero-phase driver/retrace
clocks. The source048f post-reveal input flush supplies the measurement origin;
no native timestamp or output state selects that origin. The input reader uses
the existing OrdinaryKeyboard mode0 and its actual flushes. Expected first-input,
opening and observer outcomes are loaded only after the simulation finishes.

The physical schedule is independently authored:make0ms,release40 configured
render intervals later (570.727ms). The explicit external provider repeats at
500,533 and566ms. Those defaults come from `set_defaults`/`typematic_tick` in the
emulator source at engine-reported revision `f6d9b935f`;the inspected current file
matches that revision exactly. [Provider provenance](../reference/jungle-keyboard-provider.json)
pins its file hash and rules. This synthetic provider delivers IRQ-table events
immediately;it does not emulate i8042 readiness/serialization or the1ms timer
phase. It is not a claim that browser host repeat matches the original hardware.

The first-input and pre-loop opening states match exactly. The initial observed
state,all four subsequent motion/action transitions,and final state also match
exactly for X,Y,action,actor frame,life counter,column,row,scroll and RNG. All37
port reads and five provider events finish. This is not a full-memory or pixel
comparison. The measured transitions are:

| Consequence | Port milliseconds | Original callback bracket, milliseconds |
| --- | ---: | ---: |
| First step to X24 |171.218 |156.950..171.218 |
| Return to idle |488.936 |485.118..499.386 |
| Second step to X40 |530.120 |527.923..542.191 |
| Return to idle |736.040 |727.677..741.946 |

All four times fall inside their corresponding native callback brackets under
this declared provider/phase. The checker allows only1e-9ms for double-precision
origin-subtraction roundoff,no added frame or fitted offset. Five negative
controls reject changed initial RNG,an extra two-frame delay,a missing movement
transition,omitted repeat events,and an omitted release. The command first runs
the strict native-artifact checker,then fails on any required state/event/timing
difference or unfinished simulation.

This conditional comparison supplies no evidence of accelerated movement in the
short swamp scenario. It does not establish native clock phase,exact keyboard
delivery,all jungle workloads,whole-level timing,or actual browser scheduling.
No runtime slowdown was added. Next:compare the retained uninterrupted mountain
scenario and investigate the first divergence,then obtain cave movement evidence.
