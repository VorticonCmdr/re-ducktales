# Safari HUD drawing work

The current Safari implementation charges the four border-line calls and the
resident numeric film formatter before continuing its existing background work.
Original overlay7 helper00b2..0143 calls horizontal2000 twice,vertical1ffc twice,
two or three sprites,then resident11c4:0227 with signed byte5d2a,right edge300,
Y183,color15,height8 and right alignment. The146 helper bytes are part of the
existing1293-byte original/prepared/Ghidra proof and complete7924-byte live-body
comparison. A fresh explicit PHOTOGRAPHY_CODE.EXE query confirmed those bytes.
The prepared analysis executable is never run.

The existing16 original native formatter traces match the production formatter
instruction-for-instruction,including all800 port writes. In particular,-1
formats as `/`,not `-1`. The scene now preserves that quirk. The current source
plans exercise film-1..12 both before and after the optional HUD sprite:28 cases.
The existing32-case original line-primitive comparison remains required.

At the declared normal-core3000 cycles/ms profile,HUD work is1038 instructions/
42 OUTs for film-1,1019/42 for0..9 and1251/58 for10..12,with zero surface offset
and the captured page flag0. This adds0.374,0.368 or0.456ms per background group.
The production path reads its own film,surface offset and page flag. Original
native entry and all11 retained animation passes have scale0,page flag0 and
surface offset0. This small correction is not a solution to overall expedition
speed. Other caller/IRQ/resource/result-sheet work and end-of-slice I/O effects
remain outside the partial model. No timer multiplier or fitted deadline is used.

All22 carried component scenarios preserve899 input-boundary memories except the
same12 declared clock bytes,all locals/gameplay and2234 ordered images/modes/wipe
tokens. New clock outputs live in `reference/photography-hud-drawing-time.json`;
the old timing manifest is unchanged. The historical component loader now loads
its complete archived dependency graph instead of silently importing current
shared rendering code. Expected clocks never supply replay inputs.

The actual browser route exercises a target photograph,all12 shots,results,
campaign return,duplicate collected notice,real speaker status/completion and
Restart. The input route checks shutter work,Pause,quit cancellation and sound
controls. Browser assertions require1251/58 at the first shot's background group;
a temporary HUD-only work omission must fail that assertion. Screenshot outputs
use each run's own directory. Actual speech uses an explicitly conditional
host20ms/Game16ms profile;no audio status is injected and no native waveform or
whole-level elapsed-time parity is claimed.

The older browser test incorrectly observed HTML audio-file readyState/ended;
Web Audio does not assign such a URL. It now checks actual generated signal and
fresh `gameaudio` query/completion events. The conditional score-carry boundary
check supplies real award assets and waits through the current source-defined
reward publication,without changing its expected money/day/ownership results.
These are test-infrastructure corrections,not game-mechanic substitutions.

```sh
# Clean source,matching original files and retained local evidence required.
# Each output directory must be fresh;any failed required check exits nonzero.
node scripts/verify-photography-hud-acceptance.js --output=.local/safari-hud-acceptance-FRESH
# Focused source/native and22-scenario checks:
node scripts/verify-photography-hud-work.js
node scripts/verify-photography-runtime.js
```

The combined runner requires eight successful steps:original comparison,HUD
source/native proof,runtime/component regression,218 units,two browser cases,
whole-work and HUD-only browser negatives,and production build. It archives the
clean source and checks loaded files again at completion. Missing/corrupt local
artifacts,zero cases,unfinished input sequences and unsupported work fail setup
or comparison. This is a scoped Safari admission;full campaign acceptance must
be refreshed for the changed runtime before claiming it on this build.

The combined clean-source run passes at83a1748. Its source archive,eight logs,
result and browser images are pinned by [the admission receipt](../reference/photography-hud-acceptance.json).
All218 units and both browser negatives finish with no skipped required cases.
