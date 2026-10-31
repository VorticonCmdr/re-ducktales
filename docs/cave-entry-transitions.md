# Cave entry transition restoration evidence

Normal cave entry still omits original wipes and a striped room reveal. The
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
roles. Current `Cave.enter()` instead uses two ordinary presentations,and the
initial/room wipes are absent.

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
This is source evidence with runtime restoration pending. Next:restore the page
operations at these original boundaries together with counted loading,keep input
polling/RNG separate,and verify all five actual browser publications and waits.
Review cache reconstruction versus original draw-call placement during that
integration;renderer reconstruction must not charge extra original work.
