# Original cave background loading

The natural first Carlsbad room background load takes85 resident timer counts,
about1166.880ms on the supported reference configuration. Unknown counter phase
brackets the debugger-bounded call by84..86 periods. This is conditional native
evidence,not a fixed delay or a port timing input.

[Manifest](../reference/cave-background-load-native.json) pins222 local artifacts
from `.local/cave-background-load-native-01`,capture source `c42664e`. The original
22-file build launches fresh,read-only,through security,map45/68,ordinary nonracing
flight/crash and actual cave entry. No measurement controls are added. The prior
four flight events must finish. No game memory,CPU state or destination is patched.

The capture stops before overlay0595 and after059a. Stack arguments identify
resource0 and the actual RAM surface descriptor from DS203a. The complete cave
body,64 caller bytes and585 resident loader bytes match original relocated code.
The descriptor is40-byte stride,200 rows,8000 bytes/plane. All32000 native bytes
match the four independently decoded original color planes exactly;picture mode
does not generate a sprite opacity plane. The actual returned decoder mode is1.
The source converter's222 bytes match the original resident. Live nested decoder
code/IRQ/allocator/file-I/O traces are not retained by this recipe.

Normal core3000 cycles/ms,svga_s3,16MiB and vmem_delay off are checked. Source
archive,original hashes and actual emulator binary are pinned. The owned emulator
closes with return0 and leaves HOME/shared session unchanged. Three negatives
reject changed planar output,changed clock delta and incomplete prior inputs.

```sh
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-security.py \
 --cave-page-observer --cave-loader-profile --cave-loader-resource=background0 \
 --port 8404 --output .local/cave-background-load-native-FRESH
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_loader_profile.py --manifest=reference/cave-background-load-native.json
```

Missing/corrupt fixtures,zero declared cases,wrong call/arguments/code,unfinished
inputs or an unclosed process fail. Debugger stops discard CPU budget;these clock
counts include original DOS/interrupt/device work and do not establish exact
uninterrupted CPU phase or browser timing. The work model must count original
operations instead of using85 as an input. The sprite10 reference remains separate
and unchanged.
