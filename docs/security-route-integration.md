# Security-aware travel integration

The development branch now carries the original security entry through bank,
map-pointer, ending, investment and system-control browser routes. Main remains
054ac66. The full branch gate and the remaining expedition-route migrations are
pending; this is not whole-game completion or native whole-campaign parity.

The shared helper waits for the queued office action to leave the office before
checking the next screen. It then waits through the original departure and
challenge reveal, supplies fixed Right/Fire, and requires map return with the
per-campaign security flag cleared. Inputs do not depend on a decoded target,
expected final state or fitted seed. Supported conditions remain fresh BIOS0
campaigns, including the tested money-bin and stock-trading detours.

The verified browser paths cover zero/earned-money bank arrivals, original bank
idle pixels, pause and quit, animated deposit, exact map pointer chords, winning
and tied endings, replay/restart, a lost Hard flight race and Glomgold ending,
investment transactions/news, natural credits and both focused security cases.
Existing money, calendar, ending-picture and system-popup assertions remain.

Security changes the shared RNG before calendar travel. The old pre-security
investment expectation (companies10/11, statuses3/4) does not describe this route.
A separate Game run from verified originals executes fixed security controls and
four bank/office round trips without state injection. It produces day/seed pairs
7/62042,13/19313,19/6124,25/54134, followed by bulletins3/1,8/1,10/3. The actual
browser matches all four exact seeds and all three ordered bulletins, consumes
each once and reopens the portfolio without repeating them. The manifest is
[security-market-route.json](../reference/security-market-route.json). This is
carried port regression evidence, not a fresh DOSBox campaign observation.

## Reproduce

Required originals and the existing private native fixtures must be installed
as described in [security.md](security.md) and [investments.md](investments.md).
Missing or corrupt originals fail setup.

```
npm run verify:startup
npm run verify:security-core
node scripts/verify-security-browser-negative.js
npx playwright test tests/browser/map-pointer.spec.js tests/browser/bank.spec.js tests/browser/ending.spec.js tests/browser/system-controls.spec.js tests/browser/investments.spec.js tests/browser/security.spec.js
```

The startup command now also verifies the four market checkpoints, three
bulletins, consumed-news reentry and two deliberate comparison failures. The
native security command retains its two independent segment scenarios and
negative controls. The actual-browser negative omits Right and must reject the
required correct-choice return.

## Retained run evidence

Private receipts are in `.local/security-route-integration-20261028/`:

- `run.log`/`results.json`: initial expanded run,10 passed and one failed at the
  obsolete investment company expectation. This run is diagnostic, not green
  acceptance.
- `market-run.log`/`market-results.json`: both investment cases pass after the
  independent Game reproduction and exact expectation update. Across these
  runs, all11 distinct browser cases pass; only the affected investment cases
  were repeated.
- `security-core.log`, `startup.log`, `security-negative.log`: successful required
  focused checks. `market-probe.json` preserves the initial independent route
  reproduction; the committed verifier replaces the exploratory probe.

No simulation, RNG or rendering code changed in this integration step. Earlier
Hard recordings and their native/port evidence remain pinned to their original
producers. The new complete Hard scenario remains independently accepted in
[hard-campaign-security.md](hard-campaign-security.md). Remaining work is to
migrate other travel/expedition setups, promote that new recording deliberately,
then run the complete branch gate before integration into main.
