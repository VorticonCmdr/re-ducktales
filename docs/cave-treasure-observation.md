# Natural original cave treasure observation

The fresh original Carlsbad route on source6a4a8cc reaches goal room19 from45
through37,29,21,13,12,11. Each of seven moves uses an independent four-event
physical key schedule:direction/Fire make at relative frame0,both releases at10.
All28 events finish. Fourteen post-reader09a6 observations retain the actual
neutral/directional bytes and native room state;no game memory is patched.

This is a debugger-bounded component experiment. It begins with the normal fresh
security/map/flight setup,then pauses at each reader and six treasure boundaries.
No memory restore is used;the DS dumps are observations,not machine checkpoints.
It reuses the existing owned portable launcher on private8404,normal core3000,
svga_s3/16MiB/vmem_delay off. HOME and the user's shared emulator are unchanged.
The process closes with return0. The prior01 attempt failed the clean-source
setup check on a generated Python cache before launching;it is excluded.

The native treasure-entry seed is33638. The six later source checkpoints match
the translated16-bit RNG from that incoming seed at exactly0/0/1/2/5/15 draws:

| Native source boundary | Draws | Seed | Phase flag546a |
| --- | ---: | ---: | ---: |
| Before wipe16fb | 0 | 33638 | 1 |
| After background170b | 0 | 33638 | 1 |
| Before first reveal173d | 1 | 49845 | 1 |
| Before second flip1770 | 2 | 43679 | 1 |
| Celebration loop17de | 5 | 33840 | 2 |
| After ten-frame loop1827 | 15 | 46476 | 2 |

The draw counts come from the independently checked original2/3/10 party-call
structure,not a search over the final seed. Expected outputs do not generate the
hardware schedules. The complete11054-byte live cave overlay matches the original
after196 load relocations. Source371bytes/144 instructions and all22 original
asset identities are checked. [Source rule](cave-treasure-order.md).

[Manifest](../reference/cave-treasure-observation.json) pins244 local artifacts,
source archive,engine identity,configuration and capture recipe. The strict
checker requires every declared artifact,event,read and checkpoint and verifies
owned shutdown. Three negatives remove an input,change an ending seed or remove
a checkpoint and must fail. Missing/corrupt local fixtures fail setup.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_treasure_observation.py
# Fresh source-pinned capture;use a new ignored output directory:
PYTHONDONTWRITEBYTECODE=1 DUCKTALES_DOSBOX_MCP_ROOT=/Users/valentin.pletzer/projects/emulator/dosbox-mcp \
 /Users/valentin.pletzer/projects/emulator/dosbox-mcp/.venv/bin/python scripts/capture-security.py \
 --cave-page-observer --cave-treasure-profile --port 8404 --output .local/cave-treasure-native-FRESH
```

Raw PNGs are retained as exploratory observations. Cached VGA refresh alignment
at debugger stops is unverified;there is no pixel exclusion or pixel-acceptance
claim. Debugger stops alter CPU budget,so these observations do not establish
uninterrupted elapsed-time,device-completion timing,whole-expedition native/port
replay or browser acceptance. The separate current browser campaign remains on
its own fixed source while this experiment is isolated.
