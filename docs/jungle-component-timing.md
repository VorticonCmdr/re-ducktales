# Jungle component timing migration

The drawing-time change does not replace the historical expectations in
`reference/jungle-runtime.json` or `reference/jungle-treasure.json`. The verifier
first reproduces both with the historical Jungle class from Git revision
`c406dc4fe1ad8e28283de327dbc54588faa958a6`. All 18 modules in that class's import
graph are identified; every shared dependency must remain byte-identical to
that revision. Only the historical Jungle class is loaded separately, with
relative imports resolved to those checked dependencies. No alternate checkout,
guest-memory restore or new emulator is involved.

Both historical replays must match all 40 original port checkpoints, their full
DS/payload hashes, final states and exact clock counts. Treasure also retains
its final full-memory hash. Those expected values remain port regression data;
they are not original DOS whole-level captures.

| Scenario | Inputs | Publications | Historical clock events | Drawing-time clock events |
| --- | ---: | ---: | ---: | ---: |
| Failure after fish travel | 824 | 875 | 6,405 | 9,187 |
| Treasure success | 792 | 839 | 6,026 | 8,795 |

The new contracts are `reference/jungle-component-drawing-time.json` and
`reference/jungle-treasure-drawing-time.json`. Their initial expected timing
outputs were produced by committed source `3366651`; they are never consumed as
inputs. Both replays start from original static executable/archive data, zero
BSS, their unchanged authored campaign arguments and input sequences. Driver
and retrace events use independent zero-phase providers, with driver-first ties.
No expected state, final timer, image or fitted value chooses an input or clock.

## Comparison boundaries

An after-input observation can land before the new drawing wait completes but
after the old instantaneous drawing has already flipped the page. These are
different program positions. Masking the page selector would hide that mismatch.
Instead, the checker observes every source `readInput` boundary and the final
outcome. At those matching boundaries, all 65,536 DS bytes compare exactly
except the three timer words:

- `2221..2224`: the resident wait base;
- `2225..2228`: the current resident driver counter;
- `27f8..27fb`: the next input-loop deadline.

These fields are separately checked by exact new timer-trace digests, twenty
new timing checkpoints per scenario, and final timer values. RNG begins at
`2229` and is fully compared. Page selectors, descriptor contents, dirty lists,
entity state and all other memory remain exact. All forty gameplay snapshots
and final gameplay values remain unchanged.

All 1,714 presentation payloads, overlay/replace modes and wipe tokens compare
exactly in publication order. Their separate timing-trace digests are exact.
The observer intercepts each source publication counter increment, including a
finished page and the first wipe band published within one clock event. It does
not discard either image or accept a counter jump. The constructor's initial
wipe is observed at time zero. These are payload comparisons, including alpha
wipe masks; browser canvas acceptance and original scanout are separate evidence.

## Verification

Run `npm run verify:jungle-core` for the retained original map/routine/pixel
comparisons, both migrated component scenarios and the independent Python map
oracle. Run `npm run verify:jungle-draw-timing` to additionally check drawing work,
unit tests, actual browser controls, the full fixed-input treasure route, both
browser negative controls, strict source receipts and the production build.
`npm run verify:jungle` still includes the older office-era source receipts;
those and the broader shared-runtime guard need a separate migration.

Seventeen added negative controls reject missing Fire/climb, changed RNG/page
bytes, changed timer values, a changed image, missing input/checkpoint data and
unconsumed input. Original native initialization/contact/return negative controls
remain connected. Missing source history, originals or required local original
captures fail explicitly; corrupt parent fixtures, runtime sources or declared
counts fail. The old contracts are never overwritten.

The checker is `scripts/verify-jungle-component-timing.js`; the narrow replay
observer is `scripts/jungle-component-replay.js`. The declaration tool writes new
files only, requires a clean committed producer and runs original drawing-work
checks first. Re-declaring an existing fixture fails. It is an authoring tool,
not an acceptance shortcut.

This migration proves that the scoped timing change preserves these two port
routes. It does not prove original whole-level timing/scanout parity or arbitrary
route finishability. Line, text and remaining CPU/device work are still omitted.
Cave and safari pacing remain separate work.


The expanded combined gate passed on `f6d0f05`, including all 127 unit cases,
two browser cases, both browser negatives, the independent map oracle and
production build. The [migration receipt](../reference/jungle-component-migration.json)
pins its 620-file source archive, runner/log, both old and new contracts, fresh
negative logs and separate broader failures. It verifies that both historical
fixtures and the earlier saved negative logs remain byte-identical. Runtime and
browser code are unchanged from the prior accepted jungle pacing milestone.
