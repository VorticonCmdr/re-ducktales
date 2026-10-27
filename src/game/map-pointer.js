import { s16, u16 } from "./integer.js";

export const MAP_DIRECTION_CODES = Object.freeze({
  up: 1,
  "up-right": 2,
  right: 3,
  "down-right": 4,
  down: 5,
  "down-left": 6,
  left: 7,
  "up-left": 8,
});
const vectors = [
  [0, 0],
  [0, -1],
  [2, -1],
  [1, 0],
  [2, 1],
  [0, 1],
  [-2, 1],
  [-1, 0],
  [-2, -1],
];

// Original overlay2:1edd..20ae. Input is the external reader's AX word, not a
// browser key or wall clock. Coordinates and IMUL/ADD results are signed words.
export function advanceMapPointer(state, inputWord) {
  const out = {
    ...state,
    inputWord: u16(inputWord),
    drawEnabled: false,
    fire: false,
  };
  if (out.inputWord & 0xc0) {
    out.fire = true;
    return out;
  }
  const direction = out.inputWord & 0x3f;
  if (direction >= 1 && direction <= 8) {
    const [dx, dy] = vectors[direction];
    out.x = s16(out.x + dx);
    out.y = s16(out.y + dy);
    out.dx = Math.sign(dx);
    out.dy = dy;
  } else {
    out.acceleration = out.dx = out.dy = out.firstPollLatch = out.inputWord = 0;
  }
  if (out.inputWord & 0x3f) {
    if (s16(out.acceleration) < 256) {
      if (out.acceleration !== 0) {
        if (direction === 2 || direction === 4) out.dx = s16(out.dx + 1);
        else if (direction === 6 || direction === 8) out.dx = s16(out.dx - 1);
      }
      out.acceleration = s16(out.acceleration + 1);
    }
  }
  if (out.acceleration === 0) {
    out.acceleration = 1;
    out.firstPollLatch = 1;
  }
  const scale = s16(out.acceleration - 1);
  out.x = s16(out.x + s16(out.dx * scale));
  out.y = s16(out.y + s16(out.dy * scale));
  if (out.firstPollLatch !== 0) out.acceleration = out.firstPollLatch = 0;
  out.x = Math.max(32, Math.min(285, out.x));
  out.y = Math.max(28, Math.min(151, out.y));
  out.spriteX = s16(out.x - 8);
  out.spriteY = s16(out.y - 8);
  out.drawEnabled = true;
  return out;
}
