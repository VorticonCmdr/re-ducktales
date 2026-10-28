# Current port status

Updated2026-10-28. **The whole game is not complete.** The campaign loop and all
four expedition families are playable on selected routes. We still have
unverified routes and behavior gaps; arbitrary campaigns are not yet guaranteed
finishable. This is completion work, not only final polish.

## Working browser routes

- Original title reveal → office arrival/dialogue → difficulty → office →
  money-bin dive → reward/return. Fire can skip at original input boundaries. Original timing
  controls the one-time1000 coin and travel/banking resets its latch.
- Office → map → confirmed departure → keyboard flight → landing or crash/repair.
  All35 destinations can be inspected. Losing a race credits Glomgold and returns.
  Lightning strikes clear held controls and unread global keys before the next
  input poll; fresh keyboard input accelerates/climbs again. The missing callback
  is fixed, with exact original call/flush identities and a natural browser strike.
- Cave rooms → treasure or failure → results/map → direct retry. Safe new rooms
  pay50; ownership prevents duplicate treasure awards.
- Mountain walking/hook/climbing/hazards → complete variant0 ascent → reward/map.
  Hard Thunderclap/variant1 and Machu Picchu/variant2 also reach the summit with
  three lives, bank2100/2700 on day6 and restart. Their494/706 samples and59/73
  actor/hook/RNG checkpoints are required. See [Hard mountains](hard-mountains.md).
  Jungle jumping/climbing/vines/platforms/hazards → complete Easy/variant0 chest
  route → reward/map. Failures and retries also work; each has three lives.
- Hard → win the opening race → Bermuda Triangle jungle variant1 → treasure with
  three lives →2050 cash → bank on day6 → clean Restart. All444 authored jungle
  inputs and26 actor/RNG checkpoints are required. Hard Boola Boola Island also
  completes jungle variant2 through all four vines, returns1100 with three lives,
  banks on day6 and restarts;421 inputs and29 checkpoints are required.
  See [Hard routes](hard-expeditions.md).
- Photography aiming/twelve shots → results/reward → map, including the original
  shared-score quirk and duplicate protection.
- Earn the Atomic Matter Transmitter → office → atomic journey → next expedition,
  including misdirection, calendar/RNG, reports and deadline arrivals.
- Investments → portfolio/company → buy/sell → broker/office, with99-share limits,
  held Fire, company news and calendar processing. Unsold stock is excluded from
  final banked scores.
- Expedition entry activates normal Glomgold turns. Reports suspend and resume
  campaign actions; a new claim can prevent the intended departure. Idle map
  time does not advance him. Exhausted destination35 preserves the original alias.
- Macaroon arrival → original scales/piles/portraits → rolling balances → idle
  Fire/outro → map. Deposit happens once. Idle consumes the shared RNG. A deadline
  crossed on an office leg forces a final bank visit.
- Final bank → winner/loser pictures → replay. Ties favor Scrooge. Original row
  transitions, polling, credits and ending sound calls are connected. Yes returns
  to difficulty; No finishes credits. Explicit browser Restart opens the title.
- One fresh Easy campaign completes the jungle, photography, cave and mountain,
  banks treasure and carries its own state through Glomgold reports to the day30
  winning ending:15000 banked against10500. This is a repeatable browser regression,
  not an original whole-campaign replay. See [mixed campaign](mixed-campaign.md).

P/Q/S wait for activity input polls and source flushes discard unread keys.
Pause freezes actors/presentation while device clocks continue; quit cancellation
resumes the pending reader. Browser buttons, map clicking, Back/Office and pause
on tab hiding are explicit adapters. Browser keyboard holds supply the digital
control provider; original keyboard typematic timing is not established.

## Supported build and evidence

Only the22-file pairing in [build.json](../reference/build.json), with originals
in ignored `game/`, is supported. DUCKTALE.EXE SHA-256 is
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
This is MZ/EXEPACK, x86 LE16 real-mode game code plus overlays, with no extender.
The loader checks required originals; production visitors select their own folder.
Originals, dumps, traces and generated output are not committed or packaged.

Evidence levels remain distinct: bounded original routine/segment comparisons;
independent port replays carrying their own state; independent environment runs;
and actual browser controls/rendering/audio. None alone proves whole-game parity.
Manifests pin source/artifact identities, setup recipes, events and exclusions.
Conditional injections and provider assumptions are documented, not hidden.

The opening milestone passes full `npm run verify`:117 unit cases,67
development and2 production browser scenarios, zero skips, all required original
comparisons and the production build. Jungle variants1/2 consume444/421 inputs
at26/29 checkpoints; mountain variants1/2 consume494/706 inputs at59/73
checkpoints. Each route wins its Hard race, keeps three lives, banks its own
reward and restarts. Both wrong-climb and both missing-hook controls fail at
the intended comparisons. Four immutable archives contain14 artifacts each;
receipts are under `.local/hard-jungle/`, `.local/boola-jungle/`,
`.local/hard-thunderclap/` and `.local/hard-machu/`. Earlier archives are unchanged.
The shared adapter and case modules are pinned separately. The mixed campaign
still matches all19 checkpoints. [Historical notes](status-history.md) retain
older receipts without describing them as current state.

