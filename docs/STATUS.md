# Current port status

Updated2026-10-27. **The full game is not complete.**

## Working browser routes

- P pauses/resumes; S switches sound; Q/Escape/F1 asks to quit. N continues the
  same scene; Y shows credits without banking or replay. The Back/Office button
  provides navigation. Dialog state and original popup pixels are checked.

- Title → difficulty → office → money-bin dive → office. Correct timing awards
  the original one-time$1000 coin; travel/banking resets its latch.
- Office → map → Macaroon bank → office. All35 destinations can be inspected.
- Confirm expedition → Launchpad → keyboard flight → crash or airport landing.
  Losing a flight race credits Glomgold and returns to the campaign map.
- Earn the Atomic Matter Transmitter in Too-Pei → return to office → select its
  map icon → atomic journey → next expedition. Misdirection,original calendar/RNG,
  reports,direct-map aircraft persistence and deadline arrivals are connected.
- Cave arrival → guide → rooms → treasure or failure → results/map → direct retry.
  Safe new rooms award$50. Collected locations prevent duplicate treasure awards.
- Mountain arrival → guide → walking,hook/climbing,hazards,pickups and three lives.
  A complete variant0 ascent preserves three lives,collects$100,awards the current
  startup's$8000 treasure and returns to the map with duplicate protection.
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
- Next: input-poll timing and remaining campaign edge paths,then broader original
  expedition comparisons. Global dialogs currently accept keys at the next driver
  tick; alignment with every original animation/audio wait is unproven.
- Atomic travel has5 conditional original checks,exact report pixels and an earned
  browser unlock/use route. Original sound latency,map-information and transition
  timing remain unproven. Some editions are unsupported.
- Full original expedition timing,presentation and audio parity are unproven.
  Cave movement,mountain hook/ascent,jungle scrolling/enemies and additional
  variants/difficulties still need targeted original comparisons.
- Ending bank celebration animation,striped reveals,credits-page pixels/timing
  and music are incomplete. Losing ending pictures lack original PNG captures.
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
`npm run verify:investments`,`npm run verify:startup`,and the subsystem commands
in package.json. All required local artifacts are mandatory; missing/corrupt
fixtures,skipped cases,unconsumed inputs and unsupported rendering fail. Important
comparators include negative controls.

Current milestone passed full `npm run verify`:42 unit tests,26 browser scenarios,
all required original comparisons (including7 system-control/interface checks)
and production build. The real-time jungle retry check accepts the original rival
claim notice when Glomgold has already collected that destination; otherwise it
requires a fresh three-life expedition. Campaign notice checks preserve accounts
and calendar; exact rival RNG checks use captured inputs in `verify:rival`.

Live original: instance0719a1b0cdcede0b85c39577ff760639,PID59942. Paused
0319:0002 stop467 inside credits,input polling,DS/SS1403,sound off. No breakpoints
or pending replay. The controls capture inherits conditional campaign setup from
`reference/atomic.json`; `reference/system-controls.json` pins the new observations.
