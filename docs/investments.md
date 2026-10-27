# Investments

Initialization and pricing are translated in `src/game/investments.js`,but are
**not yet connected to browser campaigns**. Browser startup still omits the
market's30 RNG draws. Correct startup,daily market/news changes and the original
portfolio/company screens are the next integration step. Existing browser routes
remain port regressions with the older stream; they do not establish a fresh
original campaign's destination/treasure pairing.

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

**Observed,not translated:** office Left+Fire enters investments; a day-one news
bulletin precedes the portfolio. Initial selection/top row is company10,showing
five companies and Return to Office. Daily news uses the same campaign RNG.
Trading,news,calendar cost and endings are still unsupported in the browser.

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
