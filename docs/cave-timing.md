# Cave drawing time

This page records the earlier partial sprite/room-restore milestone. Current
[room and minimap timing work](cave-composition-work.md) adds the costs described
here as omitted; the original evidence below remains a historical snapshot.

The port now waits for source drawing work before advancing the cave program.
This corrects an omitted cost; it is not a user-selected slowdown. The original
six-count movement deadline remains unchanged. A redraw can overrun that
deadline, so replacing every iteration with a fixed six-count sleep would also
be wrong.

## Evidence and scope

Only the build in `reference/build.json` is supported. The unchanged
`reference/cave-input.json` supplies a native neutral input return at
`0e0c:09a6` and the following resident deadline entry at `0b83:01d8`.
Counter `2225` advances from 53031 to 53041. The original deadline is already
overdue, consumes no additional wait, then becomes current counter plus six.

`reference/cave-draw-work.json` records the new static comparison. The actual
relocated cave body has 11,054 bytes and 196 relocations. All 728 bytes of helper
`overlay6:20b8` match the explicit Ghidra `CAVE_CODE.EXE` export after the exact
load-base relocation and declared five-byte analysis-only stack-probe change.
The analysis image is never executed. The helper uses a far 16-bit C calling
convention with pointer, kind and pose arguments. Its source restores one full
320×200 room buffer and draws five or six sprites.

For this captured case the helper costs 125.453 ms and its following idle sprite
costs 0.921 ms under the established normal-core 3000 cycles/ms EGA primitive
model. Seven sprite calls, one copy, all 42 complete sprite descriptors, torch
fields and the three RNG calls compare exactly. This partial work lies within
the observed ten-count interval allowing one driver period of capture phase
uncertainty. Debugger stops discard CPU budget: this is **conditional drawing
budget agreement**, not uninterrupted original cadence or whole-level timing
parity. The observed final counter is an expectation, never a simulation input.

Minimap fills (273 in this case), room composition, copies outside the party
helper, text, caller/interrupt work and remaining-slice I/O clamping are still
omitted. Cave pacing remains a lower-bound reconstruction of these costs.
The first treasure reveal now uses the original striped copy and25 declared
retraces;[its focused checks](cave-reveal.md) are separate from this historical
drawing-time receipt. Native whole-reveal timing and audio waveform parity
remain outside this comparison.

## Runtime boundary

`cave-work.js` counts actual original sprite masks and geometry using the
byte-checked EGA sprite/copy routines. `Cave.party()` and `Cave.draw()` are
generators that wait at each source call before later logic, audio requests or
presentation. Even an overwritten, unpresented helper call consumes its work.
Cached room commands only reconstruct pixels for Canvas and are not charged as
additional original draw calls. Unsupported command types stop development play.

The browser Scheduler injects elapsed simulation milliseconds and schedules the
exact drawing completion alongside driver interrupts and retraces. A completed
draw then follows the original retrace/deadline waits. Input is supplied through
the existing browser adapter. Hidden-page time is excluded, catch-up batch size
does not change results, and Restart cancels an old drawing completion. Direct
component checks can use a declared synthetic clock; that is not a browser
timing claim. Audio completion remains a separate external input.

## Verification

Run `npm run verify:cave-timing`. Missing/corrupt originals or native artifacts
fail explicitly. Required local static exports are listed with hashes in the
work manifest; the unchanged parent records their original scenario recipe.
No partial machine restore or fitted timer input is used.

The gate includes original cave code/state/image checks, independently replayed
source inputs for passage/ending checks, all unit tests, two real browser cases,
an omitted-work browser negative and the production build. The browser journey
flies to a cave, collects $50, fails in a pit, retries without another flight,
collects the treasure, returns to the map, rejects a duplicate visit and restarts.
It uses an external feedback controller with an explicitly supplied browser
clock. This is independent browser acceptance, not a fixed native input replay.
The input case checks actual poll cadence, Pause, quit cancellation, held-key
flushing and Restart. Its negative removes the two work waits in the served
module and must fail the cadence assertion; setup errors/timeouts do not count.

Five focused clock tests cover exact completion, catch-up batching, hidden-page
pause, Restart at a work boundary and audio ordering after unpresented drawing.
Five native comparison negatives reject changed code, missing sprite/copy work,
an implausible work budget and an altered native counter. Source-input route
replays reject an unfinished sequence rather than silently adapting it.

Earlier jungle/mountain and full-campaign receipts remain historical until their
source inventories are refreshed. This gate does not establish a green full
`npm run verify` or complete the whole-game port. Safari drawing work is next.
