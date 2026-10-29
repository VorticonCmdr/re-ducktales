# Historical port milestone notes

Snapshots archived through2026-10-30; each entry describes its own source revision. These entries describe earlier
milestones and their local receipts; they are not the current port status or
current emulator state. See [current status](STATUS.md), [bank evidence](bank.md)
and the individual subsystem documents for current boundaries.

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
- Office → map → Macaroon bank → office. The bank now uses its original scales,
  piles, rolling balances, idle RNG and Fire/outro wait. All35 destinations can be inspected.
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
  credits and a finished screen. Pictures use the original five row groups,
  losing scores use MAIN38, and P/Q/S wait for ending input polls. All26 credits
  and both skip clicks are connected. Restart remains available as a browser adapter.

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
  Ending row-group reveals and source input polling are translated and checked.
  Bank animation is translated with conditional original arithmetic/pixel/input
  evidence; nonzero full-animation and original CPU/IRQ timing remain unverified.
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

Previous committed milestone passed full `npm run verify`: 96 unit tests, 56 development
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
`docs/ending.md`. Subsequent presentation/input and bank milestones are described below; original
full audio timelines remain unverified.


Ending presentation/input work now adds original five-group wipes/reveals,
source-aligned first Fire polling and global-key flushes, one-retrace page flips,
14-tick replay arrow delays, all26 credit pages and the separate credits-entry,
skip and farewell sound calls. The losing second picture now correctly uses
MAIN38. Eight controller cases and one browser journey cover exact row pixels,
flush/pause behavior, natural credits and skip events. Existing original captures
and expected completed pixels are unchanged. Full `npm run verify` passes104 unit cases,57 development browser scenarios
and two production browser scenarios, all with zero skips, plus the required
original-data comparisons and build. The local receipt is
`.local/ending-presentation-full-verify.log`. See `reference/ending-presentation.json`
and `docs/ending.md` for exact commands and evidence boundaries. The following bank milestone translates its preceding presentation and caller
clear/flip. Full-machine ending timing, hardware sound parity and a complete
original campaign replay remain unverified. The whole-game goal is still incomplete.


Bank integration work adds MAC.ARC loading, original scales/piles/portraits,
right-to-left balance digits, both graphics pages, idle RNG, polling/global
controls, Fire/outro and the caller clear/flip. Normal and forced-deadline bank
visits are connected. Eight conditional native arithmetic cases, two exact native
PNGs, a first RNG checkpoint and four directly captured input reads pass strict
comparison, as does the separate280-tick neutral outro. Eight controller cases
and two real browser bank journeys pass;112 unit cases pass. Full regression
verification and updated ending/trading journeys are still pending. See
[bank evidence and commands](bank.md) and `reference/bank.json`. Nonzero complete
animation pixels, unusual signed-overflow sprite aliases and whole CPU/IRQ timing
remain gaps. Existing whole-game limitations above still apply.


## Office integration —2026-10-29

Source d34d194 passed the complete required gate:117 unit,91 development-browser
and2 production-browser cases,zero skips. All515 tested source files and the
actual successful runner status are retained with the private full-run receipts.
`reference/office-integration.json` and its strict checker record this milestone
separately from the previous security integration. Two failed full attempts and
the affected focused browser corrections remain separate evidence. Whole-game
completion is not claimed.


---

# Snapshot before the final jungle component migration receipt

Archived2026-10-30 from `f6d0f05:docs/STATUS.md`. Earlier pass claims below apply
to their named milestones; use [current status](STATUS.md) for current gates.

# Port status at f6d0f05

Updated 2026-10-30. **The whole game is incomplete. This is completion work,
not only fine-tuning.** Selected complete campaigns are playable and verified;
arbitrary-route finishability and full original-game parity remain unproven.

## Movement pacing investigation

Mountain sprite work is integrated; its focused climb/browser gate passed at
its milestone. Remaining original execution costs are still omitted. Jungle now charges actual
sprite/copy work against an explicit simulation clock before presentation. The
six original conditional drawing comparisons show ordinary restoration costs
about 27 ms, while full redraws cost about 162–178 ms and exceed the original
three-count movement deadline. Focused browser redraw-duration, pause, quit and
audio checks pass; removing the graphics wait fails the browser duration check.
All 127 unit cases and the production build pass.
[Jungle evidence and runtime boundary](jungle-timing.md).
The complete treasure route now also passes independent Game and fixed-event
browser replays: 27 exact states/pictures, 70 DOM events, all 860 movement
samples, $1,050 and one life. Required movement removal fails. Its new contract
is `reference/draw-timed-jungle-treasure.json`; the full scoped command is
`npm run verify:jungle-draw-timing`. The historical component contracts are now
explicitly migrated:1,616 input-boundary DS comparisons,1,714 ordered images and
40 gameplay checkpoints remain exact apart from separately checked timing.
Seventeen negative controls pass. [Migration](jungle-component-timing.md).
The broader required gate and older source receipts still need migration. Cave and safari pacing remain open. This does
not change the whole-game status above.

