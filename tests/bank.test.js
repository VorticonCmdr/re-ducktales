import test from "node:test";
import assert from "node:assert/strict";
import { BankScene } from "../src/game/bank.js";
import { bankResources } from "./helpers/bank-fixture.js";
import { Scheduler } from "../src/game/scheduler.js";
const make = (options = {}) =>
  new BankScene({
    ...bankResources,
    banked: 0,
    rivalBanked: 0,
    seed: 54552,
    pollInput: () => false,
    ...options,
  });
function advanceToInput(b) {
  const clock = new Scheduler(b);
  let n = 0;
  while (!b.snapshot().waitingForInputPoll && n++ < 50000)
    clock.advanceTo(Math.min(clock.tickAt, clock.retraceAt));
  assert.equal(
    b.snapshot().waitingForInputPoll,
    true,
    "unfinished bank reader",
  );
  return clock;
}
const retrace = (b, n) => {
  for (let i = 0; i < n; i++) b.advanceRetrace();
};
const ticks = (b, n) => {
  for (let i = 0; i < n; i++) b.advanceTick();
};
test("bank wipe and reveal each consume25 retraces without reading input or RNG", () => {
  const b = make();
  for (let r = 0; r < 50; r++) {
    assert.deepEqual(
      [b.transition.kind, b.transition.band],
      [r < 25 ? "wipe" : "reveal", Math.floor((r % 25) / 5)],
    );
    ticks(b, 2);
    assert.equal(b.inputReads, 0);
    assert.equal(b.randomDraws, 0);
    b.advanceRetrace();
  }
  assert.equal(b.transition, null);
  assert.equal(b.phase, "scales");
});
test("zero balances repeat the level scales and show one numeric digit", () => {
  const b = make();
  let poses = [];
  const draw = b.drawScale.bind(b);
  b.drawScale = (pose) => {
    poses.push(pose);
    draw(pose);
  };
  advanceToInput(b);
  assert.deepEqual(poses, [2, 2]);
  assert.equal(b.balanceStep, 1);
  assert.equal(b.phase, "idle");
  assert.equal(b.randomDraws, 0);
});
test("a four-pile advantage uses the original complete scale reflection sequence", () => {
  const b = make({ banked: 40000, audioEnabled: true });
  const poses = [],
    draw = b.drawScale.bind(b);
  b.drawScale = (pose) => {
    poses.push(pose);
    draw(pose);
  };
  advanceToInput(b);
  assert.deepEqual(poses, [2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0]);
  assert.equal(b.balanceStep, 5);
  assert.equal(b.pose, 0);
  assert.deepEqual(
    b.drainEvents().map((e) => e.id),
    [0, 67, 68, 67],
  );
});
test("digit roll builds from the right and retains immutable alternate pages", () => {
  const b = make({ banked: 1000 });
  const clock = new Scheduler(b),
    digits = [];
  let n = 0,
    oldStep = 0;
  while (!b.snapshot().waitingForInputPoll && n++ < 50000) {
    clock.advanceTo(Math.min(clock.tickAt, clock.retraceAt));
    if (b.balanceStep !== oldStep) {
      oldStep = b.balanceStep;
      digits.push(b.frame.filter((c) => c.op === "text" && c.y === 179).at(-1));
    }
  }
  assert.equal(b.phase, "idle");
  assert.deepEqual(
    digits.map((c) => [c.text, c.x]),
    [
      ["0", 178],
      ["00", 170],
      ["000", 162],
      ["1000", 154],
    ],
  );
  const first = b.frame,
    serialized = JSON.stringify(first);
  b.resumeInputPoll();
  retrace(b, 1);
  assert.equal(JSON.stringify(first), serialized);
});
test("bank reads held digital Fire immediately after flushing animation taps", () => {
  const tap = make();
  tap.input({ type: "fire" });
  advanceToInput(tap);
  tap.resumeInputPoll();
  assert.equal(tap.phase, "idle");
  assert.equal(tap.randomDraws, 1);
  const held = make({ pollInput: () => true });
  held.setControls({ fire: true, direction: null });
  const clock = new Scheduler(held);
  let n = 0;
  while (!held.complete && n++ < 50000)
    clock.advanceTo(Math.min(clock.tickAt, clock.retraceAt));
  assert.equal(held.complete, true);
  assert.equal(held.randomDraws, 0);
  assert.equal(held.inputReads, 2);
});
test("idle draw consumes original RNG and a73-tick wait before polling again", () => {
  const b = make();
  advanceToInput(b);
  b.resumeInputPoll();
  assert.equal(b.seed, 3308);
  assert.equal(b.randomDraws, 1);
  assert.equal(b.wait.clock, "retrace");
  retrace(b, 1);
  assert.equal(b.wait.remaining, 73);
  ticks(b, 72);
  assert.equal(b.snapshot().waitingForInputPoll, undefined);
  ticks(b, 1);
  assert.equal(b.snapshot().waitingForInputPoll, true);
  const frame = b.frame,
    seed = b.seed,
    snapshot = b.snapshot();
  for (let i = 0; i < 100; i++) {
    b.advanceBlockedTick();
    b.advanceBlockedRetrace();
  }
  assert.equal(b.frame, frame);
  assert.equal(b.seed, seed);
  assert.deepEqual(b.snapshot(), snapshot);
});
test("Fire returns through a separate40-read wait and caller clear/page flip", () => {
  const b = make({ audioEnabled: true });
  advanceToInput(b);
  b.input({ type: "fire" });
  b.resumeInputPoll();
  assert.equal(b.phase, "outro");
  assert.equal(b.randomDraws, 0);
  const before = b.tick;
  for (let read = 0; read < 40; read++) {
    assert.equal(b.snapshot().waitingForInputPoll, true);
    b.resumeInputPoll();
    ticks(b, 7);
  }
  assert.equal(b.tick - before, 280);
  assert.equal(b.phase, "return");
  assert.equal(b.complete, false);
  retrace(b, 1);
  assert.equal(b.complete, true);
  assert.equal(b.inputReads, 41);
  assert.deepEqual(
    b.drainEvents().map((e) => e.id),
    [0, 36],
  );
  assert.deepEqual(b.frame, [
    { op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 },
  ]);
});
test("unsupported bank resources, providers and controls fail explicitly", () => {
  assert.throws(() => make({ entries: [] }), /MAC.ARC/);
  assert.throws(() => make({ seed: -1 }), /RNG seed/);
  assert.throws(() => make({ banked: -1 }), /Invalid banked amount/);
  assert.throws(() => make({ audioEnabled: 1 }), /Invalid bank audio setting/);
  const b = make({ pollInput: () => undefined });
  assert.throws(() => advanceToInput(b), /Invalid bank global input provider/);
  const c = make();
  assert.throws(
    () => c.setControls({ fire: 1, direction: null }),
    /Invalid bank controls/,
  );
  assert.throws(() => c.resumeInputPoll(), /outside its input reader/);
  assert.throws(() => c.draw(0x1234), /Unsupported bank sprite descriptor/);
});
