# Cave input-loop cache correction

The normal input loop now calls the party helper against the existing cached
room. It no longer composes the room on every input. Room entry and explicit
ending compositions retain their original separate calls.

[Source manifest](../reference/cave-cache-source.json) pins894 original bytes and
319 contiguous instructions from explicit Ghidra program `CAVE_CODE.EXE`,Main
09a6..0d24. Segmented instruction addresses are normalized to physical offsets;
all bytes match the original relocated overlay. The parent natural cave capture
checks the whole actual11054-byte overlay and its196 relocations.

Main09cf,0a0e and0a90 call party20b8 directly. There is no composition26bb call in
this loop. The party helper already restores the cached room and charges that
copy;the removed nested `scene()` was extra source work and reset room-overlay
descriptors unnecessarily. Renderer reconstruction is independent of this call
schedule. Changed-call and missing-instruction negatives must fail.

Exploratory neighboring Ghidra party/composition listings contained five-byte
analysis-only stack-probe replacements in their prologues. They are excluded from
this manifest and its byte claims. The loop listing itself has zero differences.
Prepared analysis images are never executed.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/verify_cave_cache_source.py
node scripts/verify-cave.js
node --test tests/cave-timing.test.js tests/expedition-keyboard.test.js
npx playwright test tests/browser/cave-input.spec.js --config playwright.campaign.config.js --output=.local/cave-cache-browser-FRESH
node scripts/probe-cave-native-cadence.js
```

The last command remains a strict exploratory failure,not acceptance. First-input
state matches,and the room-commit time now lies at256.827ms within the native
256.827..271.096ms bracket under the declared conditional providers. Other state
and timing differences remain. The probe now records its initial state at the
actual input-reader boundary,before synchronous party/RNG work in the same
callback;this prevents comparing post-read RNG against a pre-read checkpoint.
This is a capture-alignment correction,not an injected simulation value.

Source-counted loading is still not scheduled. The next step is to retain the
original packed resource bytes and charge decoding/conversion only at actual
load calls,including background and composition overlays. Initial preparation,
DOS/allocator/interrupt work and whole-level timing remain open. Full campaign
acceptance still belongs to the earlier runtime and must be refreshed.


Browser verification keeps the two entry compositions separate from ordinary
cached party drawing. The test now requires both room-work intervals to be
observable,then budgets ordinary input cadence using party work alone. An early
negative failed at a stale injection hook;another exposed a permissive aggregate
duration bound. Both are excluded. The repaired omitted-room negative03 fails at
the intended composition observation:expected2 intervals,actual0. Retained work
counters cannot satisfy this check by themselves.


Final positive02 passes in40.2s. The existing strict all-work negative verifier
passes with output root .local/cave-cache-skip-work-negative-02:all five current
graphics waits are bypassed and the actual composition observation fails. The
first all-work attempt had a stale three-versus-four hook expectation and is
excluded. No setup failure is counted as successful detection. Ordinary browser
controls,pause,room-entry key flush,rendering and Restart remain exercised by the
positive case. All218 units,focused native/component routes and build pass.

To rerun the strict negative:

```sh
DUCKTALES_CAVE_TIMING_VERIFICATION_ROOT=.local/cave-cache-negative-FRESH node scripts/verify-cave-timing-browser-negative.js
```
