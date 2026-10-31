# Investments

The browser now supports office → investments → portfolio → company → buy/sell →
broker confirmation → office,including all15 original companies and daily news.
Holding Fire repeats successful trades; shares are capped at99. Trading does not
spend a day or reset the money-bin coin latch. Restart clears holdings.

Startup now initializes companies before location ordering/loot assignment and
processes the first market day after choosing difficulty. With the port's final
BIOS-seed provider0: company seed5245,location/loot seed45111,Easy day-one seed1960.
These composed startup values are static/port regression evidence,not a captured
fresh original campaign. Missing market resources stop browser loading. Component
checks may explicitly omit that subsystem by constructing Game without resources.

## Executable and resource identity

Supported files are pinned in `reference/build.json`. DUCKTALE.EXE SHA-256:
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
Physical overlay10 is trading: file offset`0x26e00`,5986 bytes,512-byte MZ header,
5474 code bytes,101 relocations. SHA-256:
`9c4a19c262e86ea844109e0558e2d214ea6f0b4e1f9270139d8349c49bc9999f`.
Physical overlay3 is the bank. INT3f logical IDs differ from appended-MZ indices.
This is16-bit real-mode code,far cdecl calls,no extender.

`npm run prepare:investment-analysis` reproduces ignored `INVESTMENT_CODE.EXE`.
It combines resident code and overlay10 at image`0xc170`,rebuilds relocations and
normalizes compiler stack probes; the patch manifest records changes. It is an
analysis image,not a runnable original. There are no software-FPU escapes in this
overlay. Ghidra uses `x86:LE:16:Real Mode`; initialization is `115a:0491`,pricing
`1c17:0aac`. The company-screen switch decompiles poorly: use original assembly.

After relaunch,live resident base was`01f5`,DS/SS`1403`,trading code`0e0c`.
The verifier compares all534 relocated initializer bytes and all5474 relocated
trading bytes. An entry breakpoint at`0e0c:0000` also encounters dispatch code;
the reused allocation address alone cannot identify the actual trading body.
Resources are original `INVEST.ARC` names/descriptions/news,`CHART.ARC` curves,
`INVART.ARC` buttons and MAIN background20. No resource dumps are committed.

## Rules and evidence

**Original-validated initialization:** resident physical`1a31..1c46` loads15
company names. DS`92b2`,stride46:

| Offset | Field |
| --- | --- |
| +0 | Name,terminated within32 bytes |
| +32 | Signed16 base price |
| +34 | Signed16 shares |
| +36 | Status byte |
| +38 | Signed16 chart index |
| +40 | Event start day |
| +42 | Event due day |
| +44 | Signed16 event delta |

The resource's numeric price/chart fields are parsed then overwritten. For each
company,in resource order: RNG draw,remainder120 gives price; RNG draw,remainder5
gives chart. Shares/status become0. Other record bytes retain their incoming
contents. Processed market day DS`7162` becomes0. All690 record bytes match.
Each of five charts has31 decimal values,but only30 are copied to
DS`8fa6 + chart*31`. Each31st byte is untouched. All155 bytes match the capture.

**Original-validated ordering:** incoming seed52603 becomes44214 after30 draws.
Subsequent location ordering receives44214 unchanged. This disproves the current
browser's assumption that location ordering starts directly with its supplied
BIOS seed. The capture does not establish the complete title/difficulty seeding
schedule: an earlier observed BIOS read had a different AX from initialization's
incoming seed. Do not treat that earlier read as the sole startup-seed contract.

**Original-validated quotes:** overlay10`0aac..0b06` uses the signed current day;
day1 indexes the first loaded chart byte. Signed base price times unsigned factor
is truncated to signed low16 bits,then divided by100 toward zero. CWD after IMUL
discards the high product word. A nonpositive quote with positive factor becomes1;
a zero factor yields0. Five natural day-one quotes,companies10..14,match exactly:
3,70,20,19,4. An overflow/minimum-price boundary check is disassembly-derived,
not an additional runtime case.

**Translated and browser exercised:** office Left+Fire enters investments; news
precedes the portfolio when company status is1..4. Display changes1/2 to5 and
3/4 to83/84,so acknowledged pending news does not repeat. Pending rise events
consume two RNG draws each processed day,including jitter in their effective
announcement date. Falls use the due date directly. Both change the signed base
price with the same low-word multiply/divide as quotes. Event discovery scans
chart slope reversals,with difficulty/held-share chances and player/rival wealth
choosing different deltas. `advanceInvestmentDays` follows both complete company
passes per day. A conditional29-day original call matches all data outside its
specified stack/IRQ boundaries,including all690 company bytes and final RNG.

