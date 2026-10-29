# Mixed campaign browser acceptance

> Historical pre-security campaign evidence. Current winning Easy acceptance
> and commands are documented in [Security-aware Easy campaign](security-easy-campaign.md).
> These original inputs and expected results remain unchanged.


This scenario starts a fresh Easy campaign and completes the Okeefadokie jungle,
Yellerstone photography, Klondike cave and El Capitan mountain. It banks the first
treasure, returns to the office, carries its own state through the remaining
expeditions and Glomgold reports, then travels between the bank and office until
the deadline. The recorded route reaches day30 with15000 banked and no cash.

Run `npm run verify:mixed-campaign`. The command checks all22 original identities
before exercising the actual browser loader, keyboard/button adapters, rendering,
game scheduler and campaign. Missing or corrupt originals are setup failures.
The scenario is also included automatically in the full `npm run verify` browser
suite. Its manifest is [mixed-campaign.json](../reference/mixed-campaign.json).

The milestone passes full `npm run verify`:112 unit checks,60 development browser
scenarios and2 production browser scenarios, with zero skips, the required
original-data comparisons and the new negative control. The local log is
`.local/mixed-campaign/full-verify.log`; artifact checksums are recorded in the
manifest and local receipt. This does not establish original whole-campaign parity.

## Environment and comparisons

The external browser clock starts at2026-01-01T00:00:01Z, with8ms display callbacks
and sound explicitly disabled. This controls host latency without replacing the
game's simulation clocks. The browser supplies BIOS seed0. No game state, seed,
money, timer values or campaign outcomes are injected. This scenario does not
exercise native audio completion, folder selection in production, or persistence;
separate browser scenarios cover the first two boundaries.

Jungle consumes857 authored control samples and checks all23 existing startup
checkpoints. Mountain consumes764 authored ascent samples after the previous
expeditions; its incoming RNG is carried rather than reset to the ascent fixture.
Each sample must advance exactly one game action. These input streams are
independent of expected output snapshots.

Flight steering, photography aiming and cave navigation use bounded feedback
policies reading public `data-state` snapshots. These are browser acceptance
controllers, not frozen original input recordings or independent human play.
Their policy code never reads the expected campaign checkpoint values.

The test requires exactly19 named campaign checkpoints, including four arrivals,
four bank calls and six rival reports. Five return/ending checkpoints compare
scene, calendar, cash, banked money and RNG exactly. Expected values were recorded
from the port's first complete mixed run. They prevent subsequent regressions;
they are not DOSBox observations. No tolerance or masked deterministic difference
is accepted. Diagnostics, rendering exceptions, exhausted waits, missing
checkpoints and unfinished authored streams fail the run.

Office departures present an aircraft choice; departures from other locations
travel directly with the selected aircraft. Rival reports can interrupt opening
the map as well as travel. The controller handles these observed boundaries
explicitly. Its first exploratory failures were incorrect arrival/office-flow
assumptions in the new controller, not established game defects.

## Local captures and limits

Each execution writes `campaign-checkpoints.json`, `captured-events.json` and a
final `mixed-campaign-ending.png` under its ignored Playwright result directory.
Captured events record actual key down/up and pointer events with browser time;
they are independent external inputs, not derived from final expected states.
Full snapshots and the screenshot are diagnostic outputs. They are not required
native fixtures and can be regenerated from the versioned recipe and originals.
The archived local receipt in `.local/mixed-campaign/` pins capture checksums and
the capture-tool hash/revision. No proprietary output is committed.

Run `npm run verify:mixed-campaign-negative` for the separate negative control.
It sets `DUCKTALES_MIXED_NEGATIVE=wrong-jungle-input`.
It changes the first jungle control to Right while preserving the total sample
count. The actual jungle state comparison must reject it; an unrelated setup
failure does not count as a successful negative control.
The full `npm run verify` gate includes this control as well as the positive
campaign. The negative wrapper exits successfully only when the intended
position comparison rejects the wrong input.

This route supplies broader evidence of linked playability. Other difficulties,
destination variants, races and original whole-scene behavior still need targeted
verification. Browser acceptance does not establish original CPU, IRQ, hardware
audio or input-typematic timing.
