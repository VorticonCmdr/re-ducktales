# Current port status

Updated2026-10-28. **The whole game is not complete.** The campaign loop and all
four expedition families are playable on selected routes. We still have
unverified routes and behavior gaps; arbitrary campaigns are not yet guaranteed
finishable. This is completion work, not only final polish.

## Working browser routes

- Title → difficulty → office → money-bin dive → reward/return. Original timing
  controls the one-time1000 coin and travel/banking resets its latch.
- Office → map → confirmed departure → keyboard flight → landing or crash/repair.
  All35 destinations can be inspected. Losing a race credits Glomgold and returns.
  Lightning strikes clear held controls and unread global keys before the next
  input poll; fresh keyboard input accelerates/climbs again. The missing callback
  is fixed, with exact original call/flush identities and a natural browser strike.
- Cave rooms → treasure or failure → results/map → direct retry. Safe new rooms
  pay50; ownership prevents duplicate treasure awards.
- Mountain walking/hook/climbing/hazards → complete variant0 ascent → reward/map.
  Jungle jumping/climbing/vines/platforms/hazards → complete Easy/variant0 chest
  route → reward/map. Failures and retries also work; each has three lives.
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

The lightning-input milestone passes full `npm run verify`:113 unit cases,61 development
and2 production browser scenarios, with zero skips, all required original-data
comparisons and the production build. The new checks pin the original lightning
switch/call/flush bytes, reject a missing callback, and verify generated-strike
input ordering plus real browser recovery. The component Pause trigger is an
authored adversarial test, not an original lightning input timeline.
The current full receipt is `.local/flight-lightning/full-verify.log`.
Earlier bank and mixed-campaign receipts remain preserved; the mixed route still
matches all19 campaign checkpoints. [Historical notes](status-history.md) retain older
receipts and investigations without describing them as current state.

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
- Original title/story/security, office/door and several map/notice transitions
  remain omitted or incomplete. BIOS seed0 is an explicit browser provider.
- Bank nonzero complete-animation/sparkle pixels, unusual signed-overflow sprite
  aliases and whole original CPU/IRQ/input timing still need work. Unsupported
  aliases stop with a diagnostic rather than substituting a picture.
- No save/load/high-score path has been identified in this build. Browser
  persistence would be an explicit addition, not a translated original format.
- A complete original campaign replay and arbitrary-campaign finishability remain
  unproven. Unsupported paths stop in development; no recovery demo counts as
  strict acceptance.

Next playable milestone: extend linked campaigns to another difficulty and other
expedition variants, starting with a winning Hard flight into Bermuda Triangle's
variant1 jungle. The exploratory Hard controller still loses its race; a model
controller win alone is not browser acceptance. The investigation found and fixed
the separate lightning input-clear omission. The current mixed Easy campaign
still completes; arbitrary routes and original whole-scene parity remain unproven.

## Exact verification commands

`npm run verify` is the required full gate. It fails on missing/corrupt required
fixtures, incomplete case/input counts, unsupported paths and comparison failures.
It includes unit checks, original comparisons, browser scenarios and production.
For the lightning input boundary run `npm run verify:flight-lightning`. Its
missing-provider control must fail at the intended natural collision boundary.
For the linked campaign run `npm run verify:mixed-campaign` and
`npm run verify:mixed-campaign-negative`. The latter succeeds only when a wrong
input is rejected by the intended state comparison.
For bank work run `npm run verify:bank`, `node --test tests/bank.test.js`, and
`npm run test:browser -- tests/browser/bank.spec.js tests/browser/ending.spec.js tests/browser/ending-audio.spec.js tests/browser/ending-presentation.spec.js`.
For local testing run `npm run dev -- --port 5186`.
The user's integrated checkout is served on5187. No push or deployment is authorized.

Detailed evidence: [mixed campaign](mixed-campaign.md), [bank](bank.md), [endings](ending.md), [flight](flight.md),
[caves](cave.md), [mountains](mountain.md), [jungle](jungle.md),
[photography](photography.md), [trading](investments.md), [rival](rival.md),
[atomic travel](atomic-transport.md), [controls](system-controls.md),
[Tandy audio](tandy-audio.md), [executable identity](executable.md).
