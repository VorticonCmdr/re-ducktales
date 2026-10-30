# Complete Easy campaign after formatter/text timing

This scenario is `reference/jungle-text-campaign.json`. It uses a fresh actual
browser playthrough from startup, with no recorded prefix or memory restore.
Its independent input stream contains4,981 DOM events and34 complete state/pixel
checkpoints. The carried simulation checks1,470 flight presentations. The route
visits all four expedition families, banks$14,550 against$12,500 on day31, wins,
keeps all three mountain lives and restarts. Audio is disabled in this scenario;
actual sound-device acceptance remains separate. Original whole-campaign cadence,
arbitrary routes and complete Hard campaigns are not established by this result.

## Provenance and comparison

Producer source`8425dea` is archived in
`.local/jungle-text-campaign-producer-01/`. The player uses real keyboard/pointer
adapters and the declared authored physical policy. All764 mountain actions
complete. Its deliberate failed-test sentinel means exploratory capture, never
acceptance; the wrapper recognizes it only with a complete route and no observer
error. Raw `completed:false` remains intact. The owned registered environment's
`completed:true` means a complete input stream is ready for independent replay,
not that the producer passed acceptance.

The producer's785-file Git archive, source inventory, capture tool, log, raw
artifacts and status are pinned. The independent consumer at`a9ded04` has its own787-file Git archive
and tool identity; its fresh actual-browser run passes all34 checkpoints,4,981
inputs,the winning ending and Restart. Producer/consumer complete `src/` inventories must be identical;
current source must match them with no missing/extra file. Each archive is checked
against its actual Git revision and file inventory. Capture/replay tool hashes
must match those archived sources. The private pending contract is immutable
through browser admission. Missing source history or local artifacts is a setup
failure. Proprietary traces/images/archives remain ignored locally.

Unlike the prior35-point line-timing scenario, this fresh run has no duplicate
mountain-entry observation. It retains all34 unique boundaries in the same order;
no unique checkpoint is omitted. The first three startup/flight/arrival states,
pixels,timestamps and event counts remain exact. The first state difference at
jungle sample80 is solely five new text-work metadata fields. First timestamp
change is sample240,40ms later. Event counts at every boundary remain unchanged.
One later fourth-flight departure observation has different pixels: old
`clearing-page` versus new first wipe band, following the shifted device phase.
The new complete state and pixels are independently checked exactly, without
state/timer/RNG/pixel exclusions or fitted inputs. The final winning ending is
unchanged.

## Reproduce

From clean committed source, create a fresh exploratory capture:

```sh
python3 scripts/capture-easy-campaign.py --output=.local/new-text-campaign-capture
python3 scripts/register-jungle-text-campaign.py --producer=.local/new-text-campaign-capture --output=.local/new-text-campaign
node scripts/replay-hard-campaign.js .local/new-text-campaign --manifest=.local/new-text-campaign/pending-contract.json
python3 scripts/capture-runtime-campaign.py --output=.local/new-text-campaign-consumer --manifest=.local/new-text-campaign/pending-contract.json
python3 scripts/accept-jungle-text-campaign.py --pending=.local/new-text-campaign/pending-contract.json --comparison=.local/new-text-campaign-consumer --manifest=reference/new-text-campaign.json
```

Every output is new; tools refuse to overwrite existing capture/manifest roots.
The capture watchdog permits900 seconds of host time; strict browser replay
permits600. Neither timeout advances simulation time. The input-only recorded
replay starts at initial startup and carries its own state. Browser acceptance
compares all34 state/pixel checkpoints and all4,981 actual DOM events, checks for
rendering/diagnostic/navigation errors, then uses actual Restart and verifies fresh
state. No original emulator or machine checkpoint is used in this port regression.

`register-jungle-text-campaign.py` creates a pending contract only for a complete,
error-free, fresh physical Easy route. `accept-jungle-text-campaign.py` publishes a
new manifest only after independent actual-browser completion; it cannot change
the captured inputs/expected checkpoints. Headless, browser and native evidence
remain separate scopes.

## Current acceptance commands

```sh
npm run verify:current-campaign
npm run verify:runtime-campaign
# Additionally repeat the whole positive browser route:
node scripts/verify-runtime-campaign.js --fresh-browser
```

The combined gate checks22 exact originals,180 unit cases,native text/formatter
and speaker evidence,registered7-case actual sound acceptance,both long jungle
component routes with17 failure controls,34 carried campaign checkpoints and the
source-pinned independent whole-browser pass. It also freshly runs jungle
walking/Pause/cancelled Quit and three browser failure controls: missing campaign
confirmation,zero drawing deadline and omitted HUD work. Five fixture failure
controls and three carried-replay controls complete the nine campaign controls.
Production build is required. Missing/corrupt fixtures,zero/skipped/retried cases,
unfinished streams,unconsumed required events,unsupported behavior and differences
outside the documented pointer normalization rules all fail strictly.

The combined current-build gate passes at clean `a54c8ec`. Its 790-file archive,
53 evidence artifacts and 1,005 protected historical artifacts are pinned in the
[combined record](../reference/jungle-text-campaign-integration.json). The gate
validates the registered complete browser consumer and freshly runs the smaller
browser controls; it does not claim another whole positive browser run. Recheck
that saved result with `node scripts/verify-jungle-text-campaign-receipt.js`.
That checker also rejects empty/checksum-corrupt receipt evidence. Metadata/docs
updates do not relabel the archived gate source.
