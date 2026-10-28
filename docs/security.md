# First-map security challenge

The development branch now connects office → control-center departure →
security → map. Two actual-browser routes pass, with four adjacent office/menu
regressions,117 unit cases, a production build and a missing-Right negative
control. Main remains at the separately verified office milestone054ac66 while
campaign replays are migrated. The full branch gate has not passed.

Run `npm run verify:security` for both native segments, focused receipts, fresh
browser cases and the negative control. `npm run verify:security-core` requires
the retained native/browser artifacts; missing or corrupt local files fail setup.
The development capture used an isolated5197 server; the standard command owns
its normal5186 test server.

## Evidence and behavior

Only the supported22-file build in `reference/build.json` is covered. The
actual real-mode overlay2 is checked against all8368 original bytes after180
relocations in this fresh launch. Source references below are overlay offsets,
not guessed addresses in a DOS loader stub.

- `07ad..0a42` generates four distinct letters, then an unsigned RNG draw modulo10
  selects the correct row. Each of the other nine rows gets four independently
  distinct letters. Repeated letters within a row retry the same slot. Distractor
  rows are not required to differ from the target or from each other.
- All draws use the carried shared16-bit RNG. The captured segment starts at
  seed55478 and independently reaches42707 through41 draws, with every native
  pre-read seed and RNG call site compared. The native target and correct-row
  stack locals match the translated result. No final seed supplies replay input.
- `0abf..0b70` uses whole-byte directions: Right3/Left7 change the row by1,
  Down5/Up1 by2. Values above9 become0; values below0 become9. Fire with a
  direction confirms the current row without movement. These direction rules
  are statically inferred; this capture exercises only neutral and Fire.
- The first wrong choice displays the yellow warning and requests sound70.
  The second wrong choice flashes the red/blank alarm three times, then exits.
  The captured native return is1. The supported executable has a forced-success
  branch near `0c9c`; the caller also uses `OR BP,BP` at `0f0f` rather than testing
  the return value. Preserve these build-specific quirks.
- `0e4e..0e59` clears a caller-owned flag before the first challenge. The resident
  campaign initializes that flag once per new campaign. The challenge is not a
  per-departure check. Connecting it will legitimately change later RNG states;
  the port must not reseed to retain the old campaign fixture.
- `0e89..0f0a` draws the day, money and footer before the challenge. The original
  signed32 money helper receives right edge176/y175. Omitting that draw caused
  the first pixel divergence; adding the source draw resolves it exactly.

The strict checker compares11 complete320×200 pictures: the control-center
exit, stable challenge, warning before/after its wait, six alarm presentations
and black return. It consumes seven separately versioned input events. Five
negative controls reject changed original code, zero RNG cases, a changed RNG
state, a missing picture and a changed pixel. No image tolerance, injected memory,
partial restore or fitted timer is used. A second native navigation scenario independently compares41 RNG boundaries,
nine inputs and13 full pictures, including the warning erased by Right and the
return to row0 with Left. The source-timed component carries both independent
input streams through separate retrace/count waits and every stable picture.
Native Up/Down and correct-first-choice coverage, elapsed-time parity and audio
waveform parity remain unverified.

## Reproducing the original segment

The installed DOSBox MCP bridge currently caches its port configuration.
`bridge_setup` does not update the running client/instance manager, so assuming a
new port selected a new child is unsafe. This recipe uses the bridge's existing
`Config`, `InstanceManager` and `DosboxClient` classes with a per-run configuration
on an isolated endpoint. It preflights the listener, refuses the shared8386 port,
and requires the handshake and every state capture to match its own child PID
and instance ID. It does not edit the installed bridge or global configuration.
Only its owned process is stopped in `finally`. This is a bounded workaround;
the bridge still needs the focused cached-settings/handshake correction described
in [office transitions](office-transitions.md).

Set `DUCKTALES_DOSBOX_MCP_ROOT` to the installed bridge source directory. Use its
existing Python environment to run:

```sh
python3 scripts/prepare-analysis.py
DUCKTALES_DOSBOX_MCP_ROOT=/path/to/dosbox-mcp PYTHONDONTWRITEBYTECODE=1 /path/to/dosbox-mcp/.venv/bin/python scripts/capture-security.py --output .local/security-native-new
```

