# Recorded Easy jungle entry through security

The jungle input scenario now starts from verified originals, skips the opening,
accepts Easy, answers original security with fixed Right/Fire, makes two actual
bank/office trips and flies/crashes/repairs into Okeefadokie. No seed, memory,
allocator state or output-derived input is injected.

The independent external stream contains50 DOM events with recorded timestamps.
One complete Game-state checkpoint at jungle entry matches exactly, with all74
flight presentations rendered and zero flag aliases. Strict replay has no fitted
timer or exploratory tail and requires every event to be consumed, all physical
keys released and an empty pending input queue. Its explicit endpoint is jungle
entry, not a complete campaign.

A fresh browser then matches both the full entry-state hash and all320x200
pixels before exercising the unchanged global-key deferral, pause/frozen pixels,
continuing clocks, quit cancellation and sound toggle assertions. That complete
browser case passes. The new route enters on day16 with briefing seed3824 and
jungle seed14769. The old day4/30127/44031 port expectations remain available in
Git history; the native conditional fixtures are unchanged.

## Capture and replay boundary

`tests/browser/helpers/entry-recording.js` observes actual DOM events in capture
phase before the application handler. Inputs and observation times are stored
separately from the expected Game state and pixel checksum. Capture mode stops
with an explicit exploratory error; it cannot satisfy browser acceptance.

The first exploratory capture advanced its test clock while original resources
were still loading. That gave it an invalid declared scheduler origin, and its
independent replay failed. Capture02 freezes time until the application's actions
are visible. This fixes the environment boundary; it does not fit an in-game
timer or reseed the game. Capture01 is excluded from acceptance.

`scripts/replay-hard-campaign.js` now accepts the explicit `jungle-entry` milestone
and declared Easy difficulty. Existing Hard defaults still require an ending
and the supported flag alias. The full Hard scenario was revalidated:28 exact
state checkpoints,4140 events,1629 flight presentations,one alias and all five
existing verifier negatives. Historical capture and browser producer identities
are preserved; only the current replay-tool revision changed.

## Evidence and reproduction

The [manifest](../reference/security-jungle-entry.json) records the build, input
recipe, artifact checksums and exact comparison requirements. The supported
originals and required private artifacts must be installed.

```
node scripts/replay-hard-campaign.js .local/security-jungle-entry-accepted-02 --manifest=reference/security-jungle-entry.json
npx playwright test tests/browser/jungle-input.spec.js
npm run verify:security-jungle-entry
```

Capture producer673f245 is archived under `.local/security-jungle-entry-02/`.
Accepted prefix artifacts and fresh-browser receipts are under
`.local/security-jungle-entry-accepted-02/`. Changing a security input, an expected
state hash or the checkpoint count is rejected. These are carried port and
independent browser comparisons, not original whole-jungle timing evidence.
Runtime remains9cfc0a3. Main and old campaign recordings remain unchanged; the
remaining recordings and full integration gate are still pending.

The focused npm command verifies all required artifacts,124 exact archived/Git
capture sources and125 exact fresh-browser producer sources, then replays all
inputs and checks three negative controls. It also runs the current browser case
and the actual missing-Right security browser negative. The prefix verifier is
now required by `npm run verify:jungle`, so missing/corrupt fixtures,zero/missing
checkpoints,unconsumed events,unsupported rendering and absent browser acceptance
fail the normal gate. It does not reinterpret exploratory captures as acceptance.
Separate setup negatives temporarily removed and corrupted the derived entry
PNG. Both were rejected at the required missing/corrupt fixture checks; the
original checksum was restored and the positive verifier passed again. Their
recipe and logs are in `.local/security-jungle-entry-verification/`.
