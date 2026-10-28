# Current port status

Updated2026-10-28. **The full game is not complete.**

The main campaign loop and all four expedition families are playable. This is
still completion work,not only final polish: unverified destination/difficulty
routes and behavior gaps remain. Selected complete routes and
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
  Consecutive direction inputs accelerate; diagonals and releasing one arrow of
  a chord now work. Neutral resets the counter. Original key-repeat cadence and
  full-map polling time remain unverified.
- Confirm expedition → Launchpad → keyboard flight → crash or airport landing.
  Losing a flight race credits Glomgold and returns to the campaign map.
  Left-edge scrolling preserves both empty strips and the original visible
  preceding-word alias,with rival advancement and exact original scene pixels.
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
  Original full-campaign/audio timing remains unproven. Exhausted destination35
  now preserves the original zero-value aliased claim/report and normal return;
  two conditional original cases and one exact image cover this edge. Natural
  full-campaign exhaustion remains unverified; full integration passes.
- No save/load/high-score path is identified in this build. Earlier status entries
  assumed those features; [the interface audit](system-controls.md) corrects that.
  Browser persistence would be an explicit addition,not a translated original format.
- Next: resolve gameplay hard stops and broaden complete destination/difficulty
  routes,alongside remaining original expedition comparisons. Money-bin intro/idle/dive polling now has10 original
  comparisons,including retained released keys and the final flush. Flight has9
  new original checks for input,clock/deadline preservation and final return wait.
  Cave has8 new original code/pause/deadline/room-flush checks. Mountain has6
  new original input/pause/life-flush checks and an independent controller replay.
  Jungle global-key polling now follows static call/flush locations, with six
  controller checks and a real browser pause/quit/sound route. Original full-scene
  pause timing remains unproven. Photography now follows its original entry,
  control,shutter and results input calls,with eight controller cases and an
  independent browser pause/quit/sound route. Its results Fire poll is immediate;
  neutral timeout retains40 reads/280 ticks. Original whole-scene timing and
  IRQ alignment remain unproven.
- Atomic travel has5 conditional original checks,exact report pixels and an earned
  browser unlock/use route. Original sound latency,map-information and transition
  timing remain unproven. Some editions are unsupported.
- All 121 public Tandy requests have viewer playback:111 file previews
  (88 audible,23 silent) and 10 live players for long/looping sequences. Request 008
  is an engine-control command and produces no standalone sound;009 plays live.
  Intro music001 now ends naturally after 3558 sequencer ticks (about 48.8s),
  verified with the browser's real audio worklet. The title now starts001 once
  on first sound activation and resets it on skip; later mute/unmute does not
  replay it. Browser Restart initializes a fresh title. Initially muted startup
  is an explicit browser adaptation; original animated intro timing is incomplete.
  Request 095's5199-tick natural
  ending is checked in the independent provider. Engine/IRQ translation adds 29
  conditional native cases/31 checkpoints,30 exact OUTs, three clock advances and
  three chained interrupts. Ten carried provider scenarios consume 21 authored
  inputs and compare 31 port-regression checkpoints; these are separate from
  original runtime/waveform evidence. All 109 prior completed file renditions
  retain exact PCM, timing and port sequences. Live Stop/replay, asset cleanup,
  missing-module failure and a built production worklet/folder route are checked.
  Native marker/status queries and the wait predicate now match 12 original
  queries and five carried wait checkpoints, consuming four independent clear
  events. Completion checks sequence pointers rather than note durations.
  In-game sound now offers PC speaker or persistent Tandy / PCjr. Tandy keeps
  all four channels and priorities across requests, accepts the original flight
  engine start/speed words, and releases game waits from real processor status.
  Three independent provider routes consume 13 requests, checking 16 exact
  checkpoints and six completion events. Browser routes cover money-bin cues,
  mute/reset and device closure, flight → cave → pit → sound wait → results,
  missing-module failure, and the compiled game with original folder loading.
  Next: compare complete original in-game sound timelines and IRQ phase,
  broaden destination/difficulty coverage, and resolve remaining mechanics gaps.
  Device waveform, gain/filter timing and whole-engine replay remain unproven.
  PC speaker remains the default and retains approximate noise/omitted engine.
  Commands:`npm run verify:tandy`,`npm run verify:tandy-production` and full
  `npm run verify`. See [Tandy evidence/setup](tandy-audio.md).
