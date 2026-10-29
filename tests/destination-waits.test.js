import test from "node:test";
import assert from "node:assert/strict";
import { DestinationWaits } from "../src/game/destination-waits.js";

// Source-derived synthetic clocks, not fitted native capture times. These
// verify explicit waits; they do not simulate CPU footer-drawing duration.
function readyAt(clock, atomic = false) {
  const waits = new DestinationWaits(clock, atomic);
  for (let i = 0; i < 51; i++) waits.advanceRetrace(clock);
  assert.equal(waits.ready, true);
  waits.drainEvents();
  return waits;
}
test("destination entry requires both25-retrace bands and a separate page flip", () => {
  const w = new DestinationWaits(100),
    bands = [];
  for (let i = 0; i < 50; i++) {
    if (w.retracesRemaining === 5) bands.push({ ...w.transition });
    assert.equal(w.ready, false);
    w.advanceRetrace(100);
  }
  assert.deepEqual(
    bands,
    ["wipe", "reveal"].flatMap((kind) =>
      Array.from({ length: 5 }, (_, band) => ({ kind, band })),
    ),
  );
  assert.equal(w.phase, "entry-flip");
  assert.equal(w.ready, false);
  w.advanceRetrace(100);
  assert.equal(w.ready, true);
  assert.deepEqual(w.drainEvents(), [{ type: "flush" }]);
});
test("selection keeps the previous visible choice until seven driver counts and a flip", () => {
  const w = readyAt(100);
  assert.equal(w.input(3, 100), true);
  assert.equal(w.choice, 1);
  assert.equal(w.visibleChoice, 0);
  assert.deepEqual(w.drainEvents(), [{ type: "sound", id: 36 }]);
  w.advanceRetrace(106);
  w.advanceTick(106);
  assert.equal(w.phase, "selection-wait");
  assert.equal(w.visibleChoice, 0);
  assert.equal(w.input(192, 106), false);
  assert.equal(w.discardedDuringWait, 1);
  w.advanceTick(107);
  assert.equal(w.phase, "selection-flip");
  assert.equal(w.visibleChoice, 0);
  assert.deepEqual(w.drainEvents(), [
    { type: "transport", aircraft: "launchpad" },
  ]);
  w.advanceRetrace(107);
  assert.equal(w.visibleChoice, 1);
  assert.equal(w.ready, false);
  w.advanceTick(108);
  assert.equal(w.ready, true);
  assert.deepEqual(w.drainEvents(), [{ type: "flush" }]);
});
test("confirmation returns only after its flip and seven-count wait; Map preserves Fire precedence", () => {
  const w = readyAt(20);
  w.input(0xc3, 20);
  assert.equal(w.choice, 0);
  assert.equal(w.outcome, null);
  assert.equal(w.confirming, true);
  w.advanceTick(100);
  assert.equal(w.outcome, null, "No flip may be skipped");
  w.advanceRetrace(100);
  assert.deepEqual(w.drainEvents(), [{ type: "flush" }]);
  w.advanceTick(106);
  assert.equal(w.outcome, null);
  w.advanceTick(107);
  assert.deepEqual(w.outcome, { returnCode: 36, choice: 0 });
});
test("atomic selection wraps and unsigned wait arithmetic preserves immediate wrapped targets", () => {
  const w = readyAt(0xfffffffc, true);
  w.input(7, 0xfffffffc);
  assert.equal(w.choice, 2);
  assert.equal(w.phase, "selection-flip");
  assert.deepEqual(w.drainEvents(), [
    { type: "sound", id: 36 },
    { type: "transport", aircraft: "atomic" },
  ]);
  w.advanceRetrace(0xfffffffc);
  w.advanceTick(0xfffffffd);
  assert.equal(w.ready, true);
  w.input(192, 0xfffffffd);
  w.advanceRetrace(0xfffffffd);
  assert.deepEqual(w.outcome, { returnCode: 1, choice: 2 });
});
test("the existing pause adapter freezes active waits without consuming bands", () => {
  const w = readyAt(100);
  w.input(3, 100);
  w.advanceTick(101);
  w.advanceBlockedTick(111);
  w.advanceTick(116);
  assert.equal(w.phase, "selection-wait");
  w.advanceTick(117);
  assert.equal(w.phase, "selection-flip");
  const entry = new DestinationWaits(0);
  entry.advanceBlockedTick(200);
  assert.deepEqual(entry.transition, { kind: "wipe", band: 0 });
  assert.equal(entry.retracesRemaining, 5);
});
test("destination waits reject invalid clocks, bytes and transport contexts", () => {
  assert.throws(
    () => new DestinationWaits(-1),
    /Invalid destination driver clock/,
  );
  assert.throws(
    () => new DestinationWaits(0, 1),
    /Invalid destination transport flag/,
  );
  const w = new DestinationWaits(0);
  assert.throws(() => w.input(256, 0), /Invalid destination input/);
  assert.throws(() => w.advanceTick(1.5), /Invalid destination driver clock/);
});
