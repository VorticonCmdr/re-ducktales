# Hard races and jungle expeditions

> Historical pre-security evidence. The recipes and numerical results below
> describe that earlier build. Current route commands use the security-aware
> recordings documented in [Hard alternate expeditions](security-hard-expeditions.md).
> Original inputs and expected results are preserved.


The browser route starts a fresh Hard Earned Cash campaign, wins the first race
to Bermuda Triangle, completes jungle variant1 with all three lives, returns with
2050 cash, deposits it at Macaroon on day6, and restarts cleanly. No game state,
RNG seed, actor position, campaign ownership or score is written by the test.

Run `npm run verify:hard-expedition`. It checks the22 original file identities,
runs the actual browser route and then requires a deliberately wrong climb to
fail. The positive case and negative control are included in `npm run verify`.
Missing/corrupt inputs, changed capture-tool identity, zero cases, missing or
skipped checkpoints, unfinished control sequences and browser errors fail.

The input policy is in
[hard-expedition-inputs.json](../reference/hard-expedition-inputs.json).
Expected checkpoints and evidence scope are separately recorded in
[hard-jungle-browser.json](../reference/hard-jungle-browser.json).
The browser supplies BIOS seed0, muted sound and an8ms display callback clock;
the game retains its separate driver and retrace clocks. Assets load while time
is frozen. Startup uses800ms of explicitly scheduled input before the flight;
the absolute navigation/performance clock origin is not assumed.

## Route and evidence

The flight feedback controller observes the same state publication boundary as
the browser: after every display callback, including driver updates between
retraces. Earlier isolated model controllers observed only retraces and their
wins did not carry over to the browser. Aligning the observer produced a real
keyboard race win in226 flight actions. No simulation or race rule was changed.
The generated course starts with seed54448; the successful flight returns16696,
the guide consumes its own RNG, and the jungle enters with15567. These are
checked outputs of normal startup, not injected starting values.

The authored jungle sequence uses444 samples across18 packets: walk near the
edges of moving platforms, climb with Up, ride/release both vines, wait for the
middle sleeping-animal crossing, then wait for the final platform to rise before
climbing to the treasure. The neutral waits are player input. No timer, allocator
value or expected output supplies a simulated device result.

The bounded explorer starts at the observed flight boundary (seed54448,Hard,
one day,racing1,day1), rather than reproducing title/market startup. It used the
existing Flight/Jungle classes and original resources, carrying its own winning
flight memory into the jungle. This conditional component exploration produced
the candidate control sequence and26 actor/RNG checkpoints. Actual browser input
then reproduced all26 exactly, with three lives,50 in pickups, a2000 treasure,
and the day3 campaign return. The bank and Restart checks continue that same
campaign state. Full snapshots and actual keyboard/pointer events stay local.

This is independent port regression plus browser acceptance. Existing bounded
original routine/control/presentation comparisons remain separate evidence.
There is no new DOSBox Hard race or full variant1 gameplay capture, and this
does not prove whole-original level/CPU/IRQ timing parity. The model's isolated
jungle clock phase differs from the browser's carried clocks; only the listed
actor, geometry, money and RNG values compare across them. Device counters and
presentation counters are outside that comparison, rather than fitted.

## Strict comparison and captures

Every authored jungle sample must advance exactly one input action. All444 must
be consumed, and all26 checkpoints must execute in order. Expected fields never
choose the controller's inputs. A separate negative run changes input13 from Up
to Right without altering counts; checkpoint22's position must reject it. A setup
failure or timeout does not satisfy that negative control.

Flight, jungle, return and bank snapshots, the actual input-event log and the
treasure screenshot are generated under ignored Playwright output directories.
The event log records key codes/times and pointer targets; map click coordinates
come from the separate authored recipe and capture tool. It is a diagnostic log,
not a standalone frozen pointer-event replay.
Accepted captures and logs are copied to an immutable archive under
`.local/hard-jungle/`; the manifest/local receipt records checksums. They are
diagnostic port outputs, not required native fixtures. The input files, verifier
and recipe are versioned; no original files, decoded asset dumps or traces are
committed.

The whole game remains incomplete. Broader linked campaigns/difficulties, the
original opening/office transitions and original full-scene parity remain work. These
routes do not prove a complete thirty-day Hard campaign or arbitrary-route
finishability.

These milestones pass full `npm run verify`:113 unit checks,65 development browser
scenarios and2 production scenarios, zero skips, the required original comparisons
and all required wrong-input controls. `.local/hard-jungle/receipt.json` points to the
immutable accepted archive, and `.local/boola-jungle/receipt.json` does the same
for Boola. Each archive contains14 artifacts, including the shared capture dependency. The versioned manifests record checksums and
capture-tool/input identities. The existing mixed Easy campaign still matches
all19 checkpoints.

## Boola Boola Island: third jungle layout

`npm run verify:boola-expedition` selects the Hard Boola route. The shared browser
scenario keeps both routes in one implementation. Its separate authored input
stream is [boola-expedition-inputs.json](../reference/boola-expedition-inputs.json);
expected results and scope are in
[boola-jungle-browser.json](../reference/boola-jungle-browser.json).

From the fresh muted title, select Hard and click logical56,110 on the map.
Confirm Launchpad's flight, win the one-day race, then enter jungle variant2.
The flight's226 actions return seed16696; the guide returns6768 and this layout's
initial hazard updates produce20869. The Bermuda layout initializes different
hazards and returns15567 instead. These are observed game outputs, not injected
values.

The421 jungle samples in12 packets traverse four vines. Up stays on a vine;
Right releases it. The final swing must reach the upper row before release so
Scrooge lands on the row1 platform above the animal, then drops to the chest.
Seven neutral samples before that swing are authored player waiting. All29
actor/RNG checkpoints compare exact fields, with three lives retained. The chest
awards the original Golden Boola Hoop (1000) plus100 pickups, giving1100 on day3.
Return to Macaroon banks1100 on day6; Restart clears the campaign.

The negative control changes the first Up to Right and must fail checkpoint22's
X comparison. It has its own output directory and leaves the positive run's
captures intact. Local captures/receipts live under `.local/boola-jungle/`.
The bounded model exploration carries its own flight memory into the level;
actual browser acceptance carries state from the title through the bank.
No new original full-level capture or native timing equivalence is claimed.

The shared input/flight/bank adapter also supports the separately scoped
[Hard mountain routes](hard-mountains.md). Capture manifests pin the shared
adapter as a dependency; changing it requires the corresponding regression checks.
