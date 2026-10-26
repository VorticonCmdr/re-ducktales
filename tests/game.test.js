import test from "node:test";
import assert from "node:assert/strict";
import { MoneyBin } from "../src/game/money-bin.js";
import { Game } from "../src/game/application.js";
import { nextRandom, u16, s16, u32 } from "../src/game/integer.js";

function tick(bin, count) {
  for (let i = 0; i < count; i++) bin.advanceTick();
}
function finish(bin) {
  for (let i = 0; i < 5000 && !bin.complete; i++) {
    bin.advanceTick();
    bin.advanceRetrace();
  }
  assert.equal(bin.complete, true, "unfinished animation");
}
test("explicit integer and original rotate RNG boundaries", () => {
  assert.equal(u16(65536), 0);
  assert.equal(s16(65535), -1);
  assert.equal(u32(-1), 4294967295);
  assert.equal(nextRandom(0), 0x1249);
  assert.equal(nextRandom(0x6db8), 0);
  assert.equal(nextRandom(0xffff), 0xf248);
});
test("money-bin intro and timing-based rare-coin gate", () => {
  const bin = new MoneyBin();
  tick(bin, 168);
  assert.equal(bin.phase, "idle");
  assert.equal(bin.current.sprites[0].frame, 2);
  assert.equal(bin.nextPose, 3);
  bin.enqueueFire();
  tick(bin, 14);
  assert.equal(bin.won, true);
  assert.equal(bin.coinAvailable, false);
  assert.deepEqual(bin.current.sprites[0], {
    asset: 1,
    frame: 4,
    x: 176,
    y: 73,
  });
  finish(bin);
  assert.equal(bin.drainEvents().filter((e) => e.type === "return").length, 1);
});
test("other idle phase fails and does not consume the coin latch", () => {
  const bin = new MoneyBin();
  tick(bin, 182);
  assert.equal(bin.current.sprites[0].frame, 3);
  bin.enqueueFire();
  tick(bin, 14);
  assert.equal(bin.won, false);
  assert.equal(bin.coinAvailable, true);
  finish(bin);
});
test("return applies a single 1000-dollar reward and restart clears campaign state", () => {
  const game = new Game();
  game.input({ type: "fire" });
  game.input({ type: "fire" });
  game.input({ type: "money-bin" });
  for (let i = 0; i < 168; i++) game.advanceTick();
  game.input({ type: "fire" });
  for (let i = 0; i < 1000; i++) {
    game.advanceTick();
    game.advanceRetrace();
  }
  assert.equal(game.scene, "office");
  assert.equal(game.money, 1000);
  assert.equal(game.rareCoinTaken, true);
  for (let i = 0; i < 100; i++) game.advanceTick();
  assert.equal(game.money, 1000);
  game.input({ type: "money-bin" });
  for (let i = 0; i < 168; i++) game.advanceTick();
  game.input({ type: "fire" });
  for (let i = 0; i < 1000; i++) {
    game.advanceTick();
    game.advanceRetrace();
  }
  assert.equal(game.money, 1000);
  game.input({ type: "restart" });
  assert.equal(game.scene, "title");
  assert.equal(game.money, 0);
  assert.equal(game.rareCoinTaken, false);
});
test("unsupported route fails explicitly", () => {
  const game = new Game();
  game.input({ type: "fire" });
  game.input({ type: "fire" });
  assert.throws(
    () => game.input({ type: "unsupported", route: "expedition" }),
    /Untranslated route/,
  );
});

test("clock catch-up preserves event order and closed-loop state", async () => {
  const { Scheduler } = await import("../src/game/scheduler.js");
  const run = (times) => {
    const game = new Game();
    const scheduler = new Scheduler(game, 0);
    for (const [at, event] of [
      [1, { type: "fire" }],
      [50, { type: "fire" }],
      [100, { type: "money-bin" }],
      [2500, { type: "fire" }],
    ])
      scheduler.enqueue(event, at);
    for (const now of times) scheduler.advanceTo(now);
    assert.equal(scheduler.events.length, 0);
    assert.equal(scheduler.consumed.length, 4);
    return game.snapshot();
  };
  assert.deepEqual(
    run([10000]),
    run(Array.from({ length: 1000 }, (_, i) => (i + 1) * 10)),
  );
});