Buy checks zero quote,then signed shares>=99,then the sign of the wrapped32-bit
cash-minus-price result. Sell requires positive shares and permits a zero quote.
Success transfers one share,updates cash and sets3bb4. A held successful trade
clears the input latch to allow repetition. Entry clears3bb4; leaving after a
successful trade shows the broker's original four-line message for50 seven-tick
polls,shortened by Fire. The calendar remains unchanged,verified in the original.
The broker now uses the shared input reader,including modal continuation and
unread final-wait input reaching the office. Current source/browser/device
acceptance and its native timing limits are documented in [broker-input.md](broker-input.md).

Company descriptions use six original lines,news uses the following positive or
negative pair. All original text,buttons and backgrounds are loaded from assets.
Escape/Back is a documented browser navigation adapter; original DOS Escape opens
its global quit dialog. Browser company polling uses driver ticks; original
CPU-bound redraw/poll timing,exact trading pixels,broker audio and all
boundary/difficulty paths still need original comparison.

## Capture and verification

`npm run verify:investments` requires nine local artifacts pinned in
`reference/investments.json`. Seven checkpoints: initialization,seed continuity,
five quotes. Missing/corrupt artifacts,wrong build/code,skipped/reordered quotes
and mismatches fail. Negative controls alter RNG/chart/quote comparisons and
remove the required after capture. Missing fixtures require a fresh capture and
reviewed manifest update,not silent generation.

1. Use the single-owner configuration in `docs/original-scenario.md`. Exit the
   previous game with Escape/Y and finish credits. Confirm the shell before
   submitting `ducktale\n`. N100ms answers joystick; two Space100ms pulses
   separated2000ms reach difficulty. Inspect it,then select Easy with Enter100ms.
2. Arm resident`01f5:1a31` before choosing difficulty. Save CPU,fixedDS`1403`64K,
   and534 code bytes. Actual alias is`034f:0491`. Run to`01f5:1c46`,save CPU+DS.
3. Run to`01f5:1677` (alias`034f:00d7`),save CPU+DS. These routine snapshots are
   not complete-machine checkpoints; none is restored.
4. Continue to office. Send simultaneous Left+Space,release both after100ms.
   Observe news. Pause and save CPU+linear memory`0..0x9ffff`; validate the entire
   relocated trading body against original bytes at`0e0c:0000`.
5. Break at`0e0c:0afe`,resume,dismiss news with Space100ms. Save CPU+fixedDS64K
   on five successive hits. Require arguments SS:BP+6 equal10..14,in order;
   compare returned quote local SS:BP-4. Delete the owned breakpoint,finish
   rendering and inspect the portfolio.

No memory/register injections,fitted inputs or restores. Timing is an exploration
recipe,not timing parity. Initialization covers company/chart/RNG semantic
fields; allocator,archive handles,stack and IRQ clocks are outside its boundary.
Quotes use each original incoming company/chart/day state and do not establish
a closed-loop daily-news simulation or browser acceptance.

## Trading and calendar capture extension

`reference/investment-trading.json` pins11 further local artifacts,five checks:
failed buy,successful buy,sell,calendar-preserving exit and a29-day market call.
After the first rejected purchase,an explicit CAS changes cash0→1000. Buy and
sell then use real input and carry their own balance/holdings. This is conditional
funding,not proof of an earned original coin. At the normal main0310 return,
DS4e0e is still1,cash1000 and holdings0. A second explicit CAS changes day1→30;
the normal caller cleanup reaches overlay10:10d1. Capture CPU+DS+all5474 code
bytes at entry and CPU+DS at145a return. No other fields or registers are injected.
The translation carries its own state across29 days,using390 translated RNG draws.

Transaction comparisons include caller message/icon/latch locals and all DS except
only the10-byte IRQ stack below SP and the changed low word2225..2226 of the32-bit IRQ clock. The market call excludes
only54 bytes of stack scratch9f22..9f57 plus that same low clock word; the upper clock word remains compared. Changing a cash
result or incoming market seed is detected by required negative controls.

`tests/browser/investments.spec.js` is independent of these conditional captures.
It earns a real browser money-bin coin,buys/sells,reaches99 shares with held Fire,
checks broker/office return and Restart. A separate route makes four bank round
trips to day25,acknowledges three news bulletins,and verifies they stay consumed.
`npm run verify:startup` checks composed startup and a complete jungle replay with
23 checkpoints and857 inputs. Its input stream is independent of expected states:
it adds65 idle player polls before the existing route to board the fish under
corrected RNG. It supplies no fitted timer,BIOS,memory or RNG values.
