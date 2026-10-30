# Persistent PC-speaker driver work

**Focused browser integration verified:** the game now uses a persistent
PC-speaker AudioWorklet instead of pre-rendered WAVs, including flight engine
start and parameterized speed words. Native core evidence and browser acceptance
are separate below.
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

## Browser output boundary

`src/speaker-game.js` consumes ordered request words and explicit sample-frame
budgets. It advances the original IRQ every 1,365 PIT clocks at 1,193,182 Hz,
independently of DOM rendering. The ideal mode3 counter integrates each output
sample across counter edges and IRQ boundaries. Port42 writes set the pending
divisor; port61 controls the timer gate and speaker connection. Divisor zero
means65,536. Output gain0.18, initial high phase, half-period handling and lack
of analog filtering are explicit rendition choices. Original physical waveform,
PIT reload phase and analog acoustics remain unverified. The local DOSBox primary
implementation consulted was `src/hardware/audio/pcspeaker_impulse.cpp` and
`pcspeaker_discrete.cpp` in the installed dosbox-automation checkout; this does
not turn those choices into measured hardware parity.

The stream preserves native priorities and one shared channel. Browser request0
is a high-priority sequence, not an immediate native reset: it finishes on a
sequence tick. A documented browser delivery barrier therefore queues subsequent
requests until this stop completes. This lets keyboard sound-enable and Restart
send stop/start together without silently losing title music. It is an explicit
browser adaptation; the native core and its regression remain unchanged. Queue
order and duplicate tokens are checked. Token completion is reported at the
first actual idle IRQ, never from a WAV duration or a fabricated ended event.

`src/game/audio-device.js` shares the ordered, validated device lifecycle with
Tandy. Module/processor errors stop with a visible diagnostic. Mute issues0;
device switching waits for the native stop, consumes all acknowledgements and
tokens, then closes the old context. Hidden pages suspend the audio context.
The asset viewer retains its older bounded audition renderer, whose noise and
engine preview are approximate. It is separate from this persistent game path.

Sound001 in resource5 contains a backward bytecode jump at the end of its phrase
(`84 d4 0c`, immediately before the stop preceding the next sequence). The
persistent implementation does not impose the old audition renderer's60-second
limit. This is static evidence for the loop, not a new native whole-song capture.
Do not apply the Tandy finite-song expectation to this resource.

The registered focused run passed7 actual-browser cases,3 stream checks, the
12-case native speaker comparison, existing Tandy regressions and production
build. The full unit suite passes180 cases. These are distinct verification
levels; no new full-campaign acceptance is claimed.

## Reproducible checks

```sh
npm run verify:speaker-game
# Individual checks:
node scripts/verify-speaker-engine.js
node --test tests/speaker-game.test.js
node scripts/verify-tandy-game.js
node scripts/verify-tandy-engine.js
npx playwright test tests/browser/tandy-game.spec.js tests/browser/title-audio.spec.js --config playwright.campaign.config.js
npm test
npm run build
```

The three stream checks reject a missing request, unordered/invalid requests,
duplicate queued tokens and invalid frame counts. They compare exact PCM across
independent block partitions, all driver bytes against the independently
advanced core, IRQ accounting, original speed words, and required finite-cue
completion. All22 original identities are verified before execution. These are
port/provider regressions; native state evidence is the separate12-case fixture.

Browser checks use real controls, rendering and native AudioContext/AudioWorklet
processing. The flight/cave route must use real time: the paused Playwright
clock run reached simulation checkpoints but yielded no audio sample progression
and cannot substantiate audio acceptance. Earlier failed attempts are kept in
local test outputs. No synthetic completion or replacement oscillator is used.
The [current full Easy campaign](runtime-campaign.md) has also been replayed
against this adapter with sound disabled. Its complete route does not substitute
for these actual-audio checks.

The real-clock flight acceptance chooses the visible Travel item with at most12
explicit makes, recording every attempt in its `audio-boundary` attachment.
This is a closed-loop browser interaction scenario, not a fixed-input campaign
regression. It checks days7/13 after the two bank trips; opening RNG poll counts
are allowed to differ with real startup timing and are not asserted as replay
seeds. The destination redraw can flush brief makes, a remaining input/timing
investigation recorded separately from the sound result. Audio sample frames,
engine acknowledgements and cue completion are never synthesized to get through
this route. The strict command rejects absent/skipped/retried/unfinished cases,
and tests its report checker by deleting all cases, marking one skipped and
removing a result in temporary copies.

`reference/speaker-playback-current.json` pins the current accepted local report, both audio
boundary attachments and the exact tested source inventory. Verify this saved
receipt with `node scripts/verify-speaker-playback-receipt.js`; missing originals
or local evidence require setup and cannot count as a pass. Re-running
`npm run verify:speaker-game` creates a fresh local receipt without modifying the
registered evidence or historical campaign artifacts.

The earlier `reference/speaker-playback.json` remains untouched historical evidence
for its original command/source configuration. The current receipt is a separate
fresh seven-case browser run after current campaign command integration.
