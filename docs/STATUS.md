# Current port status

Updated2026-10-27. **The full game is not complete.**

The main campaign loop and all four expedition families are playable. This is
still completion work,not only final polish: known rival/flight hard stops and
unverified destination/difficulty routes remain. Selected complete routes and
endings are established; arbitrary campaigns are not yet guaranteed finishable.

## Working browser routes

- P pauses/resumes; S switches sound; Q/Escape/F1 asks to quit. N continues the
  same scene; Y shows credits without banking or replay. The Back/Office button
  provides navigation. Dialog state and original popup pixels are checked.
  In the money bin these keys wait for the original idle input poll; the intro
  continues before Pause,and the dive clears unread keys on its return.

- Title → difficulty → office → money-bin dive → office. Correct timing awards
  the original one-time$1000 coin; travel/banking resets its latch.
- Office → map → Macaroon bank → office. All35 destinations can be inspected.
- Confirm expedition → Launchpad → keyboard flight → crash or airport landing.
  Losing a flight race credits Glomgold and returns to the campaign map.
  A small left-edge scroll now follows the original zero-width-strip path,
  preserving rival advancement without reading off-table terrain.
  Flight dialogs now wait for the original input poll,freeze actors while clocks
  continue,and preserve the overdue deadline on resume. Flight completion includes
  the original140-tick input wait before expedition/repair dispatch.
- Earn the Atomic Matter Transmitter in Too-Pei → return to office → select its
  map icon → atomic journey → next expedition. Misdirection,original calendar/RNG,
  reports,direct-map aircraft persistence and deadline arrivals are connected.
- Cave arrival → guide → rooms → treasure or failure → results/map → direct retry.
  Safe new rooms award$50. Collected locations prevent duplicate treasure awards.
  P/Q/S wait for the cave input call; room-entry/result flushes discard unread
  keys and held controls. Pause freezes actors while device clocks continue.
- Mountain arrival → guide → walking,hook/climbing,hazards,pickups and three lives.
  A complete variant0 ascent preserves three lives,collects$100,awards the current
  startup's$8000 treasure and returns to the map with duplicate protection.
  The life palette now recolors Scrooge red/blue/green at3/2/1 lives,using the
  original table and the shared EGA converter.
  Mountain P/Q/S now wait for the normal input poll; life resets clear held
  controls. Pause freezes actors while device clocks continue. Source/model/
  browser checks and full integration pass.
- Jungle arrival → guide → jump/walk/climb/drop,vines,fish/platforms and hazards.
  A complete Easy/variant0 route reaches the chest with one life,awards$1000,
  returns on day5 and prevents repeat collection. Failure/retry also works.
- Photography arrival → guide → aim/shoot →12-photo results → map. Target shots
  pay$500,ordinary shots$50. Return spends two days and preserves the original
  shared-photo-score quirk. Successful locations cannot pay twice.
- Office → investments → portfolio → company → buy/sell → broker → office.
  Original resources,99-share limit,held-Fire repetition,persistent holdings and
  daily news work. Trading preserves the calendar and money-bin coin latch.
- Entering an expedition activates normal Glomgold turns. Completed campaign actions
  advance one rival trip,claim or bank deposit. Reports pause and resume pending
  actions; a new rival claim can prevent the selected departure. Idle map time
  does not advance him.
- Deadline → final deposit → winner/loser pictures → Play Again. Ties favor Scrooge;
  unsold shares are excluded from banked score. Yes resets to difficulty;No shows
  credits and a finished screen. Restart remains available as a browser adapter.

Controls: Space/Enter fires. Office Up+Space enters the money bin,Right+Space
opens the map,Left+Space opens investments. Hold Fire for flight throttle;
Down raises the nose,Up lowers it. Caves use arrow+Fire for passages. Mountains
use Fire to swing the hook,release to throw,and Up to climb. Jungles use arrows
and Fire to jump. Photography uses Left/Up/Right to aim and Fire to shoot. After earning the transmitter,Left from the Map choice selects
Atomic; Right cycles Map/Launchpad/Atomic.

## Supported build and evidence

Only the22-file pairing in `reference/build.json`,with adjacent original files
in ignored game/. DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Originals remain authoritative,unchanged and excluded from production output.
A production visitor selects their own original folder. `.gitignore` is preserved.

- Original comparisons are bounded routines/conditional segments and selected
  exact PNGs. They are not a whole original campaign replay. Manifests identify
  setup injections,source identities,alignment rules and local artifacts.
- Independent replays carry their own simulation state and consume separate
  input/event streams. Port regression hashes are explicitly distinguished from
  original outputs. Rendering observes simulation;driver and retrace clocks differ.
- Browser scenarios exercise actual loading,keyboard controls,rendering,calendar,
  rewards,native audio boundaries,retries,trading,news,endings and Restart.
- Startup includes30 company draws,2 location draws,20 loot draws and daily market
  processing. BIOS-seed0 reaches company5245,location/loot45111 and Easy day-one1960.
  The first Klondike race roll is48: Standard/Hard race,Easy does not.
- Ending evidence:8 original checkpoints,4 exact picture/prompt PNGs,relocated
  resident bytes,and static integer/dialogue boundaries. Original capture funding
  and date setup are conditional; browser win/tie/loss routes use actual play.

Detailed scopes: [flight](flight.md),[caves](cave.md),[mountains](mountain.md),
[jungle](jungle.md),[photography](photography.md),[trading](investments.md),
[endings](ending.md),[system controls/audit](system-controls.md),[atomic transport](atomic-transport.md),[rival progression](rival.md),[treasure assignment](treasure-assignment.md).