The combined command passed on `cc716c1`: six original drawing cases, 127 unit
cases, both browser routes, both browser negatives, exact source/state/picture
receipt verification and production build. [Integration receipt](../reference/jungle-draw-timing-integration.json).
Next: measure cave/safari work before changing their pacing, then refresh the
broader source receipts and complete campaign regressions.

## Optional security restoration

The working branch adds an unchecked **Original security system** option below
the screen. It restores the surviving failure path after two wrong answers;
default play retains the supplied executable's forced success. The correct code
is logged once per challenge. Restart starts a new session and retains the
page's preference. [Behavior and source evidence](security.md#optional-restoration).
`npm run verify:security-restoration` passes, including three browser cases and
the missing-checkbox negative control. All 123 unit cases and both existing
complete Game campaign replays also pass (64 state/picture checkpoints).
This restoration is statically inferred from the patched executable, not a
comparison against an independently obtained unpatched edition. Broader port
completion and verification limitations below still apply.

## Current verified branch

The keyboard milestone `c582295` connects the destination dialog to the original
ordinary-key reader. I/J/K/M, keypad directions/center/Enter, physical releases and fresh repeat
makes now work. Original entry, selection and confirmation waits remain connected.
The complete focused keyboard command, both complete campaign commands and the
production build pass, with 573 exact source files archived.
[Verification receipt](../reference/destination-keyboard-integration.json).

Fresh checks cover 123 unit cases, five focused browser cases and two complete
browser campaigns, with zero skips. Easy wins on day 32 with 13,875 against 11,500;
Hard loses on day 31 with 17,200 against 61,000. Independent Game and real browser
replays consume all 7,650 events and compare all 64 full states/pictures, with
2,817 flight presentations. No captured inputs, timestamps or expected states
were edited for the keyboard repair. Required input omissions fail.
Two additional atomic browser cases and five conditional original atomic checks
also pass, covering the unlocked third transport choice.

Original comparisons separately check 26 destination reads and their full key
flags, four complete destination pictures, and 29 CPU/video observations. The new
16-read case also runs through an independently initialized Game with declared
fixture clocks. These are scoped native routine/caller comparisons, not a native
complete-campaign comparison or proof of CPU/scanout timing parity.
[Keyboard scope](destination-keyboard.md), [explicit waits](destination-waits.md).

The main checkout remains clean at `59af3c6`; its preview on port 5187 is unchanged.
The last complete historical `npm run verify` passed on `8446d79`: 117 unit,
91 development-browser and two production-browser cases, zero skips.
[Historical full-gate receipt](../reference/keyboard-integration.json).
That run predates this map/destination branch. **The required broader gate has
not passed on the current branch.** The current production build passes; no new
production-browser acceptance is claimed.

## Refreshed focused routes

The destination-aware jungle and mountain contracts now have independent current
browser replays and strict Game checks: 55 complete state/picture checkpoints,
224 separately consumed DOM events and the unchanged 860 jungle / 764 mountain
movement samples. Mountain returns $8,100 with three lives and both rival reports;
jungle returns $1,050 with one life. Both reject duplicate treasure collection.
Three manifests pin original build, capture/browser sources, raw declarations,
actual replay events/states and required missing-movement failures. Fifteen
fixture/setup negatives also pass. `npm run verify:destination-routes` passes
all five fresh browser cases and both real missing-movement controls.
These are focused port/browser checks, not
native whole-level parity or a completed broader integration gate.
[Evidence and reproduction](destination-route-integration.md).

## Movement timing

Mountain now charges original sprite execution work before retrace. The captured
walk spans599.264ms versus604.032ms in the original counter benchmark, with the
checked actor/action/RNG values preserved. A separate original observer takes80
read-only samples without intermediate stops and brackets26 page changes at a
mean42.234–43.375ms per update in that scene. Dense debugger stops perturb timing;
they are not an uninterrupted reference.

