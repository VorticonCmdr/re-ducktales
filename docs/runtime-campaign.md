# Complete Easy campaign on the persistent-speaker runtime

This scenario compares the existing independent4,981-event DOM stream with the
current archived browser runtime. It keeps the historical producer, expected
states, input timestamps and pixel hashes unchanged. The producer source and
current consumer source are separate artifacts; no new native-game parity or
newly captured expectations are claimed.

The route starts a fresh Easy campaign, completes jungle/Safari/cave/mountain,
collects locations1/30/31/32, banks$14,550 against$12,500 on day31, and restarts.
All34 full states and320x200 pixel digests must match. All1,470 flight
presentations are checked by the separate carried simulation replay. Audio is
disabled in this campaign scenario. Actual AudioWorklet behavior is covered by
[speaker playback](speaker-audio.md), not inferred from the silent route.

The current source comparison permits exactly four changed `src/game/` files
relative to the historical producer: browser audio dispatch, the shared device
adapter, and the speaker/Tandy wrappers. It checks every current `src/` file,
including new speaker modules, against the separately pinned runtime Git
archive. Missing/extra sources, corrupt inventories, altered expectations or
unavailable source revisions fail. It never updates hashes to accommodate
unexplained gameplay differences.

The capture recipe pins its own source, exact Git archive, loaded source
inventory, launch command, baseline manifest, original input/expected artifact
checksums, exit status and browser results. Loaded sources and historical
artifacts must remain unchanged during execution. It does not restore memory,
fit timers, inject state/audio completions or derive input from expected state.
There is no emulator state or native checkpoint in this port-regression recipe.

```sh
npm run verify:current-campaign
# Same current gate:
npm run verify:runtime-campaign
# Also repeat the complete browser route in a fresh owned directory:
node scripts/verify-runtime-campaign.js --fresh-browser
```

The default gate validates the registered source-pinned complete browser pass,
reruns the carried simulation/negative controls and180 unit cases, checks the
native speaker fixture and registered actual-audio acceptance, and builds the
application. `--fresh-browser` additionally executes all4,981 DOM events again.
No historical artifact is overwritten. The nine campaign controls reject missing
producer/runtime archives, a corrupt ending image/runtime inventory, changed
historical ending, missing checkpoint, altered replay result, unfinished timeline
and an omitted actual browser confirmation. Seven cave controls remain separate.

Reproduce the independent browser comparison from a clean committed runtime:

```sh
python3 scripts/capture-runtime-campaign.py \
  --output=.local/runtime-campaign-new \
  --manifest=reference/cave-reveal-campaign.json
```

The output directory must be fresh. A new consumer scenario can be registered
only after that pass using `scripts/register-runtime-campaign.py`; it checks all
checkpoint identities and retains the baseline expectations verbatim. Missing
local originals/evidence fail explicitly. Full Hard campaigns, arbitrary-route
finishability, native whole-campaign cadence and physical speaker waveforms
remain unproven. Hard campaigns are deferred at the user's request.
