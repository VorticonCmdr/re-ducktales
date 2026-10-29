# Hard alternate expeditions through security

The current browser routes start with original opening/difficulty/office/security,
win the first race, complete the selected expedition with three lives, claim its
treasure, return to the map, deposit the proceeds, and restart. The destination
flags retain the original alternate layouts:

| Route | Layout | Expedition samples | Checkpoints | DOM events | Deposit |
|---|---:|---:|---:|---:|---:|
| Bermuda Triangle | Jungle1 |447 |34 |992 |2150 |
| Boola Boola | Jungle2 |421 |26 |984 |1150 |
| Thunderclap Mountain | Mountain1 |494 |46 |990 |2100 |
| Machu Picchu | Mountain2 |706 |63 |1004 |2700 |

Every deposit occurs on day6. All first flights use the carried security-aware
seed54124, raceRoll24, and finish in286 physics frames/396 presentations. No seed,
flight outcome, expedition actor state, device result or machine memory is injected.

The new public input catalog is `reference/security-hard-expedition-inputs.json`.
Bermuda adds three authored neutral samples before its unchanged444-sample route;
the other three original control streams are unchanged. The existing10..25 altitude,
heading1 flight policy supplies actual player keys. It reads only the current pose,
never expected snapshots. The separate strict replay reads the recorded timestamped
DOM events, not that controller. All old input and expected-result manifests remain
unchanged as historical evidence.

Evidence is separated by scope:

- Four independently replayed entry recordings each consume954 DOM events and
  match one complete Game snapshot and320×200 pixel hash. Browser replays pass4/4.
  They retain jungle variants1/2 and mountain variants1/2 with three lives.
- Full closed-loop Game replays carry all3970 DOM events through169 exact complete
  application snapshots and1584 validated flight presentations. Every required
  input is consumed, keys are released and scheduler queues are empty. No tail
  time, injected state, restored memory or fitted device inputs are used.
- Four fresh controller browser cases and four fixed-DOM browser cases pass8/8,
  with zero skips/retries/errors. All169 state and decoded RGBA hashes match.
  The controller also verifies restart clears money, deposits, claims and actors.
- The retained native routine/asset evidence remains scoped to its original
  build and segments. These new routes do not prove whole-native expedition,
  IRQ, keyboard typematic or elapsed-time parity.

The first horizontal key make is deliberately omitted in each route's negative
browser replay. A carried state mismatch or the strict external-event comparison
must reject it at an expedition checkpoint. A preliminary Right-only selector
failed setup on the left-only Thunderclap route; that run is excluded. The corrected
selector covers Left and Right. Setup errors, unsupported paths, timeouts, endpoint
failures and missing tests do not count as successful negative controls. The
shared missing-flight-turn check now rejects at consumption17; consumption18
belongs to the unchanged pre-security baseline.

Each route additionally rejects changed expected state, omitted checkpoints,
changed expected pixels and omitted browser checkpoints. Required missing/corrupt
fixtures fail explicitly. Original fixture bytes are restored before a positive
verification is required again. The default development behavior still stops on
unsupported paths; there is no recovery/demo substitute in these cases.

`reference/security-hard-expeditions.json` pins the supported original build,
case manifests, private artifact hashes, historical producers, current checker
hashes, positive browser reports and negative evidence. Capture producers are
1224c58 (entries) and d670ca5 (full routes); independent browser producers are
cff6dd1 and19ec334. Proprietary pictures, snapshots and traces remain ignored under
`.local/security-hard-*`. Missing local evidence is a setup failure.

Fresh exploratory reproduction:

```
DUCKTALES_CAPTURE_HARD_EXPEDITION=.local/security-hard-expeditions-new npx playwright test tests/browser/hard-expedition.spec.js tests/browser/hard-mountains.spec.js
```

Each case deliberately exits nonzero only after saving and validating restart.
Raw captures declare completed=false and cannot satisfy strict acceptance by
themselves. New recordings require review and independent replay.

Verification commands:

```
npm run verify:security-hard-expeditions
npm run test:security-hard-expeditions
node scripts/verify-security-hard-movement-negative.js
```

A fresh full Hard campaign regression also retains28 exact checkpoints and4140
DOM events through all four families and the ending. Its266-file source archive
is pinned to cf5e0bb; this regression is separate from the four alternate routes.

The first command validates retained browser receipts against their producer
sources, replays the current Game strictly, and tests required fixture failures.
The second runs all eight fresh browser cases. The last reruns the four actual
missing-movement negatives. `verify:hard-expedition`, `verify:boola-expedition`
and `verify:hard-mountains` now target the security-aware routes and include their
fresh browser and negative checks. Full branch integration remains pending; see
[current status](STATUS.md).
