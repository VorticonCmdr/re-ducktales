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
  and campaign return. Original ending replay/pixel parity is not yet verified.

Controls: Space/Enter fires. Up+Space enters the money bin; Right+Space opens the
map. Hold Space for flight throttle; Down raises the nose, Up lowers it. In caves,
hold an arrow to point, then press Space to move. Use Restart at an unsupported
boundary. With complete initialization and browser BIOS-seed0, the first Klondike
flight races only on Hard; Easy/Standard are ordinary flights.

## Supported original and architecture

Only the22-file pairing in `reference/build.json`. DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
`game/` is authoritative, unchanged, ignored and excluded from production output.
A production visitor selects their own original folder. Local captures, decoded
assets, Ghidra databases and builds remain ignored; `.gitignore` is preserved.
Simulation consumes explicit input and separate driver/retrace clocks. Rendering
does not advance simulation. Unsupported paths stop with diagnostics.

## Verification scope

- 23 unit tests and12 browser checks. Browser coverage includes real flight
 controls, crash/race return, airport landing, cave entry, safe-room cash,
 treasure recovery/$4500 award, collection/calendar/map return, restart,
 folder loading, corrupt-file rejection and the existing audio adapter.
- Original money-bin:30 routine checkpoints; campaign bank:3 checkpoints;
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
  comparisons remain incomplete. Same-location and collected-location dispatch
  remain incomplete in the browser and stop explicitly.
- Jungle, mountain, photography, stock trading, campaign endings, normal
  Glomgold progression, atomic transport, save/load and high scores are absent.
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
`npm run verify:cave`, and the existing reference/campaign/departure/flight
verifiers listed in package.json. Analysis: `npm run prepare:analysis`,
`npm run prepare:flight-analysis`, `npm run prepare:cave-analysis`.

Next: compare C-drive cave movement and remaining outcomes with the original,
implement collected-location dispatch, then expand the other expeditions, trading and endings. Capture
room transitions, lamp and pursuit at input-consumption boundaries. Full-game
work remains active. Details: `docs/cave.md`, `docs/treasure-assignment.md`,
`docs/flight.md`, `docs/expedition-departures.md`.

Live original: instance0719a1b0cdcede0b85c39577ff760639, PID59942,
paused at cave0e0c:0b9c, DS/SS1403, stop20. No input schedule or breakpoints
remain. No machine restore was used. Revalidate addresses after any relaunch.
