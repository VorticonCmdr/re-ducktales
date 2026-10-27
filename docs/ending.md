# Campaign deadline and endings

The browser now reaches winning and losing endings through campaign play. It
banks remaining cash,shows the original two pictures,then asks Play Again.
Yes resets the campaign and returns directly to difficulty. No runs the original
credit names over MAIN1,then shows MAIN0 and stops accepting gameplay; Restart
is the browser adapter for starting another game after that exit.

## Original rules

Build identity is pinned in `reference/build.json`: DUCKTALE.EXE SHA-256
`fb658562b480ccf75a9dd0a7344c9ae74737e2ca651c0a09dc546928f612a981`.
The executable is16-bit real mode,far cdecl,no extender. Resident main code and
helpers were matched against relocated original bytes in the running process;
these are game routines,not the EXEPACK stub.

- Main1036..107f adds carried player cash to banked cash with32-bit wrap,then
  clears player cash. At signed day>=30,it also adds rival cash to rival banked
  cash. The rival cash field is deliberately left unchanged. No company record
  is read or liquidated by this routine. Unsold stock is excluded from the score.
- A bank arrival on day30 or later ends the campaign (main0144..019a). Travel to
  the office on exactly day30 is still permitted. A date above30 redirects to
  final banking without another journey. Dates above30 are retained: the captured
  flight/repair return deposited on day33. Exactly day30 performs ordinary market
  cleanup before comparison; a date above30 skips it (main0187/0f7f..0f95).
- Main0fb0..0fe9 compares banked totals as signed32: signed high words,then unsigned
  low words. Player>=rival wins,including ties. Cash,stock quotes and stock counts
  are not added by this comparison. Scores are not coerced to unsigned ordering.
- `12f5:0ee7` selects picture helper13 for a win,14 for a loss: MAIN36/37.
  `12f5:0f26` then selects helper12/11: MAIN39/33. Each waits100 dialogue polls,
  seven driver ticks per poll. Fire shortens at a poll boundary.
- `12f5:0f55` defaults to Yes. Arrow directions toggle the choice; held directions
  have a14-tick delay/flush. Fire returns0 for Yes,1 for No. The caller at main0ff1
  sends Yes to difficulty `12f5:0aeb`,then initializes a new game. No calls credits
  `12f5:1098` and returns to DOS in the original.
- Credits show MAIN1,wait20 seven-tick polls,then26 original padded names at
  DS079e+i*26. Each name waits20 polls. Fire skips to MAIN0's40-poll final wait.
  The browser keeps a closed game screen instead of closing the browser tab.

`src/game/ending.js` owns account arithmetic and ending/menu clocks. Simulation
is independent of the DOM. The existing scheduler supplies driver ticks and
semantic input; the renderer only observes state. Complete original bank
celebration animation,striped picture reveals,CPU-bound redraw costs,ending music
and exact credits-page pixels/timing are not established. Losing pictures are
statically identified and browser rendered; they have no original PNG capture yet.

## Original capture and strict checks

`npm run verify:ending` requires16 local artifacts pinned in
`reference/ending.json`. Missing/corrupt artifacts are setup failures. Eight
original checkpoints cover a deadline deposit,winner argument,first wait,second
picture argument,second wait,replay Yes/No locals and the replay return. Four
PNGs compare exactly: MAIN36,MAIN39,and both replay choices. Required negative
controls alter a bank result and image bytes. Static integer tests cover ties,
low-word boundaries,32-bit wrapping and signed-high-word order. These are not
extra original runtime cases. Dialogue/credits boundary checks are independent
port checks.

Original configuration: DOSBox0.84.0-vc1 f6d9b,svga_s3,normal core,3000 cycles,
read-only C mount of game/. Root is sole session owner. No partial or complete
checkpoint was restored. The scenario inherits the explicitly conditional
cash0→1000/day1→30 setup in `reference/investment-trading.json`; those are the
only game-memory injections. It is not a natural whole-month original replay.

Capture recipe:

1. Continue the trading scenario's paused overlay10:145a. Open the office map
   with Right+Space;Fire twice through security. Right4300ms reached Borneo in
   this configuration. Fire opens its description;Right400ms,release,then Fire
   confirms. Fly with throttle and a short Down pulse to crash. Fire through the
   repair/wreckage dialogue. Repair changes the remaining cash to750 and the
   calendar reaches33; the original redirects to the bank.
2. Stop live01f5:1036 and save CPU,fixedDS1403:0000..ffff,and relocated code
   01f5:0f95 length235. Stop1076 after bank animation/deposit. Compare exact cash,
   bank/rival fields and unchanged690-byte company area. Bank animation,allocator
   and unrelated scratch are outside this semantic comparison.
3. Stop01f5:0fb0 before winner comparison. Save CPU+DS and code spans0f95 length235,
   3e37 length433,1c48 length366. The verifier reconstructs every relocation from
   the EXEPACK table and compares all three spans. No code bytes are patched.
4. Stop live04ea:0ee7;the far-call argument at SS:SP+4 is1. Stop03b9:09f5 after
   the picture reveal;the argument is100. Save CPU+DS and raw PNG. Fire100ms,
   stop04ea:0f26 (argument1),then the next03b9:09f5 (argument100) and save the
   second PNG. Code mapping: original02f5→live04ea,01c4→03b9,root0000→01f5.
5. Stop04ea:0f55 at replay entry. Its first post-flip stop103c can precede the
   completed VGA frame,so the Yes capture uses a single declared alignment:
   after two driver-clock increments,stop at103c and save CPU+DS+PNG. The
   conditional breakpoint reads DS2225 as a DWORD; no clock is injected and no
   image search selects a frame. Delete the owned condition breakpoint.
6. Down100ms changes No. Stop1064 after the arrow's14-tick wait and save CPU+DS
   and PNG. Up100ms,then Fire100ms returns Yes;capture main0ff1 with AX0.
   Release all keys and remove only owned breakpoints. The next visible screen
   is difficulty. Revalidate live bytes/paragraphs after a new executable launch.

## Browser acceptance

`tests/browser/ending.spec.js` supplies real keys,asset loading,rendering and
controlled browser time. It does not inject game memory or outcomes:

- Earn the actual money-bin coin,buy a22-dollar share,keep it unsold,and travel
  through five bank round trips. The day31 banked score is978. Original winner
  picture/prompt PNGs match exactly. Yes clears money,bank,holdings and prior
  ending state,and returns to difficulty and a new office.
- Travel without earnings: a0–0 tie wins. Choose No,show a credit name,skip the
  remaining names,finish the game and use Restart.
- Lose an actual Hard flight race to Klondike,credit Glomgold4500,then travel to
  the deadline. The player loses0–4500 and sees MAIN37/33 and the replay prompt.

These are browser acceptance scenarios,not an original whole-campaign replay.
Normal rival progression is still absent. Static investigation identified its
activation byte96ba: entering jungle/mountain/cave/photography sets bits1/2/4/8
(resident2c03/2c36/2c60/2c8a). Translating that progression is the next milestone.
