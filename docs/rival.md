# Glomgold campaign progression

Supported build: the original EXE/resources pinned in [build.json](../reference/build.json).
The semantic implementation is `src/game/rival.js`; application dispatch and
pending actions live in `src/game/application.js`. Originals and captures remain
local and ignored. `npm run verify:rival` fails for missing/corrupt captures,
wrong code identity, missing cases, state/RNG differences or report pixel differences.

## Rules and evidence

Observed and regression-validated, within the conditional cases below:

- Resident `126b:0008..032c` advances **one trip per completed root action**.
  It returns without RNG if player day is less than2, before the rival's scheduled
  day, or the expedition unlock mask is zero. Day comparisons are signed bytes.
- Easy takes the first eligible treasure. Standard uses nearest travel duration
  on odd rival days and highest signed16 value on even rival days. Hard maximizes
  the truncated signed value/travel-day ratio. Strict comparisons retain the first
  tie. Current, player-collected and rival-collected locations are excluded.
- Carried cash above1000/5000/10000 for Easy/Standard/Hard sends him to bank.
  Cash comparison is signed32; banked addition wraps32 bits and uses no RNG.
- A treasure trip adds its1..3-day journey to the rival's byte calendar. The first
  RNG draw modulo100 changes it by−1 below25 or+1 below50. Rolls50..54 erase carried
  cash on normal trips. The second draw's low bit determines success. A claim sets
  the collected flag and adds sign-extended signed16 loot to wrapped32-bit cash.
  A third draw chooses report wording. Misses still move him to the destination.
- A claim publishes the destination flag and cash before the report. His current
  location changes **after** it. The report is MAIN33 with original font/strings
  and centered destination text. One captured report matches all320×200RGBA pixels.

Statically inferred boundaries, with independent controller/browser checks:

- Main `0187/0f7f` invokes rival progression then daily market processing once per
  root dispatch. Office choices, completed map choices, bank deposits, notices and
  activity returns are boundaries. Map movement, inspection, cancellation within
  the information screen and idle clocks are not. Office arrival waits for its
  next choice; flight plus its expedition is one dispatch. Past day30 skips ordinary
  cleanup; an exact day30 final bank deposit performs cleanup before the comparison.
- Expedition dispatcher `12bb:0002` ORs DS96ba with jungle1 at2c03, mountain2 at2c36,
  cave4 at2c60, photography8 at2c8a after the guide and before gameplay. These bits
  activate the normal rival routine; its selectors do not filter by activity family.
- Report `0297..02ed` polls a busy sound every14 driver ticks. Observing it busy
  bypasses the extra40×7-tick fallback wait when it finishes. Fire can shorten the
  wait. Sound-disabled or immediately finished playback uses that fallback.

The cash-loss-plus-claim case is also observed: incoming1000 is erased,then the
new8000 treasure is credited. Other signed/wrapping boundaries are statically
translated; not every branch has an original runtime case. Original device completion latency,
full campaign timing and a whole original campaign replay remain unproven. Exhausting
all eligible destinations returns special slot35, outside the35-record LOC table.
Its downstream behavior is unknown and stops with an explicit diagnostic. No bank
fallback is substituted. Forced flight-race claims retain their separately verified
existing application path.

## Environment and browser contract

`advanceRival` consumes incoming day, difficulty, unlock mask, shared seed, rival
accounts and original location/loot records. It produces a new seed, optional report
and mutated rival/collected state. It reads neither the DOM nor wall time.

`RivalReport` consumes semantic Fire, driver ticks and token-scoped audio busy events.
The browser supplies those through the existing keyboard/scheduler/audio adapters.
A serializable pending action pauses travel, office entry or ending comparison until
report completion. Travel rechecks the destination afterward, so a rival claim can
replace the pending departure with the original collected-treasure notice. Restart
clears the report and pending action; stale sound events cannot release a new wait.

Unit checks cover signed cash thresholds, selector ties, audio polling/stale events,
no idle catch-up and a claim interrupting travel to that same destination. Browser
acceptance uses real expedition play and keyboard adapters: jungle activates mask1,
mountain mask2, cave mask4; the mountain revisit observes a report, compares its
portrait with the original capture and resumes the collected notice. Existing
photography and expedition routes now require the rival's exact additional RNG draws.
These are independent browser checks, not an original campaign input replay.

## Reproduce the original captures

[reference/rival.json](../reference/rival.json) pins artifacts, checksums, input
recipe, tool revision, injections and comparison rules. Single emulator owner;
DOSBox MCP0.84.0-vc1 f6d9b, normal core,3000 cycles,svga_s3, original game mounted
read-only. Real16-bit code confirmed; load paragraph01f5, DS/SS1403. Original126b
maps to live0460. Verify incoming bytes against the relocated EXE each launch;
the manifest captures the entire1275-byte rival/selector span. No loader stub is used.

1. Continue ending Play Again/Yes to difficulty; Enter chooses Easy. Office
   Right+Space stops at rival entry0460:0008 (427), then return0328 (428).
   Capture CPU and DS64K at both, plus the code span at entry. This is the inactive case.
2. Continue through security. The exploratory Esc opened Quit; N dismissed it,
   then two paired Fire pulses returned to Office at next rival entry430. CAS player
   day1→10 and unlock mask0→1. Capture incoming state and return431. Easy misses at
   Klondike, consuming two draws from40500→58122. This bypasses expedition activation.
3. Office Up+Space enters money-bin dispatch. At rival entry432 CAS difficulty0→1
   and seed23516→56. Standard's odd rival day1 selects Carlsbad, pays6000, consumes
   three draws to29915. The return breakpoint was missed: its output is captured
   **later in the subsequent bin animation** at0603:0deb (434), with the same seed.
   This comparison is conditional evidence at a later observation, not a routine
   return or complete machine checkpoint. Input Fire and wait through the bin.
4. At entry435 capture the unmodified bank trip; stop at return436. Cash6000 becomes
   banked6000, current location0, rival day5; seed remains29915.
5. Office Right+Space; entry437 CAS rival day5→4 and seed29915→56. Standard's even-day
   selector chooses Whatsamatterhorn, adds8500, ends at rival day6. Stop0297 after
   reveal/input flush (438), capture CPU+DS and raw PNG, then return0328 (439).
   The report uses variant1; no frame search or fitted time is used.
6. Continue through map and confirm Office with Fire; entry440 CAS difficulty1→2
   and seed29915→56. Hard selects slot18 by value/day, adds8000 to8500, ends day7,
   returns441 with seed29915. Capture CPU+DS at entry and return.

7. Office Up+Space; at entry442 CAS carried16500→1000 and seed29915→77.
   Roll50 erases the1000; the odd second draw still collects8000 at slot17.
   Capture return443: rival day8,seed31579,cash8000,banked6000.

These are conditional routine segments. No partial restore or full-machine restore
was used. Each entry snapshot supplies independent input state; expected outputs
never supply RNG, coordinates, loot or input events. Unrelated heap, VGA scratch,
stack temporaries and later bin animation state are outside the semantic comparison.
Negative controls remove the unlock input, alter an account result and corrupt a
report pixel; each must be rejected. Nine comparisons must execute, including the
report-state boundary and exact PNG. Repeatable inputs are a setup recipe; the
manifest does not claim a frame-timed original campaign replay.
