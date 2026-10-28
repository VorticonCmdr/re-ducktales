# Linked Hard campaign with the original difficulty menu

This is the historical menu-only main scenario. Its inputs and expected outputs
are preserved. The security development branch has a separately accepted
[security-aware campaign](hard-campaign-security.md); other branch regressions
and the full integration gate remain pending.


Build `dos-fb658562`, pinned by `reference/build.json`. The original-menu route
selects Hard, completes Bermuda jungle, Yellerstone photography, Klondike cave
and El Capitan mountain, banks its treasure and reaches the day33 losing ending:
19600 against44000. Collected-location flags are `[2,30,31,32]`. The fourth flight
crashes and follows the normal repair/arrival path; the route does not bypass it.

The new capture has3350 real DOM events and25 observations. Input values and
clock/observation metadata are stored separately from expected Game snapshots
and decoded320x200 pixel hashes. Strict browser replay chooses no inputs from
expected state and compares the actual submitted transcript. Canvas pointerdown
coordinates are compared as Campaign.point consumes them: truncated and clamped
logical pixels. Other coordinates remain diagnostic. There is no pixel tolerance.

`npm run test:hard-campaign` runs the strict real-input browser scenario.
`npm run verify:hard-campaign` checks every pinned artifact, a fresh carried Game
replay and the independent browser receipt, plus five data/comparison negatives
and a real missing-difficulty-key control. The latter must fail at checkpoint0,
not at setup or timeout. New captures retain a pending-receipt guard until an
independent browser replay succeeds. Missing/corrupt fixtures, incomplete inputs,
unsupported paths and missing checkpoints fail explicitly.

The original menu reveal, queued-key flush, seven-count reads and closing wipe
are allowed to run. Up is confirmed visibly before Enter. Hard flights use four
independent consumed-control streams through real keyboard events; see
[provenance and boundary checks](flight-input-boundaries.md). Their1177 values
were observed from the previous accepted port replay, not derived from final
actor/RNG results. Jungle444 and mountain671 authored samples retain their prior
actor/route checks. Mountain completes with three lives.

The restored timing exposes a normal Glomgold report before mountain return.
The route acknowledges it and adds a checkpoint; it does not skip or suppress it.
The final accounts and ownership remain the same. Public snapshots include
semantic state and input-read observations, not every private byte or reader
stack field. No original whole-campaign parity is claimed.

The current source is `reference/hard-campaign.json`. The new immutable source
capture is `.local/hard-campaign/accepted-menu-reference-05/`, with an85-file
producer/dependency identity record and one main-document navigation. The strict
independent browser receipt is `.local/hard-campaign/accepted-menu-browser-replay-01/`.
Both fresh Game and browser runs match all25 published-state checkpoints; browser
pixels match exactly. A full integration gate is still pending for this branch.

The previous verified main milestone is retained at commit57beb92, its version
of this manifest and `.local/hard-campaign/accepted-reference-09/`. It passed117
unit,70 development browser and2 production browser cases, plus its six Hard
negative controls. Its inputs/checkpoints are unchanged. Its exact initial
exploratory producer working tree was not archived; the subsequently accepted
replay code and receipts are pinned. That historical limitation is not attributed
to the newly recorded source snapshot.

An earlier exploratory menu run unexpectedly loaded a new title document and is
excluded. Current capture/replay code rejects unexpected document navigation and
preserves diagnostics; it never restores or silently retries game state. Explicit
capture mode (`DUCKTALES_CAPTURE_HARD_CAMPAIGN=1`) is exploratory. The earlier
`--diagnose` helper permits an incomplete stream and declared100ms tail and cannot
satisfy acceptance. Original hardware audio, elapsed pacing, arbitrary-route
finishability and full-game native parity remain separate work.

The menu-migrated campaign is now included in the accepted complete gate for
runtime cd1e4dd:117 unit,72 development and2 production browser cases, zero skips.
The integrationGate receipt in reference/hard-campaign.json pins the full log,
status files and runtime revision; earlier receipts remain historical. This
completes menu integration acceptance, not an original whole-campaign comparison.
