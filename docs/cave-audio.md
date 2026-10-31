# Cave sound boundaries

Supported build: the 22-file pairing in `reference/build.json`, overlay 6 of
DUCKTALE.EXE. Static evidence is in `reference/cave-audio-source.json` and
`reference/cave-audio-calls-source.json`; proprietary captures stay ignored.

The original capture (125f), pit (16a7) and treasure (188c) endings spin on the
global sound driver's status without reading keys or waiting a timer tick.
The enabled flag does not replace that status. Initial 0479, intermediate pit
1499 and common return 189e reset calls are enabled-flag guarded. Torch expiry
has no terminal status spin. The port follows those separate paths.

At each terminal consumption boundary, a used device receives a fresh query
token. Unknown/busy status blocks the generator; only matching idle status
resumes it, synchronously with status consumption. Previous sound ACKs, stale
tokens, elapsed driver ticks and changing the enabled flag cannot release it.
An absent or request-free provider is initialized idle. Device availability is
injected explicitly, sampled when the ending consumes status. Browser checkbox
mute remains an explicit stop convenience; its actual device reset/completion
still supplies the status rather than the checkbox value supplying it.

Room composition 26bb has an audible argument. Entry calls it with 1 at 05a5,
then 0 at 05f4; subsequent redraws use 0. An accessible adjacent pit takes
priority and requests hex4d. Otherwise helper1ad2 compares the signed treasure
distance: less than2 requests51, less than4 requests50, less than6 requests4f,
and greater/equal6 requests4e. All calls are guarded by sound enabled. The cue
occurs after room overlays and before the final video-to-cache copy. The port
splits the existing graphics budget at that boundary, preserving its total.
This is not a new claim about native CPU/PIT phase or analog audio parity.

Evidence levels remain separate:

- **Statically inferred:** 51 terminal-loop bytes and 499 call/rule bytes match
  original, prepared analysis image and Ghidra exactly. The distance helper's
  normalized stack probe is outside the selected comparison range. No bytes or
  relocations are excluded inside the selected ranges. The 499-byte count
  includes overlapping snippets. Main04ab..04bc passes the current room and
  treasure room to the distance helper and stores its return at4e08. No live
  original emulator was used here.
- **Conditional component checks:** explicit terminal-entry preconditions,
  real original assets, all three waiters enabled/muted, stale/busy/idle status,
  no timer release, reset guards, signed distance thresholds and pit priority.
  These do not prove that every ending is naturally reachable in the browser.
- **Browser checks:** `probe-cave-audio.js` replays startup and flight from an
  independent DOM stream, then navigates from the initially observed cave map
  into a pit. It uses actual speaker/Tandy AudioWorklets and records queries,
  ACKs/completions, room-entry cues and restart. Host20ms/Game16ms polling is
  conditional, not original timing acceptance. Current run results are recorded
  separately; an implementation or available command alone is not a pass.

Current acceptance is pinned in `reference/cave-audio-acceptance.json`:

- Speaker enabled and Tandy enabled both query busy and wait for actual matching
  completion before the failure result and guarded return reset.
- Speaker muted and Tandy muted stop through the explicit browser checkbox
  during the pit animation, then query actual idle at the terminal boundary.
  No common return reset is emitted while disabled.
- All four naturally traverse four passages, request five room-entry cues
  including the pit warning, enter failure, and Restart. The phase-relative
  controller/host polling is conditional; these are not fixed-timestamp audio
  replays. The external device ledger is saved separately from route inputs.
- Unchanged strict muted failure route:11 exact state/RGBA checkpoints and454
  independent DOM events, plus a missing-Pause negative.
- Unchanged strict muted winning Standard route:170 exact state/RGBA checkpoints
  and6575 independent DOM events, all four expedition families, three later cave
  treasures, victory, all26 credits, closed screen and Restart. A missing-selection
  negative must fail. Neither muted replay uses comparison exclusions.
- 194 units,130 component/device boundaries and production build pass. The saved
  checker removes required queries, cues and enabled completion events to verify
  rejection; three setup negatives reject empty/missing/corrupt evidence. Four
  source negatives reject empty/missing/corrupt/misaddressed source evidence.

Runtime is `66d8f54`; later commits change evidence/tooling only. Natural browser
audio capture/treasure coverage is still narrower than their component coverage.
The two rejected `*-01` initial focus probes are retained as failed exploration:
the checkbox held keyboard focus and the required route did not finish. They
are excluded cases, not relaxed comparisons or runtime recovery.

```sh
node scripts/verify-cave-audio-source.js
node scripts/verify-cave-audio-calls-source.js
node scripts/verify-cave-audio-source-negative.js
node scripts/verify-cave-audio-acceptance.js
node scripts/verify-cave-audio-setup-negative.js
node --test scripts/cave-audio.test.js tests/cave-timing.test.js
node scripts/verify-cave.js
# Requires clean committed source, original files and local producer evidence:
node scripts/probe-cave-audio.js --device=speaker --mode=enabled --output=.local/cave-audio-speaker-enabled-FRESH
node scripts/probe-cave-audio.js --device=tandy --mode=muted --output=.local/cave-audio-tandy-muted-FRESH
node scripts/verify-cave-failure-input-browser.js --output=.local/cave-audio-failure-FRESH
```
