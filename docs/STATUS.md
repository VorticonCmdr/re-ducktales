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
All 35 destinations can be inspected. Confirm an expedition for Launchpad's
original briefing, then fire to enter flight. Hold Space for throttle; Down
raises the nose and Up lowers it. The plane moves through original terrain and
obstacles. A losing race plays the crash/rival consequence and returns to the map
at the destination; Glomgold receives its treasure. Restart works during flight.
An airport arrival completes its landing animation, then stops at the explicit
untranslated expedition boundary. An ordinary crash adds two repair days and,
when carrying cash, shows the original wreckage/loss dialogue before that same
boundary. The full campaign remains incomplete.
See `docs/campaign-travel.md`, `docs/expedition-departures.md`, and `docs/flight.md`.

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
  pixel-exact office, opening world map, departure briefing, and aligned failed-ending comparisons against local DOSBox captures.
- Independent simulation: successful timing branch, one-time $1000 reward,
  failure branch, integer/RNG boundaries, and scheduler catch-up checks.
- These checks do not establish a full original campaign replay or exact sound
  emulation. Both branches were observed in the original, including its $1000 cash
  update. Timing evidence remains narrower than full-game fidelity. See the scenario manifest and capture recipe.

Campaign reference: 3 exact original state checkpoints (zero-cash bank and office
return), 2 negative controls. Browser and simulation also verify carrying a $1000
money-bin reward through deposit. Nonzero deposit has not been compared in DOSBox.

Departure evidence: 2 **conditional** original output checkpoints (prepared RNG/
race state and flight-entry arguments), 2 further negative controls, exact
briefing pixels, and independent browser preparation for all four activity
families. Captured internal seed/slot inputs are documented; this is not a
whole-campaign RNG replay. Browser uses its own seed-0 provider.

Flight physics: 8 **conditional** original before/after cases and 2 control-field
checks match exact state bytes, including gravity, camera following, a bounce,
and a dry-ground crash. Three negative controls fail as required. Flight physics is now connected to browser gameplay. These conditional checks
still do not establish a full original input replay. See `docs/flight.md`.

Flight course setup: terrain, scenery selection and initial obstacle placement
are translated. Five exact checkpoints cover three conditional stages and two
complete setups using original EXE/PLANE.ARC data. The setups consume212/213 RNG
draws and create10/16 objects. Three negative controls fail as required. Other
difficulties and durations are statically implemented but not original-capture
validated. Flight object updates, rendering, collision outcomes and landing are integrated.
Expedition gameplay after arrival remains unsupported.

Flight scene/object updates and collision rules are now translated. Twenty-two
new checks include16 closed-loop state checkpoints driven by15 separate original
input values, three conditional state checks, and three exact full-screen PNGs.
The balloon release is observed and matched. Other collision responses remain
statically translated; spin, boost, airship and tether animations have a main-loop provider.
Those special animation paths remain statically translated, not original-capture
validated. Browser acceptance covers keyboard takeoff/crash/race return and airport landing
through the explicit expedition diagnostic.

Flight runtime: four further **conditional** original checkpoints match game state
after 25 crash presentations and two calendar presentations, then carry that
outcome through two repair-day/cash/RNG checkpoints. Intermediate crash pixels
are not original-capture compared. Three negative
controls reject unfinished/altered/missing comparisons. The start is an explicit
captured crash boundary, not a complete machine checkpoint or whole-flight replay.

## Known limitations

- Random treasure assignment is not implemented. Fixed location treasure IDs
  resolve through LOOT.ARC (Klondike: resource25, $4500). A losing race at a
  random-treasure location stops explicitly. Campaign startup currently consumes
  location-permutation RNG draws but omits the later random-loot draws, so no
  complete original campaign RNG replay is claimed. This must be resolved before
  expanding full campaign acceptance.
- No climbing, jungle, photography, cave exploration, stock trading, normal
  Glomgold campaign progression, campaign ending, save/load or high scores. The
  forced rival claim after losing a flight race is implemented; its normal
  autonomous campaign route is still missing.
- Investments, expedition arrivals and same-location expedition activities
  stop with a diagnostic. Journeys reaching
  day 30 stop before the unsupported campaign ending. There is no
  fallback gameplay or silent replacement mechanic.
- The port explicitly pauses on the departure briefing before flight starts. Original resource loading proceeds directly into flight.
  Flight supplies its own outcome; expedition results remain unsupported. The optional atomic aircraft is absent.
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
negative controls, three campaign state checkpoints, two conditional departure
output checkpoints, ten conditional flight checkpoints, five course setup checkpoints,
twenty-two flight-scene checkpoints, four conditional flight-runtime checkpoints,
automated browser scenarios,
and a production build. Missing
local traces/captures fail with setup errors. It does not silently skip them.

Focused commands: `npm test`, `npm run verify:build`,
`npm run verify:reference`, `npm run verify:campaign`, `npm run verify:departure`,
`npm run verify:flight`, `npm run verify:flight-course`, `npm run verify:flight-scene`,
`npm run verify:flight-runtime`, `npm run test:browser`, `npm run audit:assets`.
`npm run prepare:analysis` reproduces local unpacked analysis copies.
`npm run prepare:flight-analysis` creates the combined flight analysis copy.

## Next milestone

Translate random loot initialization, then connect the actual expedition
dispatcher and a complete first level after flight.
Cave arrival at Klondike is the first target. Expand capture coverage for landing
and special collisions; the airport route currently has independent simulation
and browser acceptance, but no complete original landing replay. One positive-cash repair day/loss case matches the original. Other repair
branches and forced rival claims are statically translated; their
presentation timing/audio completion is not original-capture validated.

The live DOSBox session is paused at main01f5:0ae5 after the third ordinary flight
crash advanced day12 to13, repairs to15, and cash50 to25 (DS/SS1403). No breakpoints or held keys
remain. Reference crash details are in `reference/flight-runtime.json`.
The full-game request remains active and incomplete.
