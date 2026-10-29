# Original ordinary keys and map input

The isolated keyboard branch introduces `ordinary-keyboard.js` and uses it in
`OfficeMenu`,preserving the existing Map/snapshot representation. Main remains
the earlier fully verified office integration until this branch is accepted.
The browser's letter/keypad bindings and full map-loop translation are still
pending;this is a shared input-core milestone,not whole keyboard parity.

## Rules and source

Only the22-file build in `reference/build.json` is supported:MZ/EXEPACK,x86 LE16
real mode,overlays,no extender. Native capture revalidates all8368 map-overlay
bytes after180 relocations,plus1220 resident bytes:the876-byte input reader,
114-byte scanner,173-byte IRQ handler,8-byte clock read and49-byte deadline helper.

- IRQ9 stores80 on a make. A release stores40 only while its raw slot exists.
- Scanner140e:19c5 scans raw slots in ascending order and consumes a release once.
- Reader1124:0002 maps I17→Up48,J24→Left4b,K25→Right4d,M32→Down50 **after** scanning.
  Keypad directions47/49/4f/51 produce8/2/6/4;center4c produces0.
- Mode3c1=0 preserves held slots. Mode1 clears the normalized slot,so letter
  aliases can remain held while an arrow slot is cleared. System keys,modifier
  event handling,mouse/joystick and BIOS-queue behavior remain separate work.
- Map pointer1ec8 clears3c1 before the reader,then calls19a5 at20a0 to flush
  keys and restores3c1=1 at20a5. A draw-enabled snapshot outside the call does
  not establish the input-reader mode. The caller owns this flush.

The core has no DOM,clock,RNG or expected-state access. Unsupported raw keys,
modes and flag values stop with diagnostics. Mode1 also has223-read local
research coverage across office letters/keypad and money-bin scenarios;that
supplemental prototype record is distinct from the versioned map scenario here.

## Fresh original map scenario

`reference/map-keyboard-inputs.json` supplies ten make/release sequences for
Right,K,K+Left,keypad3 and M+Up. It contains no expected outputs. Capture02 was
produced by87273ae with518 exact archived tracked files,after natural fresh
launch,office departure and security. The BIOS/RNG setup is conditional;no
memory/CPU writes or partial/full restore supply this map segment.

Each make is queued after the preceding pointer's flush,before the original
caller wait. Assertions require every intended raw key to have settled by its
input call. Capture01 queued at the reader itself;serialized hardware scan
bytes arrived too late for some chords. It is retained as excluded exploration,
not silently aligned or repaired with injected values.

Thirty-six calls record independent before/input/end CPU and complete DS reads.
The source-derived keyboard and pointer carry their own state across calls.
Comparison checks exact AX,all128 flags,coordinates,counter,vectors,latch,draw
enable and return AX. Only the first independent before snapshot initializes
pointer locals;expected after-state never feeds the model. The complete required
input schedule ends inactive with zero remaining events.

Original steady read-return clocks differ by6 driver counts;the first interval
is5 because the initial drawing boundary differs. These are **observations**,
never replay timer inputs or fitted delays. The existing Game still polls its
map every2 driver ticks. Translating the full caller pacing,repeat events and
browser adapter requires separate acceptance;this checker does not validate it.
Compiler helper140e:1e9e reserves stack space,not elapsed time. Its prolog AX
value must not be interpreted as a wait count.

## Verification and reproduction

```
npm run verify:map-keyboard
```

The command requires159 pinned artifacts,all22 original identities and the518-file
capture source/Git archive. It rejects missing/corrupt files,zero/missing reads,
unconsumed sequences and every compared discrepancy. Five comparison negatives
omit a make,normalize too early,alter an input result,omit the caller flush or
remove a read. Fixture controls remove a required snapshot and corrupt the
consumption file at the same length;exact restoration must pass again.

Native security/setup PNGs are retained for integrity,not claimed as new map
pixel comparisons. This is a conditional original input/pointer comparison;
Game integration,browser acceptance,whole-scene timing and campaign parity are
distinct evidence levels.

Use the installed DOSBox MCP Python environment,with
`DUCKTALES_DOSBOX_MCP_ROOT` pointing to its site-packages directory,then run:

```
python scripts/capture-security.py --map-inputs --port 8387 --output .local/map-keyboard-new/capture
```

The output directory
must be new. The recipe preflights its isolated port,checks process/instance
identity,owns all breakpoints and stops its emulator in `finally`. It never
attaches to unrelated8386 or modifies global bridge configuration. A new capture
has its own source/input/artifact identities;review/register those separately
rather than overwriting the pinned capture02.
