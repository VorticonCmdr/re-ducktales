import test from "node:test";
import assert from "node:assert/strict";
import { advanceMapPointer } from "../src/game/map-pointer.js";
const initial = () => ({
  x: 174,
  y: 98,
  acceleration: 0,
  dx: 0,
  dy: 0,
  firstPollLatch: 0,
  spriteX: 166,
  spriteY: 90,
});
test("map pointer carries original acceleration through direction changes and diagonals", () => {
  let s = initial();
  for (const [code, x, y, n] of [
    [3, 175, 98, 1],
    [3, 177, 98, 2],
    [3, 180, 98, 3],
    [3, 184, 98, 4],
    [2, 194, 93, 5],
    [4, 206, 99, 6],
    [6, 192, 106, 7],
    [8, 176, 98, 8],
  ]) {
    s = advanceMapPointer(s, code);
    assert.deepEqual([s.x, s.y, s.acceleration], [x, y, n]);
  }
});
test("map neutral resets movement; Fire wins over arrows without drawing or moving", () => {
  const moving = advanceMapPointer(initial(), 3),
    idle = advanceMapPointer(moving, 0);
  assert.deepEqual(
    [idle.x, idle.y, idle.acceleration, idle.dx, idle.dy],
    [175, 98, 0, 0, 0],
  );
  assert.equal(advanceMapPointer(idle, 3).x, 176);
  for (const code of [0x43, 0x80, 0xc8]) {
    const s = advanceMapPointer(moving, code);
    assert.deepEqual(
      [s.x, s.y, s.acceleration, s.spriteX, s.spriteY],
      [175, 98, 1, 167, 90],
    );
    assert.equal(s.fire, true);
    assert.equal(s.drawEnabled, false);
  }
});
test("map counter cap, signed word wrapping and unknown direction follow static source branches", () => {
  let s = advanceMapPointer({ ...initial(), acceleration: 255 }, 3);
  assert.equal(s.acceleration, 256);
  assert.equal(s.x, 285);
  s = advanceMapPointer(s, 7);
  assert.equal(s.acceleration, 256);
  assert.equal(s.x, 32);
  assert.equal(advanceMapPointer({ ...initial(), x: 32767 }, 3).x, 32);
  assert.equal(advanceMapPointer({ ...initial(), y: -32768 }, 1).y, 151);
  const unknown = advanceMapPointer({ ...initial(), acceleration: 9 }, 9);
  assert.deepEqual(
    [unknown.inputWord, unknown.acceleration, unknown.dx, unknown.dy],
    [0, 0, 0, 0],
  );
});
