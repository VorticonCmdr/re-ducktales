import test from "node:test";
import assert from "node:assert/strict";
import { originalGame } from "./helpers/original-game.js";
import { Game } from "../src/game/application.js";
import { Flight } from "../src/game/flight.js";
import { Scheduler } from "../src/game/scheduler.js";
const o = await originalGame();
function setup() {
  const g = new Game({
    locations: o.game.locations,
    loot: o.game.loot,
    expeditionResources: o.game.expeditionResources,
    flightResources: o.game.flightResources,
    expeditionInput: "keyboard",
  });
  const scheduler = new Scheduler(g, 0);
  // Conditional campaign boundary; browser tests earn entry through the UI.
  g.scene = "map";
  g.campaign.point(37, 33);
  g.travel(g.campaign.selected);
  function until(fn) {
    for (let i = 0; i < 10000; i++) {
      if (fn()) return;
      scheduler.advanceTo(scheduler.now + 1);
    }
    throw Error("Unfinished flight keyboard sequence");
  }
  const key = (scanCode, pressed) =>
    g.input({ type: "expedition-key", scanCode, pressed });
  const read = () => {
    const before = g.expeditionKeyReads;
    until(() => g.expeditionKeyReads > before);
    assert.equal(g.expeditionKeyReads, before + 1, "Skipped required read");
    return g.lastExpeditionKeyByte;
  };
  const fly = () => until(() => g.scene === "flight");
  return { g, scheduler, until, key, read, fly };
}
test("flight physical provider never falls back to held digital controls", () => {
  const a = setup();
  a.fly();
  a.g.input({ type: "controls", fire: true, direction: "down" });
  assert.equal(a.read(), 0);
  assert.equal(a.g.flight.memory.f(0x0fae), 0);
});
test("flight mode0 alias release is consumed once before neutral", () => {
  const a = setup();
  a.fly();
  a.key(0x32, true);
  assert.equal(a.read(), 5);
  assert.equal(a.g.expeditionKeyboard.bytes()[0x32], 128);
  a.key(0x32, false);
  assert.equal(a.g.expeditionKeyboard.bytes()[0x32], 64);
  assert.equal(a.read(), 5);
  assert.equal(a.g.expeditionKeyboard.bytes()[0x32], 0);
  assert.equal(a.read(), 0);
});
test("flight raw scan priority and keypad diagonal bytes remain distinct", () => {
  const a = setup();
  a.fly();
  a.key(0x32, true);
  a.key(0x48, true);
  assert.equal(a.read(), 1);
  a.g.flushFlightInput();
  a.key(0x51, true);
  assert.equal(a.read(), 4);
  assert.equal(a.g.flight.memory.i(0x5466), 0);
  assert.equal(a.g.flight.memory.i(0x8a9c), 0);
});
test("a flight Fire tap survives until one actual ordinary read", () => {
  const a = setup();
  a.fly();
  a.key(0x1c, true);
  a.key(0x1c, false);
  assert.equal(a.g.flight.inputLog.length, 0);
  assert.equal(a.read(), 192);
  assert.ok(a.g.flight.memory.f(0x0fae) > 0);
  assert.equal(a.read(), 0);
});
test("departure flush discards early makes and carries reveal flags into flight mode0", () => {
  const a = setup();
  a.key(0x39, true);
  a.until(() => a.g.departureScene.phase === "reveal");
  assert.equal(a.g.expeditionKeyboard.bytes()[0x39], 0);
  a.key(0x32, true);
  a.key(0x1c, true);
  a.fly();
  assert.equal(a.g.expeditionKeyboard.mode, 0);
  assert.equal(a.g.flight.memory.b(0x3c1), 0);
  assert.equal(a.g.flight.memory.b(0x276c + 0x32), 128);
  assert.equal(a.read(), 197);
  assert.equal(a.read(), 197);
});
test("flight Pause suspends the raw read and resume flushes held flags", () => {
  const a = setup();
  a.fly();
  a.key(0x39, true);
  a.g.input({ type: "pause" });
  a.until(() => a.g.systemOverlay?.phase === "waiting");
  assert.equal(a.g.expeditionKeyReads, 0);
  assert.equal(a.g.flight.wait.clock, "input");
  a.g.input({ type: "pause" });
  a.until(() => a.g.systemOverlay === null);
  assert.equal(a.g.expeditionKeyReads, 1);
  assert.equal(a.g.lastExpeditionKeyByte, 0);
  assert.ok(a.g.expeditionKeyboard.bytes().every((b) => b === 0));
});
test("flight special-input source flush requires a fresh make", () => {
  const a = setup();
  a.fly();
  a.key(0x39, true);
  a.g.input({ type: "pause" });
  a.g.flight.clearSpecialInput(); // Conditional source helper, not a natural strike.
  assert.equal(a.g.pendingFlightSystemKeys.size, 0);
  a.key(0x39, false);
  assert.equal(a.read(), 0);
  a.key(0x39, true);
  assert.equal(a.read(), 192);
});
function returnWait() {
  const a = setup();
  a.fly();
  const f = a.g.flight;
  // Conditional resident09f5 call. The independent browser case crashes naturally.
  f.iterator = f.finish("crashed");
  f.resume();
  a.until(() => f.phase === "return-wait");
  assert.equal(f.returnInputLog.length, 1);
  assert.equal(f.returnInputLog[0].code, 0);
  return { ...a, f };
}
test("flight return polls raw Fire and cannot use the digital tap shortcut", () => {
  const a = returnWait();
  a.f.requestFire();
  a.until(() => a.f.returnInputLog.length === 2);
  assert.equal(a.f.outcome, null);
  a.key(0x39, true);
  a.key(0x39, false);
  a.until(() => a.f.outcome !== null);
  assert.equal(a.f.returnInputLog.length, 3);
  assert.equal(a.f.returnInputLog.at(-1).code, 192);
});
test("flight raw provider validates eight-bit results and pitch masks for all256 bytes", () => {
  const options = {
    ...o.game.flightResources,
    days: 1,
    day: 1,
    racing: false,
    difficulty: 0,
    seed: 1960,
    money: 0,
  };
  for (const readInput of [null, 1, true])
    assert.throws(
      () => new Flight({ ...options, readInput }),
      /input-byte provider/,
    );
  for (const byte of [-1, 256, 0.5, NaN]) {
    const f = new Flight({ ...options, readInput: () => byte });
    assert.throws(() => f.advanceRetrace(), /input-byte provider/);
  }
  for (let byte = 0; byte < 256; byte++) {
    const f = new Flight({ ...options, readInput: () => byte });
    f.advanceRetrace();
    assert.equal(f.inputLog[0].code, byte);
    assert.equal(f.memory.i(0x5466), +(byte % 64 === 1));
    assert.equal(f.memory.i(0x8a9c), +(byte % 64 === 5));
    assert.equal(f.memory.f(0x0fae) > 0, (byte & 192) !== 0);
  }
});
test("flight physical event stream is invariant to scheduler catch-up size", () => {
  const run = (step) => {
    const a = setup();
    for (const [at, scanCode, pressed] of [
      [12, 0x39, true],
      [350, 0x39, false],
      [500, 0x32, true],
      [600, 0x1c, true],
      [1200, 0x32, false],
      [1300, 0x1c, false],
    ])
      a.scheduler.enqueue({ type: "expedition-key", scanCode, pressed }, at);
    for (let at = step; at <= 2000; at += step) a.scheduler.advanceTo(at);
    assert.equal(a.scheduler.events.length, 0);
    assert.equal(a.scheduler.consumed.length, 6);
    assert.ok(a.g.expeditionKeyReads > 0);
    return { state: a.g.snapshot(), memory: a.g.flight.memory.bytes };
  };
  assert.deepEqual(run(1), run(1000));
});