The opening now has a separate `npm run verify:opening`: three closed-loop
cases,33 exact native PNG comparisons, six native sound cleanup calls and three
fresh relocated code mappings. Source waits and RNG are translated; original
CPU/file/render costs and complete elapsed-time parity remain unverified.
The browser checks also compare16 RNG-independent reveal/arrival frames and
exercise natural completion, skip, restart, campaign initialization and intro
audio. Accepted evidence is in `.local/opening-acceptance/`; hashes are pinned
in `reference/opening.json`.
See [opening implementation/evidence](opening-investigation.md).

Tandy/PCjr sound is available in-game with persistent channels, priorities,
flight-engine words and explicit completion status. All121 public requests have
viewer playback. Sound001 finishes naturally after3558 sequencer ticks (~49s),
and title/ending dispatch is connected. PC speaker remains the default with
approximate noise and an omitted engine. Hardware waveform, gain/filter and
whole-game IRQ alignment remain unverified.

## Remaining gaps and next milestone

- Broaden complete destination/difficulty routes and targeted original comparisons.
  Cave movement, mountain hook/ascent, jungle actors/scrolling and other variants
  do not yet have comprehensive original whole-scene parity evidence.
- Security, original difficulty presentation, office/door and several map/notice transitions
  remain omitted or incomplete. BIOS seed0 is an explicit browser provider.
- Bank nonzero complete-animation/sparkle pixels, unusual signed-overflow sprite
  aliases and whole original CPU/IRQ/input timing still need work. Unsupported
  aliases stop with a diagnostic rather than substituting a picture.
- No save/load/high-score path has been identified in this build. Browser
  persistence would be an explicit addition, not a translated original format.
- A complete original campaign replay and arbitrary-campaign finishability remain
  unproven. Unsupported paths stop in development; no recovery demo counts as
  strict acceptance.

Next playable milestone: complete a linked thirty-day Hard campaign across all
four expedition families, through banking and the final result. All three jungle
and mountain layouts have selected completion routes; linking them does not yet
prove arbitrary campaigns finishable. Follow with the original difficulty,
security and office/door presentation using targeted native scenarios rather
than broad executable documentation.

Current Hard investigation: a carried second flight exposed visible landing-flag
frame255. The renderer now reproduces the original decoded-memory alias into
the following plane image. Two native decoded buffers and one conditional
original blit match exactly (all65536 VGA bytes); three negative controls fail.
The exploratory browser route reaches photography on day10 after the Bermuda
jungle and bank deposit, then earns4500 from nine target photos and returns on
day12. Its third flight crashes and reaches the rival-claim branch on day13;
the next experiment is a better flight input route from that carried state.
The remaining linked route is not yet accepted. Exploratory capture07 and its
13 checkpoints are in ignored `.local/hard-campaign/exploration-07/`; its failed
full-route assertion is not acceptance. The independent1311-input diagnostic
replays eight prior complete state checkpoints past the former rendering error;
its incomplete endpoint with held Fire and100ms tail is also not acceptance.
See [flag evidence and reproduction](flight-flag-alias.md). Focused flight
regressions,117 unit tests and the production build pass; this is not a new full
suite result.

## Exact verification commands

`npm run verify` is the required full gate. It fails on missing/corrupt required
fixtures, incomplete case/input counts, unsupported paths and comparison failures.
It includes unit checks, original comparisons, browser scenarios and production.
For both Hard race/jungle/bank/restart routes run `npm run verify:hard-expedition`.
For the third jungle layout alone run `npm run verify:boola-expedition`.
For the Hard mountain variants1/2 run `npm run verify:hard-mountains`; each
missing-hook control must fail checkpoint5 action.
Its wrong-climb control must fail at checkpoint22, not at setup or a timeout.
For the lightning input boundary run `npm run verify:flight-lightning`. Its
missing-provider control must fail at the intended natural collision boundary.
For the linked campaign run `npm run verify:mixed-campaign` and
`npm run verify:mixed-campaign-negative`. The latter succeeds only when a wrong
input is rejected by the intended state comparison.
For bank work run `npm run verify:bank`, `node --test tests/bank.test.js`, and
`npm run test:browser -- tests/browser/bank.spec.js tests/browser/ending.spec.js tests/browser/ending-audio.spec.js tests/browser/ending-presentation.spec.js`.
For original opening images, state and code mapping run `npm run verify:opening`;
for actual browser opening controls/rendering run
`npm run test:browser -- tests/browser/opening.spec.js tests/browser/title-audio.spec.js`.
For local testing run `npm run dev -- --port 5186`.
The user's integrated checkout is served on5187. No push or deployment is authorized.

Detailed evidence: [Hard route](hard-expeditions.md), [mixed campaign](mixed-campaign.md), [bank](bank.md), [endings](ending.md), [flight](flight.md),
[caves](cave.md), [mountains](mountain.md), [jungle](jungle.md),
[photography](photography.md), [trading](investments.md), [rival](rival.md),
[atomic travel](atomic-transport.md), [controls](system-controls.md),
[Tandy audio](tandy-audio.md), [executable identity](executable.md).