## Known limitations and next milestone

- Normal Glomgold progression is connected. Nine conditional original checks cover
  inactive/miss/claim/bank and all difficulty selectors,with exact report pixels.
  Original full-campaign/audio timing remains unproven. An exhausted rival route35
  stops explicitly; its original out-of-table behavior is unknown.
- No save/load/high-score path is identified in this build. Earlier status entries
  assumed those features; [the interface audit](system-controls.md) corrects that.
  Browser persistence would be an explicit addition,not a translated original format.
- Next: resolve gameplay hard stops and broaden complete destination/difficulty
  routes,alongside remaining original expedition comparisons. Money-bin intro/idle/dive polling now has10 original
  comparisons,including retained released keys and the final flush. Flight has9
  new original checks for input,clock/deadline preservation and final return wait.
  Cave has8 new original code/pause/deadline/room-flush checks. Mountain has6
  new original input/pause/life-flush checks and an independent controller replay.
  Jungle and photography global-key alignment with their original animation/
  audio waits remains unproven.
- Atomic travel has5 conditional original checks,exact report pixels and an earned
  browser unlock/use route. Original sound latency,map-information and transition
  timing remain unproven. Some editions are unsupported.
- Full original expedition timing,presentation and audio parity are unproven.
  Cave movement,mountain hook/ascent,jungle scrolling/enemies and additional
  variants/difficulties still need targeted original comparisons.
- Flight's empty preceding strip is supported for scroll−1..−7. Visible
  out-of-table terrain remains an explicit diagnostic pending original evidence.
- Ending bank celebration animation,striped reveals and music are incomplete.
  First/last credit names and farewell match exact original PNGs; all26 natural
  browser credit boundaries pass. Two original waits are exactly140 driver ticks;
  whole-sequence original presentation timing remains unproven. Losing ending
  pictures lack original PNG captures.
- Some title/office/security transitions are omitted. Navigation buttons,Back and
  browser pausing on hide are explicit adapters. Browser BIOS seed is an injected
  environment provider0; full title/BIOS seeding timing has not been reproduced.
- Unsupported paths stop with diagnostics. No best-effort recovery satisfies
  acceptance. Proprietary assets,dumps and traces remain local and ignored.

## Verification

```sh
npm install
npx playwright install chromium
npm run verify
```

Focused commands: `npm test`,`npm run test:browser`,`npm run verify:system-controls`,`npm run verify:rival`,`npm run verify:ending`,
`npm run verify:investments`,`npm run verify:startup`,`npm run verify:cave-input`,and the subsystem commands
in package.json. All required local artifacts are mandatory; missing/corrupt
fixtures,skipped cases,unconsumed inputs and unsupported rendering fail. Important
comparators include negative controls.

Current milestone passed full `npm run verify`:56 unit tests,29 browser scenarios,
all required original-data checks and the production build. Integration log:
`.local/mountain-input-integrated-verify.log`.

One browser worker keeps the full mountain/jungle replays within their existing
120-second limits; their required inputs and checkpoint counts are unchanged.
The cave treasure route retains its90-second limit,uses explicit browser time,
and observes the supplied8ms display cadence. It still requires landing,room
reward,failure,retry,treasure and campaign return. The new native cave scenario
checks P,Q/N,clock/actor separation,popup pixels and held/unread-key entry flushes.

`verify:cave-input` requires18 checksummed artifacts,eight original code/state/
input invariant checks and a separate independent controller replay. These are
bounded checks,not an original whole-cave state replay. The shared photo-score
shortcut is checked to skip the normal cave result dialog and its input flush.
Detailed rules,exclusions and negative controls are in the subsystem manifests.

Mountain life-palette checks pass focused source,native browser and full
integration checks. The same-page cache is checked through three life colors;
the shared converter retains eight exact original jungle PNG comparisons.
The mountain ascent still consumes764 inputs and all26 checkpoints. Browser
observations align to the existing8ms display cadence without changing expected
states or extending scenario timeouts. Flight inputs also use explicit browser
time; native sound completion uses real time.

The photography repeat visit now requires rival speech to end through the
native media event before the collected-location notice and map return. Game
time alone cannot complete browser audio. Money,calendar and RNG checks remain
unchanged. Mountain input-poll and life-flush checks now pass full integration:
six original checks from14 required local artifacts,an independent controller
replay with six negative controls,and native pause/Quit-No/life-reset acceptance.
The three-life route observes four display callbacks per read,retaining its
40-second virtual wait budget and60-second wall limit. Original whole-mountain
movement,timing and upper transport/erase graphics remain unproven.

Next priority is gameplay completeness: exercise additional destination layouts,
difficulties and uncommon interactions,and resolve reachable flight-boundary or
exhausted-rival hard stops. Selected complete expeditions and win/loss routes do
not establish a complete arbitrary campaign. Remaining mountain graphics and
presentation differences are separate fidelity work.

Live original: instance0719a1b0cdcede0b85c39577ff760639,PID59942. Paused
0e0c:0317 stop552 at a native mountain life2 input poll,DS/SS1403. No breakpoints
or pending replay. Normal map navigation from Carlsbad to El Capitan reached
MT entry545,input546,pause547..550 and life-reset551..552. No game/CPU writes or
restores. `reference/mountain-input.json` records the setup and14 required local
artifacts. The earlier palette verifier separately reuses the explicitly
conditional entry in `reference/mountain-entry.json` and shared jungle driver.
Money-bin/flight/cave-input captures use a fresh natural launch with no memory/CPU
injections. Earlier controls/credits captures inherit conditional atomic setup.
Whole original expedition presentation,timing and audio remain unproven.
