# Current port status

Updated 2026-10-26. **This is an early playable slice, not a complete game port.**

## Working browser route

`npm run dev` → open `/` → Space → choose difficulty → Enter → office →
Up+Space (or Enter money bin) → wait for Scrooge's idle poses → Space →
complete dive → return to office. Restart returns to the title.

A correctly timed first dive awards $1000; subsequent dives cannot award another
coin until the game's latch is reset. Macaroon bank travel and restart reset the latch. Original money-bin
sprite coordinates, frame bytes, branch condition, and explicit timer delays
are translated from overlay 9. The office is rendered from original assets.
The difficulty choice is retained but does not change this activity.

Campaign route: office → Right+Space → map → select Macaroon (212,131) →
fire → Right → fire → bank (day 4) → office icon → fire → office (day 7).
All 35 destinations can be inspected. See `docs/campaign-travel.md`.

## Supported build

Only the 22-file DOS resource pairing listed in `reference/build.json`.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
`game/` is authoritative, read-only during original-game experiments, ignored by
Git and excluded from production output. Ghidra databases and local captures are
also ignored. Production loading uses the visitor's own folder.

## Evidence and checks

- Static: EXEPACK unpacking and ten appended overlays identified; main RNG
  instructions match live memory. See `docs/executable.md`.
- Routine segment comparison: 28 original sprite checkpoints match exact
  resource/frame/x/y values; the successful timing gate and cash result add two
  more exact checkpoints. Omitted-input and altered-output
  negative controls fail. Starting-state conditions are explicit in the manifest.
- Browser acceptance: actual keyboard route, asset hash rejection, restart, and
  pixel-exact office, opening world map, and aligned failed-ending comparisons against local DOSBox captures.
- Independent simulation: successful timing branch, one-time $1000 reward,
  failure branch, integer/RNG boundaries, and scheduler catch-up checks.
- These checks do not establish a full original campaign replay or exact sound
  emulation. Both branches were observed in the original, including its $1000 cash
  update. Timing evidence remains narrower than full-game fidelity. See the scenario manifest and capture recipe.

Campaign reference: 3 exact original state checkpoints (zero-cash bank and office
return), 2 negative controls. Browser and simulation also verify carrying a $1000
money-bin reward through deposit. Nonzero deposit has not been compared in DOSBox.

## Known limitations

- No plane gameplay, climbing, jungle, photography, cave exploration,
  stock trading, Glomgold progression, campaign ending, save/load or high scores.
- Investments and expedition departures stop with a diagnostic. Journeys reaching
  day 30 stop before the unsupported campaign ending. There is no
  fallback gameplay or silent replacement mechanic.
- Title/difficulty/office transitions omit original cutscenes and door transition
  animations. Navigation buttons are an accessibility adapter, not DOS UI assets.
- Original per-sprite transparency is keyed from the first decoded pixel, as
  verified in output conversion routine 140e:10e8. Office pixels match exactly.
- Failed-dive resource 10 receives frame bytes 7–13 despite declaring seven
  frames. Its unchecked scanline advancement is preserved. The final out-of-range
  row is transparent in the current renderer; allocator-dependent mask bytes at
  that edge have not been recovered. The captured displayed pose 12 matches exactly, including its edge; other full dive frames remain unverified.
- Explicit delays use the original sound-driver tick rate. Retrace-only tail
  frames use a separate video clock. Original instruction/render processing time
  is not modeled; whole-sequence timing has not been waveform/frame aligned.
- Sound is optional and labeled reconstructed. Existing PC-speaker noise/engine
  approximation and alternate sound-driver limitations still apply.
- Browser hiding explicitly pauses the port; foreground frame delays catch up
  every simulation step. Original DOS keeps running when its window loses focus.

## Exact verification commands

```sh
npm install
npx playwright install chromium
npm run verify
```

`npm run verify` checks all 22 file hashes, unit tests, the local original trace,
negative controls, three campaign state checkpoints, automated browser scenarios, and a production build. Missing
local traces/captures fail with setup errors. It does not silently skip them.

Focused commands: `npm test`, `npm run verify:build`,
`npm run verify:reference`, `npm run test:browser`, `npm run audit:assets`.
`npm run prepare:analysis` reproduces local unpacked analysis copies.

## Next milestone

Implement one actual expedition level
with success/failure and return to the office before expanding to other levels.
The full-game request remains incomplete. Campaign travel currently supports only
Macaroon deposits and office return; location detail screens and transition timing
remain partial, and Glomgold/stock progression is absent.
