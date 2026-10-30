# Full Easy campaign with mountain copy/HUD/phase work

`reference/mountain-phase-campaign.json` registers a fresh actual-browser route
and independent replay. It visits jungle, Safari, cave and mountain; returns and
banks rewards; runs rival reports; wins on day31 with$14,550 against$12,500; keeps
all three mountain lives; and verifies Restart. This is complete-route port
regression evidence, not native whole-campaign or speed parity. Hard is deferred.

## Independent producer and consumers

Both actual browser source archives are from `5d21932`, with829 files each.
The producer starts from initial startup, with no prefix, fitted timer or memory
restore. Its player explores using actual keyboard/pointer actions. Its deliberate
failed-test sentinel marks exploratory capture, not passing acceptance.

The input-only registered stream has34 complete state/320×200 RGBA checkpoints
and4,981 DOM events, in separate files. Pending-contract SHA-256 is
`d7de26770434e938311e481a8d625d4e38767adf78dcb22e804ee5b08f224772`.
Independent headless replay initializes its own state and carries it through all
34 checkpoints, all events and1,470 flight presentations, with zero flag aliases.
The independent actual-browser replay then consumes the same frozen inputs;
all checkpoints match exactly, no required event remains, and Restart clears the
campaign. It never calls the exploratory player or derives inputs from results.

Local roots, all ignored and preserved:

- `.local/mountain-phase-campaign-producer-01/`: original exploratory capture.
- `.local/mountain-phase-campaign-01/`: registered input/expectation files.
- `.local/mountain-phase-campaign-headless-01/`: independent replay result.
- `.local/mountain-phase-campaign-consumer-01/`: actual browser comparison.

The22-file original pairing remains authoritative in ignored `game/`. BIOS seed0,
audio disabled, clock origin1 and8ms display callbacks are explicit replay
environment inputs. Separate source-pinned sound acceptance still covers actual
audio. Each archive, capture tool, runner/log, input/checkpoint file and accepted
browser artifact is pinned in the manifest. Missing/corrupt material fails setup.

## Scope of the changes

The first26 checkpoints match the prior text-inclusive campaign exactly. Mountain
entry is at the same311,789ms, with identical pixels but richer work diagnostics.
The new mountain return is348,569ms versus345,673ms previously. Later checkpoints
shift by2,896ms; ending is359,377ms. Event counts and checkpoint pixels remain
equal. The timing change is observed output from source work and scheduling, not
an injected delay. No state, timer, RNG or pixel fields are excluded to fit it.

The previous campaign manifest and its original data remain untouched. The new
scenario retains all34 unique boundaries and independent input provenance.

## Reproduction

From clean committed source, with original assets and required local evidence:

```sh
python3 scripts/capture-easy-campaign.py --output=.local/new-phase-producer
python3 scripts/register-mountain-phase-campaign.py --producer=.local/new-phase-producer --output=.local/new-phase-stream
node scripts/replay-hard-campaign.js .local/new-phase-stream --manifest=.local/new-phase-stream/pending-contract.json
python3 scripts/capture-runtime-campaign.py --output=.local/new-phase-consumer --manifest=.local/new-phase-stream/pending-contract.json
python3 scripts/accept-mountain-phase-campaign.py --pending=.local/new-phase-stream/pending-contract.json --comparison=.local/new-phase-consumer --manifest=reference/new-phase-campaign.json
npm run verify:current-campaign
```

New directories/manifests are required; tools refuse to overwrite captures.
The producer's900s and replay's600s browser watchdogs bound host execution, never
supply game time. The final command defaults to the registered current scenario;
use `node scripts/verify-runtime-campaign.js --manifest=reference/new-phase-campaign.json`
to verify an additional independently accepted scenario.

The combined gate also checks native primitives/callers, both long jungle
component routes, all186 units, fixture/replay failure controls, actual jungle
controls/omissions, the clean mountain phase gate with four actual browser
omissions and production build. Default uses the registered complete positive
browser receipt; `--fresh-browser` repeats that full route too. A passing combined
record must be saved separately from the exploratory capture and positive replay.

Remaining work includes original whole-game cadence, omitted CPU/device/drawing
work, broader routes/difficulties, keyboard/environment behavior and original
save/high-score semantics. This complete Easy route does not prove those paths.
