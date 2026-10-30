import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { Game } from "../src/game/application.js";
import { Scheduler } from "../src/game/scheduler.js";
import { DestinationLoop } from "../src/game/destination-loop.js";
import { destinationFooterWork } from "../src/game/destination-work.js";
const original = await originalGame();
function setup(atomic = false) {
  const game = new Game({
    destinationInput: "keyboard",
    locations: original.game.locations,
    loot: original.game.loot,
    expeditionResources: original.game.expeditionResources,
  });
  const scheduler = new Scheduler(game, 0);
  // Conditional Game entry contract; the browser test earns this through UI.
  game.scene = "map";
  game.campaign.atomicAvailable = atomic;
  game.campaign.point(100, 100);
  game.input({ type: "fire" });
  const loop = game.campaign.destinationWaits;
  function until(fn, max = 5000) {
    for (let i = 0; i < max; i++) {
      if (fn()) return;
      scheduler.advanceTo(scheduler.now + 1);
    }
    throw Error(
      "Unfinished destination test " + JSON.stringify(game.snapshot()),
    );
  }
  return { game, scheduler, loop, until };
}
const key = (g, scan, pressed) =>
  g.input({ type: "map-key", scanCode: scan, pressed });
test("destination autonomously redraws and reads neutral without any external makes", () => {
  const { game, scheduler, loop, until } = setup();
  until(() => loop.inputs === 5);
  assert.equal(loop.footerPasses, 5);
  assert.equal(loop.completedCalls, 25);
  assert.equal(loop.lastByte, 0);
  assert.equal(loop.choice, 0);
  const reads = loop.inputs;
  scheduler.advanceTo(scheduler.now + 200);
  assert.ok(loop.inputs > reads);
  assert.equal(game.campaign.choice, 0);
  assert.equal(game.diagnostic, null);
});
test("destination make is sampled after footer work, not at the external event", () => {
  const { game, loop, until } = setup();
  until(() => loop.ready);
  key(game, 0x4d, true);
  key(game, 0x4d, false);
  assert.equal(loop.inputs, 0);
  assert.equal(loop.choice, 0);
  until(() => loop.inputs === 1);
  assert.equal(loop.completedCalls, 5);
  assert.equal(loop.lastByte, 3);
  assert.equal(loop.choice, 1);
  assert.equal(game.campaign.destinationReadTrace.beforeFlags[0x4d], 64);
  assert.equal(game.campaign.destinationReadTrace.readerFlags[0x4d], 0);
  assert.equal(loop.phase, "selection-wait");
  assert.equal(loop.driverDeadline - loop.lastInputClock, 7);
});
test("busy makes are discarded at the next source flush; fresh aliases work after it", () => {
  const { game, loop, until } = setup();
  until(() => loop.ready);
  key(game, 0x25, true);
  until(() => loop.inputs === 1);
  assert.equal(loop.choice, 1);
  assert.equal(game.campaign.mapKeyboard.bytes()[0x25], 128);
  key(game, 0x25, true);
  until(() => loop.footerPasses === 2);
  assert.equal(game.campaign.mapKeyboard.bytes()[0x25], 0);
  until(() => loop.inputs === 2);
  assert.equal(loop.lastByte, 0);
  assert.equal(loop.choice, 1);
  until(() => loop.footerPasses === 3);
  key(game, 0x25, true);
  until(() => loop.inputs === 3);
  assert.equal(loop.lastByte, 3);
  assert.equal(loop.choice, 0);
});
test("Fire precedes Left and completes Map confirmation only after flip/seven counts", () => {
  const { game, loop, until } = setup();
  until(() => loop.ready);
  key(game, 0x24, true);
  key(game, 0x24, false);
  key(game, 0x1c, true);
  key(game, 0x1c, false);
  until(() => loop.inputs === 1);
  assert.equal(loop.lastByte, 0xc7);
  assert.equal(loop.choice, 0);
  assert.equal(loop.phase, "confirm-flip");
  until(() => loop.phase === "confirm-wait");
  const deadline = loop.driverDeadline;
  until(() => loop.clock === deadline - 1);
  assert.equal(game.campaign.info, true);
  until(() => !game.campaign.info);
  assert.equal(game.tick, deadline);
  assert.deepEqual(loop.outcome, { returnCode: 0x24, choice: 0 });
});
test("destination discards pre-flush Pause and defers body Pause to the shared reader", () => {
  const { game, scheduler, loop, until } = setup();
  game.input({ type: "pause" });
  assert.equal(game.systemOverlay, null);
  until(() => loop.inputs === 1);
  assert.equal(game.systemOverlay, null);
  assert.equal(game.pendingDestinationSystemKeys.size, 0);
  until(() => loop.footerPasses === 2);
  game.input({ type: "pause" });
  assert.equal(game.systemOverlay, null);
  until(() => !!game.systemOverlay);
  assert.equal(loop.phase, "reader-blocked");
  assert.equal(loop.inputs, 1);
  assert.equal(loop.wait, null);
  const calls = loop.completedCalls;
  scheduler.advanceTo(scheduler.now + 100);
  assert.equal(loop.inputs, 1);
  assert.equal(loop.completedCalls, calls);
  until(() => game.systemOverlay.phase === "waiting");
  game.input({ type: "pause" });
  until(() => !game.systemOverlay);
  until(() => loop.inputs === 2);
  assert.equal(loop.lastByte, 0);
  assert.equal(game.pendingDestinationSystemKeys.size, 0);
});
test("destination input and work completions are invariant to scheduler catch-up batches", () => {
  function run(batch) {
    const { game, scheduler } = setup();
    for (const [at, scan, pressed] of [
      [760, 0x25, true],
      [761, 0x25, false],
      [915, 0x4b, true],
      [916, 0x4b, false],
    ])
      scheduler.enqueue({ type: "map-key", scanCode: scan, pressed }, at);
    for (let at = batch; at < 1500; at += batch) scheduler.advanceTo(at);
    scheduler.advanceTo(1500);
    assert.equal(scheduler.events.length, 0);
    return game.snapshot();
  }
  assert.deepEqual(run(1), run(1500));
});
test("hidden-page pause excludes wall time and Restart cancels pending footer work", () => {
  const a = setup(),
    b = setup();
  a.until(() => a.loop.ready);
  b.until(() => b.loop.ready);
  a.scheduler.pauseDuration(5000);
  a.scheduler.advanceTo(a.scheduler.now + 200);
  b.scheduler.advanceTo(b.scheduler.now + 200);
  assert.deepEqual(a.game.snapshot(), b.game.snapshot());
  a.game.input({ type: "restart" });
  assert.equal(a.game.nextSimulationWake(), null);
  a.scheduler.advanceTo(a.scheduler.now + 100);
  assert.equal(a.game.scene, "title");
  assert.throws(
    () => a.game.advanceSimulationWake(),
    /Unexpected simulation work/,
  );
});
test("destination work/provider boundaries reject missing resources, bad clocks and manual reads", () => {
  assert.throws(
    () => destinationFooterWork([], false),
    /Unsupported original EGA sprite/,
  );
  const a = setup();
  a.until(() => a.loop.ready);
  assert.throws(() => a.loop.input(0, 0), /only at the source boundary/);
  assert.throws(
    () => a.game.input({ type: "destination-read", keys: [] }),
    /Invalid destination reader/,
  );
  assert.throws(
    () => a.loop.advanceGraphics(),
    /Unexpected destination drawing/,
  );
  a.loop.elapsed = () => NaN;
  assert.throws(() => a.loop.time(), /Invalid destination simulation clock/);
  assert.throws(
    () => new Game({ destinationInput: "guess" }),
    /Unsupported destination input/,
  );
  assert.throws(
    () =>
      new DestinationLoop(0, false, {
        entries: original.archives.get("MAIN.ARC"),
      }),
    /Missing destination environment/,
  );
  const b = setup();
  b.until(() => b.loop.ready);
  b.loop.readInputByte = () => 256;
  assert.throws(
    () => b.until(() => b.loop.inputs === 1),
    /Invalid destination input/,
  );
});

