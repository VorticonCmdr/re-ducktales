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
remain unknown. No port speed change is justified yet. Next:run the current jungle
with the same independent physical schedule and explicit initial-state/phase
dependencies,then investigate its first state or timing divergence.