**`npm run verify:mountain-sprite-timing` passed at `ce112a8`.** It covered the original/port
component checks,764-input summit,870 presentations,27 exact browser state/picture
checkpoints,104 DOM events,$8,100 returned cash,three lives,600ms real DOM hold,pause/quit,
life reset and required component/browser negatives. All123 unit cases and the
production build also pass. [Verification receipt](../reference/mountain-sprite-timing-integration.json).

Mountain timing remains partial: copies,text,lines,asset loading and other CPU
costs are uncharged. Jungle sprite/copy pacing is now integrated and verified by
the fresh route above; cave/safari pacing remains unchanged. The historical
mountain browser source receipt needs refresh after the jungle/shared-clock
changes, even though the mountain implementation is unchanged. The expedition adapter still
misses the original release-edge direction. Earlier Hard/campaign timing receipts
need refresh. `npm run verify:shared-runtime` still fails its historical runtime
file inventory; the full required integration gate is not green. Next: extend
work accounting and expedition evidence, then migrate the broader regressions.
[Scope, source locations and reproduction](expedition-timing.md).

## Connected gameplay and evidence

- Opening/Sound 001 → difficulty → office, money-bin dive/reward/return and
  Restart. Investments have their original seven-flip departure and trading.
  [Office menu](office-menu.md), [investments](office-investments.md).
- Control center/security → map → destination/aircraft choice → departure →
  controlled flight → jungle, mountain, cave or photography → reward/failure →
  map, rival reports and banking. Calendar/deadline handling, atomic transport
  and both endings are connected. Both complete current campaign routes exercise
  all four expedition families.
  [Easy contract](../reference/easy-campaign-destination.json),
  [Hard contract](../reference/hard-campaign-destination.json).
- Map input has 36 original flag/pointer comparisons; its deadline component has
  35 original completion calls and 70 independently captured clock results.
  Current focused browser checks include aliases, raw makes/releases and steady
  six-count polls. [Map integration](map-input-integration.md).
- Natural jungle and mountain routes now have refreshed destination-aware
  contracts as described above. Earlier alternate Hard and lightning routes
  retain their independent streams and historical receipts; those still need
  migration/acceptance with the newer map timing. [Earlier milestones](status-history.md).
- Tandy/PCjr playback includes Sound 001 (~49s/3,558 sequencer ticks), persistent
  channels, priorities, engine words, mute and completion. All 121 public requests
  have viewer playback. PC speaker remains the default; waveform parity is open.

## Supported build

Only the 22-file pairing in [build.json](../reference/build.json) is supported.
DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
MZ/EXEPACK, x86 LE16 real mode, overlays, no extender. Relocated original bytes
validate actual game code and runtime correspondence on native launches.
Originals remain untouched in ignored `game/`; captures, pictures and traces stay
local. Production visitors select their own originals. Nothing is deployed.

## Remaining work and next milestone

- Finish the destination's autonomous neutral polling, CPU draw/flush/read window
  and deferred system-key polling. The browser currently prompts reads from
  external makes. It does not implement the original recurring loop or invent a
  fixed drawing cost. Original first-map drawing and exact video/cache phase
  alignment also remain open.
- Integrate the refreshed routes with the full required regression suite. Older
  event streams legitimately send commands during the newly implemented entry
  wipe; preserve them and produce independent replacements rather than weakening
  comparisons. The main preview stays on its accepted source until integration.
- Investigate the reported fast expedition movement in jungle, mountain, cave
  and safari. Browser simulation already uses
  separate fixed driver/retrace clocks; original CPU work between explicit waits
  is not fully represented. Do not assume a high-refresh display is the cause or
  apply an overall speed multiplier without a timed original comparison.
- Broader destinations/difficulties, original whole-scene/campaign comparisons
  and arbitrary-route finishability remain unproven. CPU/file/IRQ timing and
  physical audio waveform/gain/filter parity also remain open.
- Nonzero bank/sparkle pixels and unusual sprite aliases have limited native
  coverage. Speaker noise is approximate and its engine is omitted. BIOS seed 0
  is an explicit browser provider; original time-of-day seeding is pending.
- No original save/load/high-score format has been identified. Browser persistence
  would be an explicit addition unless original behavior is established.

## Verification

```
npm run verify:destination-keyboard
npm run verify:destination-routes-core
npm run verify:destination-routes
npm run verify:easy-destination-campaign
npm run verify:hard-destination-campaign
npm run verify:destination-waits
npm run verify:map-input-browser
npm run build
```

Missing/corrupt fixtures, zero cases, incomplete required input and mismatches
fail. `npm run verify` remains the required broader integration gate; its older
fixtures and source guards have not yet been migrated for this branch.
Local development: `npm run dev -- --port 5186`. Main preview: port 5187.
