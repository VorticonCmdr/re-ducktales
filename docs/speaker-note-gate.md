# Original note gate counter restoration

The original PC-speaker note path066c/0671 skips the write to026b when the
gate multiplier026a is0. The previous counter survives an ungated note. The
port previously wrote0 unconditionally. It now follows the original branch.
No movement timer or sound duration is fitted to produce this change.

[Native declaration](../reference/speaker-note-gate-native.json) pins three
conditional cases from `.local/speaker-note-gate-native-01`,capture3ba9799.
Independent inputs are [versioned separately](../reference/speaker-note-gate-inputs.json).
Our small DOS COM wrapper executes an unchanged original IT.DRV resource5 copy.
It supplies mutable note/tempo/gate inputs,calls05ac with IF clear,and copies
the entire7253-byte driver state after each case. Original files remain read-only.
The original note at0adc has duration1. There are no expected outputs in the
fixture program or input stream.

| Gate multiplier | Previous counter | Original result | Historical port result |
| --- | ---: | ---: | ---: |
|0|7|7|0|
|3|7|0|0|
|0|255|255|0|

The correction matches every one of7253 driver bytes in all three cases.
The prior implementation differs only at026b in the two disabled-gate cases.
The checker runs that historical implementation as a required negative control.
Two more controls remove an input or alter a native result. All reject.
The complete799-byte sequencer listing,297 instructions,is checked against the
original bytes;the original code in the native results is also unchanged.
The owned emulator closes0 without changing HOME or a shared session.

```sh
node scripts/verify-speaker-note-gate.js
node scripts/verify-speaker-engine.js
node --test tests/speaker-game.test.js
```

The existing12-case/408-IRQ native regression still matches all7253 driver bytes
and1128 port writes. Its original expected artifacts are unchanged;only its
current implementation hash is renewed. The three existing stream checks pass.
This new evidence is a conditional driver branch comparison,not natural IRQ
timing,physical waveform or whole-game/browser acceptance. Fresh browser audio
and whole-campaign replays remain required after the runtime change.

Campaign expected outputs now remain tied to their immutable producer archive.
A new consumer must execute the independent input stream and match every exact
state/image checkpoint,then match every current runtime/configuration hash.
Producer source need not equal consumer source;requiring that would force
rerecording goldens for every implementation change and defeat fixed regression
expectations. The unchanged strict consumer check correctly rejects the older
acceptance while this sound fix awaits its own full browser replay.