- Full original expedition timing,presentation and audio parity are unproven.
  Cave movement,mountain hook/ascent,jungle scrolling/enemies and additional
  variants/difficulties still need targeted original comparisons.
- The reachable flight tile−1/scroll−8 stop is removed using the original
  neighboring-word read. One conditional original scene matches exact state
  fields/pixels; two independent input streams cross the boundary. Native browser
  component acceptance covers one completed crash. Other invalid terrain remains
  strict. Original whole-flight parity remains unproven.
- Map pointer arithmetic is translated and matches24 original routine cases,
  including16 carried authored reader inputs. Native browser acceptance covers
  held/chord/release/reset/selection. The2-tick held-direction provider remains
  separate from unverified original keyboard typematic and rendering costs.
- Ending music now follows its original picture/replay start and choice-return
  reset calls,including Yes bypassing the title and the reset after difficulty.
  Bank celebration animation,striped reveals and full ending input-poll timing
  remain incomplete.
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

Current milestone passes full `npm run verify`: 96 unit tests, 56 development
browser scenarios and two production browser scenarios, plus all required
original-data comparisons and the production build. Log:
`.local/ending-audio-full-verify.log`. Native browser routes cover persistent
Tandy money-bin cues, mute/reset and acknowledged device closure, original
flight-engine word dispatch, and flight → cave → pit → natural sound wait →
results. Compiled game/viewer tests load the real original folder. Sound 001
also still finishes naturally after 3,558 ticks in actual browser audio.

Three carried provider regressions consume 13 independent requests and compare
16 exact checkpoints/six completion events. Two isolated browser negative
controls reject the previous delayed-frame mute and pending-checkbox repaint
behaviors. These are distinct from original native query/engine evidence;
whole-game IRQ phase/waveform alignment remains unverified. Earlier interrupted
or failed runs are retained locally and are not passing receipts. Runtime,
package and test sources stayed frozen through the final complete run.

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
difficulties and uncommon interactions. The exhausted-rival and visible left-edge
flight stops are removed using original behavior. Map pointer acceleration is
now translated; its original input-device timing remains unverified.
Selected complete expeditions and win/loss routes do not establish a complete
arbitrary campaign. Remaining mountain graphics and
presentation differences are separate fidelity work.

`verify:rival-exhausted` requires13 checksummed local artifacts,two conditional
original cases,five checkpoints,one exact report PNG and five negative controls.
The conditional browser host verifies real keyboard continuation through the
production Game/Scheduler/Renderer and carries a second turn. It does not claim
a naturally exhausted campaign or the production page's whole-campaign route.
The first integration attempt had one cave-route wall timeout under concurrent
host load; that route passed unchanged on focused rerun and on the final full
gate. Timing limits,inputs and expected results were retained.

The visible left-edge milestone passed full integration with no retries or widened
limits. `verify:flight-visible-left-edge` requires13 checksummed local artifacts,
one conditional original scene/state comparison and exact full PNG,plus two
independent carried replays consuming25 events. The new native keyboard browser
fixture completes the crash return and renders709 presentations. A focused gate
also reran after adding explicit required-event-count checks. Detailed evidence,
setup injections and limitations are in `reference/flight-visible-left-edge.json`
and `docs/flight.md`.

Map pointer integration passes24 original routine comparisons,including16
carried authored reader inputs,full relocated source identity,and native browser
chord/release/reset/destination acceptance. Counter-cap/wrap boundaries have
static-rule checks. A final focused verifier also checks unchanged source RNG,
calendar and accounts across each pointer routine. Original keyboard typematic,
original diagonal key bindings and whole-map timing remain separate gaps.

