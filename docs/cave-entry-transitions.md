# Cave entry transition restoration evidence

Normal cave entry now restores the original wipes and striped room reveal. The
existing striped treasure reveal is a different call site and remains implemented.
Restoring asset loading alone will not reproduce the room-entry sequence.

[Source manifest](../reference/cave-entry-transition-source.json) pins602 original
bytes/221 contiguous instructions from explicit Ghidra programs `CAVE_CODE.EXE`
and `ducktales-ega-driver.bin`. Cave code is checked after its source relocation
to analysis bias1000. The retained natural cave first-input snapshot resolves
DS1fe0 to EGA0155 and DS1fdc to EGA0101;all175 live helper bytes match the decoded
original driver. Original executable/assets and parent native capture are checked.

The original Main calls initial wipe at0491 after minimap setup. On each room
entry,it calls another wipe at057e,loads background0 at0595,presents the first
room page through1fd4 at05e9,then uses1fdc at0638 for the second room page. That
second operation copies striped rows into the visible page without swapping page
roles. The restored `Cave.enter()` uses the first ordinary presentation and second
striped reveal. `run()` performs the initial wipe;`enter()` performs the room wipe.

Both EGA helpers step the starting row by40 bytes through five bands. Each band
processes forty rows spaced five rows apart,then calls the existing retrace wait
five times. Thus each wipe/reveal consumes25 retraces. The initial double wipe
is preserved source behavior even though the second wipe may start from black.
The byte proof establishes control flow and the declared waits,not exact scanout
or instruction timestamps. Ghidra's reversed MOV segment-register operand text
is not used as authority;actual opcodes are checked.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_entry_transition_source.py
```

Missing/corrupt source/native evidence,an instruction gap or wrong live vector
fails. Two negative controls reject altered call bytes and a missing instruction.
The manifest's `runtimeImplemented:false` records its original source-only capture
scope;the runtime restoration is subsequent work. The renderer preserves the
incoming screen behind transparent wipe rows,without feeding pixels into logic.
`tests/cave-timing.test.js` checks50 initial wipe retraces,ten publications,and all
five reveal groups/25 retraces without page swaps,input or memory/RNG changes.
The existing actual browser input scenario passes in
`.local/cave-entry-transitions-browser-01` (45.2s). All218 units and build pass.
The previous full-campaign acceptance rejects changed runtime hashes and remains
historical. No original whole-cave timing parity is claimed.

Next:integrate counted loading and review cache reconstruction versus original
draw-call placement. Renderer reconstruction must not charge extra original work.

```sh
node --test tests/cave-timing.test.js
node scripts/verify-cave.js
node scripts/verify-cave-passage-order.js
npx playwright test tests/browser/cave-input.spec.js --config playwright.campaign.config.js --output=.local/cave-entry-transitions-browser-FRESH
```

The strict exploratory native probe still exits1. After restoration,entry-flag
clear moves from1.883s to2.583s relative to first input,and the50 reward from3.667s
to4.366s. Native entry clear is5.422..5.436s and cash remains0 at6.834s.
First-input fields still match. Sprite/background loading and excess normal-loop
composition remain open;these observed deltas are outputs,never delay inputs.