The output directory must be new. The capture checks all original file hashes,
uses the operator's configured binary/mode/auth settings, mounts originals
read-only, and records CONFIG queries:3000 cycles,normal effective core,16MB and
svga_s3. The startup schedule presses N at1500ms, Space at5000/6500/8000ms and
Enter at9500ms, each held150ms. It requires all10 events to finish.

After confirming the complete relocated overlay, it observes neutral office
input and fixed Right+Fire195. It releases both at security entry, captures every
RNG boundary, then four neutral security polls. Fire is scheduled at the next
pre-read `0abf` boundary. Scheduling after a previous `0ac4` read is incorrect:
the intervening original `19a5` flush discards that press. It captures the warning,
observes a neutral poll, schedules another fixed Fire at the pre-read boundary,
and requires all six post-wait alarm checkpoints, cleanup and return1.

The first two attempts are incomplete exploratory artifacts and are excluded.
The accepted `.local/security-native-fire0-03/` contains43 files with checksums
in `reference/security.json`, plus the exact capture-script hash. Initial polls
0..2 are retained as exploratory scanout states; the initial image comparison
uses poll3 after three source waits. The initial RNG seed is an observed segment
starting state: startup BIOS/timer scheduling is not independently replayed.
A new capture may have a different initial seed and challenge; retain it as a
new scenario rather than replacing these expected results.

## Connected browser scope and remaining integration

`SecurityScreen` keeps front/back pages separate. Helper06d0 reconstructs the
back page from the clean challenge, so movement erases the warning. Original
seven-count selection waits,35-count warning/alarm waits,25-retrace reveal/wipe,
page flips and input reads use explicit clocks. Driver counts cannot substitute
for retraces. Global dialogs block simulation reads while clock observations
continue. The keyboard flush discards controls and queued system keys at source
boundaries. The office departure page remains the display until the next real
flip, rather than disappearing during its handoff to security.

The BIOS0 browser provider reaches entry seed1960 and leaves security at46760.
The positive keyboard route discards P/Down queued during reveal, pauses/resumes
at a real read, flushes Fire pressed while paused, selects the visible matching
row with fixed Right, confirms, returns/re-enters without another challenge,
and resets the one-shot flag on Restart. The second route uses visible buttons,
fixed wrong row0 choices, Right/Left warning erasure and all six alarm phases.
Its persistent Tandy device acknowledges0/5/33/0/111/70/70/70/70/33 and produces
nonzero samples. Eleven exact browser pixel comparisons cover the departure,
initial challenge, Right selection, warning/erasure and six alarm phases.
Challenge pixels use the independent BIOS0 initial state, not the browser's
reported target/final RNG. Native comparison uses its own separately captured
initial seeds. Missing the real Right fails the required correct-choice return.

`reference/security-browser.json` pins19 retained focused receipts including10
pictures and the producer sources. These are focused branch checks, not a full
campaign gate. The old Hard replay currently stops at checkpoint0 because the
new `securityPending` state field is absent from its previous snapshot. Its
external event stream also needs the actual security choices before flight;
then the newly carried RNG must determine subsequent routes. Old expected
outputs and input streams remain unchanged. Capture a new complete scenario,
replay it independently in Game and browser, update adjacent route tests and
current tool provenance, then run the complete required gate before integrating.

The native `--navigation` recipe schedules Right/Left at0b97, after the flush
and before the existing one-count wait. Pressing at0abf was too late for these
keyboard IRQs: attempts01/03 consumed0 and are excluded. Attempt02 failed its
port preflight. Complete navigation capture04 uses isolated8389, ownedPID51396,
instance8696ce4a79d6979e36121cf222065f36, entryseed47210 and finalseed35003.
It contains49 pinned files; no partial restore, memory writes or fitted waits.
The first fixed-Fire capture recipe remains pinned to its historical Git4098673
source even though the maintained recipe now adds navigation.

## Campaign migration experiments

The integration work uses actual security choices and keeps its changed shared
RNG. No game logic, race rule, seed or ownership flag was changed for these
experiments. The exploratory controller observes current flight pose and map
state; a strict regression will instead replay recorded external DOM events.
Old menu-era campaign inputs and expected outputs remain untouched.

