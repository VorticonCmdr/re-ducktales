# Atomic Matter Transmitter

The browser can earn the transmitter, select its original map icon and travel
without the flight game. Successful and misdirected journeys enter the actual
expedition guide/gameplay dispatch; crossing the deadline goes to final banking.
This is part of the supported build in [build.json](../reference/build.json).

## Original rules and implementation

`src/game/atomic-transport.js` separates the journey/controller from the browser.
`application.js` connects the map choice,shared seed,calendar,guide and ending.
`npm run verify:atomic` verifies the original comparisons; `npm test` and
`npx playwright test tests/browser/atomic.spec.js` check the controller and browser.

- Main0c6e..0c89 sets DS8eb4 when the player collects the location assigned LOOT9.
  The existing treasure assignment remains authoritative. With browser BIOS seed0,
  company initialization seed5245 puts this item at slot24,Too-Pei,cave variant7.
- Office map information cycles Map→Launchpad→Atomic when DS8eb4 is nonzero.
  Left wraps from Map to Atomic. Overlay2:1d4e/1d6d writes the aircraft flag DS7900.
  The browser uses MAIN29 at281,170 for the unlocked choice. The chosen aircraft
  persists for direct travel from expedition maps. Same-location retries bypass
  transport and consume only the guide draw. Bank/office routes retain their
  separate original dispatches.
- Main0454..047c selects the atomic branch and consumes **one** original RNG draw.
  Roll=unsigned seed modulo100. Success requires roll strictly greater than8,16,24
  on Easy,Standard,Hard. No Launchpad variant or flight-race draws are consumed.
- Success adds the original wrapped travel duration to the byte day,waits7 driver
  ticks,optionally plays sound54,then arrives. It does not wait for that sound.
- Failure waits7 driver ticks,plays sound45 if enabled and waits for explicit sound
  completion. Main0573..059e selects the **first** slot1..34 with neither collected
  flag. It may select the requested location or the current location. If no eligible
  slot remains,the requested destination is retained. There is no new random draw.
- The failure report uses MAIN41,original text at147/159/166/174 and destination
  centered around232 at y124 with punctuation184. It waits60×7 driver ticks; Fire
  can shorten it at the7-tick polls. Only afterward is travel time added. Choosing
  the current location therefore costs zero journey days. Then main04ca publishes
  the destination and checks the campaign deadline before loading the expedition.

The two outcome/calendar rules and failure report are observed and regression-
validated in the conditional original segments below. Threshold equality,byte
wrapping,no-eligible fallback and the exact waits are statically inferred and
covered by independent controller checks. Original sound latency and full elapsed-
time alignment remain unproven. Charge/sound waits render black; the failure report
matches the captured original exactly. Full original map-information layout,
selection flashing and transition/reveal timing remain outside pixel parity claims.

## Environment and acceptance contract

The journey consumes original location coordinates/collected flags,incoming day,
difficulty and shared seed. `advanceTick` consumes explicit driver clocks. Failure
sound completion is a token-scoped audio busy event from the existing browser audio
adapter. Missing completion keeps the controller waiting; stale tokens cannot release
it. Tests separately exercise that boundary rather than fitting an event to an
expected final state. Fire only shortens the report,not charge or sound completion.
Restart clears the controller,unlock and aircraft selection.

The independent browser scenario loads originals,flies/crashes to Too-Pei,navigates
its variant7 cave with real held-key input,collects the item,returns to the office,
selects Atomic with Left,and enters the next expedition without a flight. It injects
only an external browser clock and keyboard/pointer actions. Its feedback navigator
reads the exposed cave state and must finish within its move/attempt limits. It
requires actual treasure success and the unlock notice; it never injects ownership.
A separate explicitly conditional browser renderer check compares all320×200RGBA
pixels of the misdirection report. Neither is an original whole-campaign replay.

## Original capture recipe

[reference/atomic.json](../reference/atomic.json) pins10 mandatory local artifacts,
checksums,configuration,injections,recipe and5 required comparisons. Missing or
corrupt artifacts fail setup. Negative controls omit the RNG draw,change the
redirected destination and corrupt a report pixel; all must fail comparison.

One owner controls the original DOSBox session: normal core,3000 cycles,svga_s3,
read-only game mount. Same EXE/resources as prior milestones; no relaunch or memory
layout change. Real16-bit mode is verified. Resident base01f5,DS/SS1403; overlay2
loads at0e0c. Original main1000 offsets map directly to live01f5 offsets. Original
overlay relocation sites are expressed relative to0c17,so subtract0c170 from each
site before relocating the loaded overlay body. The checker compares the entire
resident0454..06b8 and map1757..1ec8 spans against the original EXE's own bytes.
Ghidra OFFICE_MAP.EXE contains the actual overlay and its1757 selector; its decompiler
has imperfect stack/DS recovery. The branch/loop decisions above use disassembly
and live observations. INVESTMENT_CODE.EXE contains the actual resident main code.

1. Continue rival cash-loss return0460:0328 stop443. This inherits the **conditional**
   day10/Hard campaign/accounts from [rival evidence](rival.md). CAS DS8eb4 0→1 to
   bypass finding the transmitter and DS96ba 1→0 to isolate transport. Complete the
   money-bin dispatch with paired Fire,then open Office map with Right+Fire. Trap
   map input0e0c:1ec8 (445). A release schedule can remain pending across a debugger
   stop: resume and verify `replay_status` complete before scheduling more input.
2. Up2500ms selects Klondike. Fire opens information; Left100ms highlights Atomic.
   Capture the choice PNG. Fire stops main0454 (446),selected flag1. Capture CPU,
   DS64K,resident612 bytes,map1905 bytes. Incoming seed31579 naturally draws25012,
   roll12: Hard failure. Stop067e after reveal,before the60-poll wait (447); capture
   CPU,DS and raw PNG. Stop04da before expedition dispatch (448): day10→11,Office→1,
   seed25012. No audio-completion event stream or elapsed-time replay is claimed.
3. Allow the cave to fail idle; stop04e7 (449),CAS expedition activation4→0,continue
   through map return. Once visible,Right1500ms selects Novay; Fire retains Atomic
   and stops0454 (450). CAS seed40976→28088. Capture before and04da (451): roll0,
   requested22→first unclaimed1,current location1,day12 stays12,seed0.
4. Allow the next cave failure; stop04e7 (452),CAS activation4→0. Resume,wait4000ms
   for map,Right1500ms,release,wait300ms,Fire100ms. Gate0454 (453) requests slot30.
   CAS seed6497→0; capture before and04da (454): roll81,success,from1→30,
   day13→15,seed4681. Original remains paused there,with keys released and no breakpoints
   or input schedule pending.

No partial or complete machine restore was used. Each captured entry independently
supplies its own incoming state; outcomes never supply simulation inputs. Compared
fields are RNG,destination,day/location,accounts and every collected flag. Heap,
graphics scratch,CPU temporaries and subsequent expeditions are outside the bounded
travel comparison. Pure semantic comparisons do not fit audio events or clock values.
The full port remains incomplete; see [current status](STATUS.md).
