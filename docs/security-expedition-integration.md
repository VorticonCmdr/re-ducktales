# Expedition departures after security

This development milestone carries the real first-map security entry into
expedition, flight-input, atomic transport, photography and real-clock game
scenarios. Main remains054ac66. The remaining focused expedition recordings and
the full branch integration gate are still pending.

The shared security helper now has a real-clock observation adapter in addition
to its controlled-clock adapter. Both supply the same fixed Right/Fire choices
after the reveal and input readiness. Neither sets game state, changes a seed,
selects controls from expected outputs or skips the original departure.

## Delivered browser routes

- Original office and map pixels, keyboard bank travel and the real-time
  money-bin reward→security→bank→office→restart path, including actual audio.
- Departure dispatch for El Capitan, Okeefadokie, Yellerstone and Borneo, with
  original activity/flag identities retained.
- Hard Klondike takeoff→crash→Glomgold claim→audio-completed rival notice.
- Easy Klondike landing→cave navigation→intentional pit failure→retry without
  another flight→treasure award→collected notice→restart.
- Too-Pei race win/landing→cave treasure→atomic transmitter award→atomic
  transport→another expedition, including original calendar and outcome rules.
- Yellerstone landing→target photograph→remaining film→scoring→campaign award
  and return→rival speech completed by real media→collected notice→restart.
- Non-racing crash-repair controls: popup pixels, frozen actors with continuing
  driver clock, pause/quit cancellation, crash keyboard flush and exact140-count
  natural return wait.

Asset-corruption rejection, original failed-dive pose, local-folder loading and
the two explicitly conditional original presentation checks remain in the same
browser batch. Conditional checks do not establish a whole native route.

## Why the external player routes changed

The original security setup advances the shared seed1960→46760. The next two
departure draws produce54124, portrait0 and race roll24. A separate Game run from
verified originals confirms these boundaries. The first Easy departure therefore
races too. The previous deliberate-crash shortcuts award those treasures to
Glomgold; the port preserves that result.

The atomic and photography scenarios now fly to their destinations. Their
external feedback pilot observes current pose and supplies actual browser keys.
The two-day Too-Pei candidate was first checked in a bounded fresh-flight model
with altitude band25..40 and climb heading1, then validated in the complete
browser route. Photography uses the existing75..90/heading1 player policy.
These are independent adaptive browser scenarios, not fixed-stream native
comparisons or strict recorded campaign replays. The separately accepted full
Hard replay remains fixed-stream evidence.

The crash-repair case instead makes two actual Macaroon bank/office round trips
before choosing Klondike. Independent carried Game probes distinguish the office
and next map dispatch boundaries: office day7/seed62042→map7599 still races
(roll12), whereas office day13/seed19313→map162 gives departure48276/roll76 and
no race. The test checks both office seeds and requires the non-racing departure.
This preserves its intended repair-path coverage without changing the game.

No simulation, RNG, rendering or audio implementation changed in this milestone.
Historical pre-security records remain available under their original producers.

## Verification and evidence

```
npm run verify:departure
npx playwright test tests/browser/game.spec.js tests/browser/campaign.spec.js tests/browser/flight-input.spec.js tests/browser/atomic.spec.js tests/browser/photography.spec.js
```

Required originals and private comparison fixtures must be present. The native
departure verifier checks two conditional checkpoints, two RNG draws and two
negative controls. The browser command covers17 actual application cases.

Private run evidence is retained in
`.local/security-expedition-integration-20261028/`. Earlier `run.log` and
`rerun.log` are diagnostic records of obsolete seed expectations and player
routes; they must not be counted as green acceptance. Frozen source files and
checksums for the final combined run are in `final-sources/` and
`final-source-revision.json`; `final-run.log` and `final-results.json` record its
result. Conditional policy-planning files are separate from browser evidence.

The final combined run passed all17 cases with zero skips in3.2 minutes. The
native departure check also passed. Earlier diagnostic failures remain retained;
the acceptance result is the final combined run, not a union of those attempts.

Broader destination/difficulty coverage, fixed-input focused fixture migration,
promotion of the new full Hard recording and the full branch gate remain needed
before merging security into main. None of these checks establishes arbitrary
route finishability or native whole-campaign/IRQ/waveform parity.
