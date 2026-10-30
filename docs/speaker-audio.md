# Persistent PC-speaker driver work

**In progress:the game still uses its existing WAV rendition and omits the
flight engine. The new driver core is not yet connected to browser playback.**
Hard campaigns are deferred at the user's request while missing timing,input
and audio behavior is addressed.

`src/speaker-driver.js` translates the persistent state in `IT.DRV` resource5:
7,253 bytes,SHA-256
`131133fb9137d6ef39db079cf81986110244a41e43efcfbf34ef0e347b5a9c33`.
The supported executable/resource pairing remains `reference/build.json`.

## Recovered behavior

Ghidra program `driver-5.bin` is raw x86 LE16 real-mode code,not a loader stub.
The public far API is0408,the fast interrupt02a8,the sequence tick05ac,and
reset0576. Original disassembly was used for widths,carry flags and bytecode
operands;decompiled C was used to cross-check the public speed/priority path.
The isolated native fixture verifies each reached OUT instruction and compares
all original driver bytes at every checkpoint,including its unchanged code.
The private live allocation maps offset-for-offset to the raw static image.

Request9 starts the engine sequence. Request8 is accepted only while the engine
gate at0287 is active;the high argument byte selects the original pitch,noise
mask and gating tables. The public update masks bit15 for its table index,but
stores the whole argument. The opcode98 initialization path retains its own
unmasked high-byte behavior. Signed priority comparison and one shared channel
are preserved;there is no independent engine oscillator mixed over other cues.

The engine's current divisor approaches its target by the original byte-sized
step,including the equality case and16-bit wrapping. Its deterministic three-byte
RCR noise state advances twice per noise update. The first resulting high byte
and second resulting low byte form the masked PIT word. Gating countdowns wrap
as bytes,and the engine flips port61 control bits0/1 using the original state.
Reset clears only024c..0271 and the explicitly assigned fields;RNG and interrupt
dividers survive. The source12-interrupt sequence divider and48-interrupt old
handler chain remain persistent. The external tick counter wraps to32 bits.

Other supplied sequence handlers are translated too,including note tables,
loops/calls,tempo,gates,slides,vibrato,stutter and engine/noise commands. All121
public requests run through a bounded6,000-IRQ audit:93 stop within that window,
28 remain active. This does not prove that all28 loop forever,or independently
validate every handler against native execution. The final resource byte is a
stop;the JavaScript decoder avoids native LODSW's unused AH overread there.
Actual missing operands and unsupported native-call bytecode fail explicitly.

## Strict native comparison

```sh
node scripts/verify-speaker-engine.js
```

The versioned manifest pins17 local artifacts and exact sources. Twelve carried
checkpoints compare all7,253 driver bytes after408 independently scheduled IRQs,
1,128 ordered port writes,34 private-clock increments,eight handler chains and
400 PIC acknowledgements. Five negative controls remove an IRQ,alter initial
RNG,omit a checkpoint,drop a port write and change an unrelated port61 control
bit. A positive tolerance control changes only timer/refresh status bits4/5.
No other state or output bits are excluded. The raw capture's original port61
note was broader;the current verifier strengthens it to mask0xcf and tests that
bit6 changes fail. All raw output bytes remain untouched. Missing/corrupt artifacts,zero cases,
unfinished schedules,unsupported events or unconsumed device events fail.

The original shared DOSBox was observed running Deathtrack on port8386 and was
left untouched. The recipe reuses the installed bridge's `InstanceManager` and
`DosboxClient` on a separately preflighted port,without editing global config.
The successful capture is `.local/speaker-engine-native-04/`;its exact producer
is retained as `capture-source.py`. Earlier incomplete/setup attempts remain
separate and are not acceptance evidence.

Reproduce with the installed bridge client root and a free private port:

```sh
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp \
/path/to/dosbox-mcp/.venv/bin/python scripts/capture-speaker-engine.py \
  --output=.local/speaker-engine-native-new --port=8394
```

The output directory must be fresh. The process owns and stops its isolated
emulator. It uses a fresh65,535-byte DOS allocation,an unpatched driver copy,
private call wrappers and a private dword clock. IF/DF are clear;IRQs are invoked
manually. The old-handler vector points to a private IRET stand-in,so original
BIOS/PIC effects after that chain are outside this fixture. Source and model are
initialized from original data and authored providers,not expected checkpoint
memory. Allocation/vector addresses are recorded external inputs. This is
conditional native function evidence,not a partial restore or full machine
checkpoint. Natural interrupt phase and analog/PIT waveform parity are unproven.

Next:implement the audio-frame/PIT output boundary,then connect the persistent
device to real browser start/speed/effect/mute/completion controls. Keep the
existing game route green and verify actual browser audio before claiming the
missing in-game engine rendition complete.