The first full gate and two focused cave runs exceeded the existing90-second
wall limit. The unchanged c858923 runtime/test also timed out in an isolated
checkout. The harness now waits for the asset-ready controls before advancing
its independent virtual clock,and requires initial simulation tick0. No gameplay
assertions,input requirements,8ms observation cadence or time limits were relaxed.
The baseline passed with that readiness wait; the working focused cave route
passed49.6s,and the final full gate's cave route passed38.4s. All32 browser cases
and the production build then passed. Earlier failed logs remain local:
`map-pointer-final-verify.log`,`map-pointer-cave-focused.log`,
`map-pointer-cave-scoped.log`,`map-pointer-cave-baseline.log`.
The final success log is `map-pointer-ready-final-verify.log`; the baseline's
ready run is `map-pointer-cave-baseline-ready.log`. Concurrent CPU activity was
observed; the observations do not isolate a single cause of wall-time variance.

The managed `map-baseline/DuckTales` checkout is now active development on
`codex/tandy-audio`, based on the integrated map milestone `e2a70ca`. Its original
assets, dependencies and ignored captures link to the original repository.
The original repository's `main` remains the local integration target; no push
or deployment is authorized. The existing `.gitignore` remains unchanged.

Live original: instance0719a1b0cdcede0b85c39577ff760639,PID59942,paused
0ed6:046e stop 1430, DS/SS1403, after the conditional Tandy status/wait harness. Rechecked
with the live debugger. Fresh CPU reads confirm original general/segment
registers restored to the saved caller. Port61 control bits remain unchanged;
its timer/refresh observation bits can advance. The query harness does not
modify the BIOS flag byte. CPU flags, clocks, PIC and other BIOS/device
state are not a machine checkpoint.
The allocated fixture was freed and owned breakpoints cleared. This is not a
machine checkpoint or a natural campaign replay. Fresh launch/address validation
is required before natural runtime comparisons. Earlier map/flight/rival captures
retain their own scopes; see `reference/tandy-sequence.json`, `reference/tandy-sequence-cues.json`
`reference/tandy-controls.json` and `docs/tandy-audio.md`.


The jungle input milestone adds six controller cases (including a rejected
missing-flush negative control), four pinned original call-site ranges and one
independent keyboard browser route. Pause suspends actor/RNG/presentation state
and exact screen pixels while device clocks continue. Entry/first-page keys are
flushed at their original call boundaries; cancelled quit resumes the pending
reader. Existing 824-input failure,792-input treasure and857-input campaign
replays pass unchanged. See `reference/jungle-input.json` and `docs/jungle.md`.
These are static-source/controller/browser results, not a new original
full-scene timing capture. The complete suite passed with no skipped tests.


Title audio now has five controller cases and two native browser scenarios,
including the complete natural Sound001 ending, exact request acknowledgements,
keyboard activation, both devices, mute/no replay and restart/skip. Production
acceptance requires title request1 with the real original folder. Source-call
hashes and the browser startup adaptation are in `reference/title-audio.json`;
see `docs/tandy-audio.md`. The full suite passed unchanged campaign replays with
zero skipped cases. The initial failed browser assertion is retained locally;
it counted one Restart reset where the existing adapter/model emit two.


Photography's input milestone adds eight controller cases and a native keyboard
browser route. Entry/results reveals flush unread keys; the four shutter
presentations defer global input; pause freezes exact rendered pixels and actor
state while device clocks advance. Results read Fire immediately and retain an
exact40-read/280-tick neutral timeout. The22 existing runtime cases preserve
inputs,original artifacts,gameplay checkpoints,locals,pixels,RNG and outcomes;
only the documented final clock endpoints/base change. The full suite passed
with no skipped cases. See `reference/photography-input.json` and
`docs/photography.md`. Original full-scene pause/IRQ timing remains unverified.


Ending music now follows the original guarded words:1 before winner pictures,
1 at the replay prompt,0 when either choice returns,and main's0 after difficulty
confirmation or before No enters credits. Yes bypasses the browser title/music
adapter. Six conditional controller cases and two real bank-journey Tandy browser
routes pass,including original winner/replay pixels and exact acknowledged words.
The full suite has no skipped cases. See `reference/ending-audio.json` and
`docs/ending.md`. Ending bank animation,reveals,first Fire poll/global-key timing
and original full audio timelines remain incomplete or unverified.
