# Complete Easy campaign after jungle line timing

The new scenario is `reference/jungle-line-campaign.json`. A fresh complete
physical-input stream is independently replayed from startup. All35 full states,
320x200 pixel digests and4,981 DOM events match; the carried simulation also
checks1,470 flight presentations. The game collects locations1/30/31/32, banks
$14,550 against$12,500 on day31, reaches the winning ending and restarts. Mountain
retains all three lives. Audio is disabled in this scenario; actual sound-device
acceptance remains separate.

This replaces no historical expectation. The first three startup/flight/arrival
checkpoints are byte-for-byte unchanged. At jungle sample80 the first difference
is the new drawing-work accounting; its time and pixels still match. The first
observed timestamp change is sample160,32ms later. Later observation phases can
also differ, so the new acceptance compares complete new state/pixel outputs
exactly rather than hiding timer, page or drawing differences.

The35-point sequence keeps a second mountain-entry marker at precisely the same
time, event count, state and pixels as arrival. Both markers are required. This
is an extra observation, not another gameplay boundary; no unique checkpoint
has been removed. Inputs and expected state remain separate artifacts. External
clock/event timestamps and observation alignment are recorded; no expected
actor/RNG/timer state supplies a game input.

## Provenance and experiment

The first fresh exploratory capture from`5e76ce2` reached mountain entry and253
actions before its600-second host watchdog expired. Its states kept progressing,
but it did not finish and is never acceptance. All raw data and the failed
status remain under `.local/jungle-line-campaign-producer-01/` and
`.local/jungle-line-campaign-exploration-01/`.

An owned projection retains only the first27 complete checkpoints and their
preceding DOM inputs. The truncated tail is not replayed. The next run replays
that prefix **from initial startup**, checking every state/pixel boundary, then
performs all764 mountain actions and completes banking/ending. No heap, timer,
RNG, allocator or machine memory is restored. The interrupted-source flag remains
explicit in the prefix record. The successful producer is
`.local/jungle-line-campaign-producer-02/`, source`54a89e0`, with its exact archive,
settings and runner source. Its deliberate exit1 sentinel still means
exploratory capture, not acceptance. Only the exploration watchdog increased to
900 seconds; strict replay retains600 seconds. Host watchdogs never advance game
time.

The owned registered environment's `completed:true` means its independent input
stream is complete and ready for replay. Raw producer `completed:false` and
`producerCompletedAcceptance:false` remain preserved. Browser acceptance was
pending until the separate current-source browser run completed.

The independent consumer is `.local/jungle-line-campaign-consumer-01/`, source
`b99d4fc`. Its actual browser run passes35 complete state/pixel checkpoints,
4,981 observed inputs and Restart. Producer, prefix and consumer game source
inventories match exactly. Each archive is checked against its declared Git
revision; current `src/` must match the complete producer inventory. Verifier
code is separately pinned and can evolve without relabeling a producer archive.
Proprietary images/traces/archives remain ignored locally.

## Commands

```sh
npm run verify:current-campaign
# Same focused current gate:
npm run verify:runtime-campaign
# Also repeat the complete positive browser route:
node scripts/verify-runtime-campaign.js --fresh-browser
node scripts/verify-current-campaign.js --manifest=reference/jungle-line-campaign.json
```

The gate requires22 exact originals,180 unit cases, the native speaker fixture,
registered actual-audio acceptance, both line-inclusive jungle component routes,
35 exact campaign checkpoints, the registered complete independent browser pass,
fresh jungle walking/Pause/Quit controls and browser failure controls, plus the
production build. No required case may be missing, skipped, retried or unfinished.
Five fixture controls reject missing producer/consumer archives, a corrupt ending
image/consumer inventory and changed independently replayed browser expectations.
Three carried-replay controls and one actual browser omission complete the nine
campaign controls. The actual jungle drawing-deadline control remains separate.

For a new exploratory capture from clean committed source, use a fresh output
folder (the optional prefix is local input-only evidence, not a memory restore):

```sh
python3 scripts/capture-easy-campaign.py --output=.local/new-easy-capture --prefix=.local/jungle-line-campaign-prefix-01 --through=all-recorded
```

Omit `--prefix` to play from startup without the recorded prefix. The capture
wrapper archives source and protects references. It recognizes the deliberately
failed exploration sentinel only when the route completed without observer
errors. It never admits a capture as acceptance. This reusable wrapper follows
the preserved producer recipe; the archived producer used its pinned local
runner. A new capture still needs declaration and independent replay.

`register-jungle-line-campaign.py` declares a new owned pending contract, refuses
overwrite and checks capture completion/provenance. `accept-jungle-line-campaign.py`
creates a new versioned manifest only after independent browser completion;
expected inputs/checkpoints cannot change during admission. Raw captures and
historical manifests are never rewritten. Missing local evidence or source
history is an explicit setup failure.

This is a closed-loop port regression and actual-browser campaign result. It is
not original whole-campaign/cadence parity or proof of arbitrary routes. Hard
campaigns remain deferred; resident/color/text and remaining CPU/device timing,
complete physical keyboard/BIOS behavior and physical sound fidelity still need
work.
