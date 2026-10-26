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

test("framebuffer copies preserve rectangle bounds, source coordinates and clipping", async () => {
  const { renderFlightPixels } = await import("../src/game/flight-raster.js");
  const fill = (color, x, y, width, height) => ({
    op: "fill",
    color,
    x,
    y,
    width,
    height,
  });
  const source = [fill(0, 0, 0, 320, 200), fill(4, 10, 10, 3, 3)];
  const commands = [
    fill(1, 0, 0, 320, 200),
    {
      op: "restore",
      source,
      sourceX: 10,
      sourceY: 10,
      x: 20,
      y: 30,
      width: 2,
      height: 2,
    },
  ];
  const pixels = renderFlightPixels(commands, []);
  const at = (x, y) => [
    ...pixels.slice((y * 320 + x) * 4, (y * 320 + x) * 4 + 4),
  ];
  for (const [x, y] of [
    [20, 30],
    [21, 30],
    [20, 31],
    [21, 31],
  ])
    assert.deepEqual(at(x, y), [170, 0, 0, 255]);
  for (const [x, y] of [
    [19, 30],
    [22, 30],
    [20, 29],
    [20, 32],
    [10, 10],
  ])
    assert.deepEqual(at(x, y), [0, 0, 170, 255]);
  const clipped = renderFlightPixels([{ ...commands[1], x: -1, y: 199 }], []);
  assert.deepEqual(
    [...clipped.slice(199 * 320 * 4, 199 * 320 * 4 + 4)],
    [170, 0, 0, 255],
  );
  assert.throws(
    () => renderFlightPixels([{ ...commands[1], sourceX: 319, width: 2 }], []),
    /Invalid framebuffer copy/,
  );
});
