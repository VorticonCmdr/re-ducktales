# Focused jungle and mountain routes after destination timing

These are port/browser regressions for the supported 22-file build in
[build.json](../reference/build.json). They retain the historical office-era
contracts and their input/output artifacts. They do not establish native
whole-level parity or a passing full `npm run verify` gate.

The refreshed routes wait for the destination's actual ready state before
choosing Travel. No incoming event is moved to a later time during replay, and
no global tick, field or image region is excluded from comparison.

| Contract | Checkpoints | DOM events | Activity samples | Outcome |
| --- | ---: | ---: | ---: | --- |
| [Jungle entry](../reference/destination-jungle-entry.json) | 1 | 50 | 0 | Day 16, seed 14769, entry with three lives |
| [Jungle treasure](../reference/destination-jungle-treasure.json) | 27 | 70 | 860 | Day 17, $1,050, treasure claimed, one life |
| [Mountain summit](../reference/destination-mountain-ascent.json) | 27 | 104 | 764 | Day 17, $8,100, treasure claimed, three lives |

The treasure routes return through the real application to their duplicate
collection notices and back to the map. The mountain route also exercises two
Glomgold reports and checks the original portrait's left 128 columns. That
portrait comparison does not cover the full native report screen.

The original authored movement profiles remain byte-identical. Their earlier
conditional planning provenance remains in the input-profile files, including
the jungle's previously chosen three-neutral-sample prefix. This migration adds
no fitted timer, seed, allocator state or output-derived environment input.
All replays start at application startup with the explicit BIOS-0 and muted
audio providers. Their external timestamps, keys and pointer inputs are separate
from expected states and pixel hashes.

The mountain capture is source `581b3ba`, 577 archived files. It completes all
27 observations with the same reward, lives and final mountain RNG as the prior
route. Its entry occurs at 24,749ms. The captured entry snapshot reports 79 flight
presentations; the independent Game replay confirms all 79. The jungle prefix
has 74. Copying 74 into the new mountain contract initially failed this count;
only that mistakenly copied metadata was corrected, with captured inputs and
states unchanged.

Raw exploration deliberately ends with an `EXPLORATORY ... not acceptance`
error and `environment.completed:false`. Accepted directories contain a separate
declaration of the completed stream, with the raw environment hash. Inputs,
checkpoints and timeline are copied exactly. Browser acceptance is a subsequent
fresh fixed-input run with every checkpoint and event required. Manifests pin
raw/declared files, original build, capture/browser Git ZIP archives, complete
source inventories, runner/report, actual replay events/states and negative logs.
Missing local evidence is an explicit setup failure.

## Verification

```sh
npm run verify:destination-routes-core
npm run verify:destination-routes
```

The core checks retained browser receipts and current runtime identities, then
replays all three streams independently through Game. Full snapshots and browser
320×200 RGBA hashes are exact. Pointer coordinates are normalized only at the
existing integer clamp/truncation consumption boundary. No presentation tolerance,
checkpoint exclusion, injected state or diagnostic tail is allowed.

The full command additionally runs five real-browser cases: natural jungle
pause/quit, natural jungle treasure, fixed jungle replay, natural mountain summit
and fixed mountain replay. It then removes required real movement inputs in
separate browser runs; the intended state mismatch must occur, without setup
errors, browser timeouts, skips or unfinished test runs masquerading as success.
The historical verifiers and their broader integration gate remain intact.

Fifteen separate setup/fixture negative checks (five per contract) reject missing
and corrupt inputs, shortened input sequences, a skipped browser case and zero
checkpoints. Additional in-memory checker controls reject removed browser suites,
failed test results, altered case counts, missing carried checkpoints and missing
consumed inputs. Original fixture files are never edited for these controls.

## Capture recipe

Start from a clean committed worktree with the verified originals in ignored
`game/`. Save the Git ZIP and each file's SHA-256 before launching. Use the
isolated campaign server configuration: one worker, port 5212, source worktree as
server cwd, watch/HMR disabled and an independent output directory.

```sh
DUCKTALES_CAPTURE_MOUNTAIN_ASCENT=.local/new-mountain-capture/raw npx playwright test tests/browser/mountain-ascent.spec.js --config playwright.campaign.config.js
```

Expect the explicit exploratory error after `complete-map`; any other failure is
incomplete evidence. Keep the JSON report, full log, runner exit code and source
archive. Declare a new manifest and separate complete contract only after all
27 checkpoints, 104 events, 764 samples, both reports and duplicate notice finish.
Never mark the raw exploration accepted. Replay the declared stream using:

```sh
node scripts/replay-hard-campaign.js .local/new-mountain-contract --manifest=reference/new-mountain-contract.json
DUCKTALES_MOUNTAIN_ASCENT_MANIFEST=reference/new-mountain-contract.json npx playwright test tests/browser/mountain-ascent-replay.spec.js --config playwright.campaign.config.js
```

The fixed browser adapter permits a declared complete contract awaiting its first
browser replay, while retaining every actual event/state/pixel/completion check.
Only successful independent replay can set `browserVerified:true`.
