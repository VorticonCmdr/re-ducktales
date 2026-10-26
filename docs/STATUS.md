# Current port status

Updated2026-10-26. **The full game is not complete.**

## Working browser routes

- Title → difficulty → office → money-bin dive → office. Correct timing awards
  the original one-time $1000 coin; travel/banking resets its latch.
- Office → world map → Macaroon bank → office. All35 destinations can be inspected.
- Expedition confirmation → Launchpad → keyboard flight → crash or airport
  landing. A lost race credits Glomgold's assigned treasure and returns to map.
- Cave arrival → original Junior Woodchuck Guide → cave rooms. Arrow+Space follows
  an open passage; entering a new safe room awards $50. Restart returns to title.
  Treasure and all three failure animations now lead to original result screens
  and campaign return. Failed current expeditions can be retried through the
  guide without another flight. Collected locations show their original notice
  and return to the map without spending days or cash. Capture has conditional
  original state/pixel evidence; full expedition timing parity remains unproven.
- Mountain arrival → guide → walking, hook swing/throw → life loss → campaign
  map → direct retry. Independent replay also climbs to row2 and collects $50.
  A complete variant0 ascent preserves three lives, collects $100, awards the
  $7000 treasure, returns to the map and prevents repeat collection. Original
  hook/ascent, pixel and timing parity remain unverified.

Controls: Space/Enter fires. Up+Space enters the money bin; Right+Space opens the
map. Hold Space for flight throttle; Down raises the nose, Up lowers it. In caves,
hold an arrow to point, then press Space to move. Use Restart at an unsupported
boundary. With complete initialization and browser BIOS-seed0, the first Klondike
flight races only on Hard; Easy/Standard are ordinary flights.
In mountains, arrows move; hold Fire to swing the hook and release to throw.
Up climbs an adjacent ledge or uses a transport point.

## Supported original and architecture

Only the22-file pairing in `reference/build.json`. DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
`game/` is authoritative, unchanged, ignored and excluded from production output.
A production visitor selects their own original folder. Local captures, decoded
assets, Ghidra databases and builds remain ignored; `.gitignore` is preserved.
Simulation consumes explicit input and separate driver/retrace clocks. Rendering
does not advance simulation. Unsupported paths stop with diagnostics.

## Verification scope

- 27 unit tests and14 browser checks. Browser coverage includes real flight
 controls, crash/race return, airport landing, cave entry, safe-room cash,
 pit failure, direct retry, treasure recovery/$4500 award, collected-location
 notices (including native audio completion), calendar/map return, restart,
 folder loading, corrupt-file rejection and the existing audio adapter.
  Mountain coverage adds actual movement/hook controls, life loss, day/map
  return, direct retry and the complete variant0 ascent/reward/collected notice.
  The ascent uses a controlled125Hz browser display clock with real keyboard
  events; the existing failure/retry scenario uses normal browser timing. Its
  independent regressions require ten short-route checkpoints/148 input samples/
  149 presentations plus26 ascent checkpoints/764 inputs/870 presentations.
  Terrain has75 static asset cases. A separate conditional original initialization checkpoint
  matches actor/lives/RNG/hazards/geometry and the full relocated12002-byte
  overlay. Another15-checkpoint conditional original walking segment matches
  actor/action/RNG/hazards/page histories/live locals, carrying its own state
  from entry with a recorded joystick stream and explicit incoming stack provider.
  Its destination setup injection is explicit; original hook/ascent/pixels/timing
  and a whole original mountain replay are not established.
- Jungle foundation: three static map-loading cases compare all65536 DS bytes,
  348 declared records and the three starting-platform scans against an
  independent scanf-table oracle. Duplicate printed B labels and the extra
  undeclared F row retain original behavior. Actor animation now adds12
  conditional original routine checkpoints,7 carried animation checkpoints and
  18 decoded actor poses, with complete24056-byte relocated overlay identity.
  Seven additional conditional original control cases compare directional/Fire
  selection and the128-byte keyboard matrix. Support/ground helpers are
  statically translated. Actor motion adds25 exact original routine cases,
  21 carried actor checkpoints and25 decoded poses covering walking,short step,
  drop,fall and water death. Complete scene/hazards and browser gameplay remain
  unimplemented. Authored boundary checks are kept separate from runtime evidence.
- Original money-bin:30 routine checkpoints; campaign bank:3 checkpoints;
 same-location retry:2 conditional dispatcher/cave-call checkpoints;
 departure:2 conditional checkpoints and exact portrait pixels.
- Flight:10 conditional physics/control,5 course setup,22 scene checkpoints
 (including16 closed-loop segment states with15 independent inputs and3 exact
 PNGs),4 conditional crash/calendar/repair states.