test("every footer call consumes elapsed work before the reader runs", () => {
  const { game, scheduler, loop, until } = setup();
  const starts = [],
    reads = [];
  const flush = loop.flushInput,
    read = loop.readInputByte;
  loop.flushInput = () => {
    starts.push(scheduler.elapsed);
    flush();
  };
  loop.readInputByte = () => {
    reads.push(scheduler.elapsed);
    return read();
  };
  until(() => loop.inputs === 4);
  assert.equal(starts.length, 4);
  assert.equal(reads.length, 4);
  for (let i = 0; i < 4; i++)
    assert.ok(
      Math.abs(reads[i] - starts[i] - 18.889666666666667) < 1e-8,
      "Source footer completed before its partial work budget",
    );
});
test("atomic caller includes its fifth icon and keyboard choice2 enters actual transport", () => {
  const { game, loop, until } = setup(true);
  for (let choice = 1; choice <= 2; choice++) {
    until(() => loop.ready);
    key(game, 0x4d, true);
    key(game, 0x4d, false);
    until(() => loop.choice === choice);
    until(() => loop.ready);
  }
  const before = loop.inputs;
  key(game, 0x1c, true);
  key(game, 0x1c, false);
  until(() => loop.inputs === before + 1);
  until(() => game.scene === "atomic-transport");
  assert.equal(loop.footer.length, 6);
  assert.equal(loop.completedCalls, loop.inputs * 6);
  assert.deepEqual(loop.outcome, { returnCode: 1, choice: 2 });
  assert.equal(game.campaign.aircraft, "atomic");
  assert.ok(game.atomicTransport);
});