- Capture01 reached the new first Hard departure at seed54124 but lost its race
  at273 flight reads. Capture02 was stopped because the helper still used its
  previous climb angle. These runs are incomplete and are not acceptance.
- Conditional first-flight planning tried explicit altitude/climb policies from
  the observed departure contract. First-flight Game memory is freshly created;
  the model is still planning evidence, not browser acceptance. The10..25 band
  and heading1 policy then independently won the actual browser race in286 reads.
  Its Carried Game flight result and browser entry agree on the new state.
- Capture03 reached Bermuda, but the previous444-input jungle route exhausted
  three lives at frame363. Conditional jungle planning used fresh memory at the
  observed seed40033/day2 entry; this cannot establish full carried-memory parity.
  Its zero-delay trial hit an exploration bound during a life reset and is
  incomplete. A candidate with three initial neutral reads was tested separately.
- Capture04 validated that447-input jungle sequence in the carried browser:
  treasure reached with all three lives,2150 returned to campaign and banked.
  Photography then completed on day12 with4050 cash. The rival had already
  claimed Klondike30, so the subsequent normal visit correctly showed its
  claimed-location notice. This is a legitimate campaign consequence, not a
  missing gameplay transition. The old route cannot assume that destination
  remains available under the new RNG.

A separate `Game` run from startup consumed all2316 recorded DOM events and
matched all11 state checkpoints through photography. The diagnostic replay uses
its declared100ms tail after those checkpoints and is explicitly exploratory;
it is neither a complete campaign nor strict acceptance. Its expected states
never select the input stream. Raw artifacts remain in ignored
`.local/security-campaign-through-photo-04/`; captured producer sources and
hashes are retained separately from inputs and expected observations.

The bounded planning code is saved as `scripts/explore-security-flight.js` and
`scripts/explore-security-jungle.js`. Both write local exploratory artifacts.
`reference/security-campaign-inputs.json` records their exact source/result
identities, conditional starting contracts, and the candidate fixed controls.
The corresponding maintained browser capture uses:

```sh
DUCKTALES_CAPTURE_HARD_CAMPAIGN=1 npx playwright test tests/browser/hard-campaign.spec.js
node scripts/replay-hard-campaign.js .local/security-campaign-through-photo-04 --diagnose
```

The browser capture is exploratory even when it completes. It still requires an
independent complete Game replay, an independent browser replay, negative
controls, fixture checks and the full integration gate. Capture05 used unclaimed Carlsbad34 through ordinary map travel, but the default
flight policy lost that race. A separate Game replay matches all12 checkpoints
up to the cave departure; copying its entire64K port data segment for conditional
flight trials reproduces the browser loss exactly at285 reads/tile39/seed31602.
A50..65 altitude band with heading1 then independently won the real browser race
in capture06, which completed Carlsbad on day14 with6950 cash and2150 banked.

Capture06 subsequently lost the mountain race. Its first16 checkpoints and3354
DOM events match an independent Game replay. Conditional planning from that
carried port state reproduces the279-read/tile37 loss. A50..65 band with heading2
wins in232 reads in the model. Continuing that model through the unchanged671
mountain inputs reaches the summit with three lives. Capture07 completed the whole route in the browser. Strict independent Game and
fresh-browser replays then consumed all4140 DOM events and matched28 exact
state/pixel checkpoints through the day31 ending:17200 against61000. Five
verifier negatives and one real missing-Hard-input browser negative pass. See
[the full scenario](hard-campaign-security.md); the branch integration gate and
other route migrations remain pending.
These planning copies are port data segments, not original emulator machine
checkpoints. No memory or state is injected into the browser campaign.

`node scripts/verify-security-campaign-progress.js` checks the retained partial
through-photography evidence and a wrong-security-direction negative control.
Its versioned manifest is `reference/security-campaign-progress.json`; missing
or corrupt artifacts fail setup. This optional diagnostic does not replace the
full required campaign gate. The source-controlled cave-flight, mountain-flight
and mountain-ascent explorers preserve the bounded planning recipes.