- Treasure initialization: one conditional whole-routine checkpoint matches all34
 IDs/resources/values, RNG and special treasure location. Startup now consumes
 the missing20 loot RNG draws after the2 location-permutation draws.
- Cave entry: one conditional original checkpoint matches64 map words, actor
 positions, torch/RNG/time fields and sprite geometry/frame bytes. Subsequent
 movement is statically translated and browser exercised, not original-replay
 compared for the new C-drive movement animation tables. Six additional original
 runtime checks cover the197-sample idle-to-capture segment, animation state,
 return, exact PNG with fixed one-frame VGA capture alignment, and second-entry
 input/idle boundaries. A four-direction C-drive circuit verifies movement and
 the revisit reward latch. Four independent shortened-path outcome scenarios
 replay every checkpoint exactly and render every presentation; application checks cover rewards,
 calendar and report waits. Pixel evidence is limited to the aligned capture
 image; complete original-level replay and audio/timing parity remain unproven.

All verifiers require their local artifacts and reject missing/corrupt files,
wrong case/event counts and required negative controls. The old variant1 briefing
PNG uses its explicit captured seed; the independent corrected startup reaches
variant0. These checks do not establish a complete original campaign replay.

## Known limitations

- Cave capture now matches an original segment and aligned PNG; treasure, pit
  and expiry endings have static/independent checks. Full C-drive entry/exit
  animations are translated, but striped reveals and original movement/timing
  comparisons remain incomplete. Collected-location notices lack original pixel
  and timing comparisons; their state and explicit device boundaries are tested.
- Jungle gameplay, photography, stock trading, campaign endings, normal
  Glomgold progression, atomic transport, save/load and high scores are absent.
  Jungle maps and actor animation/presentation helpers are implemented
  separately; control selection and collision support are now translated too.
  Actor motion and support contributions are now translated separately.
  Complete hazard initialization and scene rendering remain to translate. See `docs/jungle.md`.
  Mountain actions/hazards, scrolling and summit condition are translated;
  variant0 ascent/reward works through browser controls. Other variants/
  difficulties and original hook/ascent comparisons are still needed. Full
  redraws, life palette changes and unspecified initial stack bytes outside the
  walking capture have unverified presentation/state behavior. See `docs/mountain.md`.
- Flight spin/boost/tether/airship paths are statically translated with limited
  original captures. Complete original landing/flight timing parity is unproven.
- Dialogue helper09f5 uses seven driver ticks per poll: guide210 ticks, repair420,
  wreckage700, sound-disabled rival claim280. Fire shortens at poll boundaries.
  Whole presentation/instruction timing and sound completion are not aligned.
- Sound is optional/reconstructed; engine sound and some device effects remain
  incomplete. Browser hiding pauses; the original DOS game keeps running.
- Title/office transitions omit cutscenes/door animations. Departure adds an
  inspectable pause. Navigation buttons are accessibility adapters.
- The money-bin failed sprite's unchecked frame addressing is partly modeled;
  allocator-dependent mask bytes outside the captured pose remain unverified.

## Commands and next work

```sh
npm install
npx playwright install chromium
npm run verify
```

Focused: `npm test`, `npm run test:browser`, `npm run verify:loot`,
`npm run verify:cave`, `npm run verify:visits`, and the existing reference/campaign/departure/flight
verifiers listed in package.json. Analysis: `npm run prepare:analysis`,
`npm run prepare:flight-analysis`, `npm run prepare:cave-analysis`.
Mountain foundation: `npm run prepare:mountain-analysis` and
`npm run verify:mountain`; scope and evidence in `docs/mountain.md`.
Jungle map foundation: `npm run prepare:jungle-analysis` and
`npm run verify:jungle`; Python3 is required for the independent oracle.

Next: complete jungle hazard initialization and scene
scheduling, then connect the existing control/collision/animation pieces to a
playable browser route. Then expand photography, trading and
endings, while extending targeted original mountain hook/ascent comparisons. Continue targeted original comparisons for cave movement,
remaining outcomes and notice presentation/timing. Full-game work remains active. Details: `docs/cave.md`, `docs/treasure-assignment.md`,
`docs/flight.md`, `docs/expedition-departures.md`, `docs/jungle.md`.

Live original: instance0719a1b0cdcede0b85c39577ff760639, PID59942,
jungle variant0/day22, paused111b:01f1 stop220 after fish reset on natural life loss.
Down release was dispatched and neutral AL0 observed at stop218; no breakpoints
or pending schedules. New entry164 revalidates the complete
relocated overlay. Its destination22→25 override after unrelated flight/repair
is explicit conditional setup. See `reference/jungle-motion.json` and
`docs/jungle.md`; older manifests remain pinned to their recorded stops.
