import { s16, u32 } from "./integer.js";
import {
  initializeJungleObjectAnimation,
  selectJungleActorAnimation,
} from "./jungle-animation.js";

const word = (m, at) => m.i(at & 65535);
export const jungleActorCenter = (m) =>
  s16(m.i(0x5f46) + (8 >> (m.b(0x3d12) & 31)));
export const jungleFeetRow = (m) => s16(m.i(0x6858) + 14) >> 5;
export function updateJungleGrid(m) {
  m.i(0x544c, Math.trunc(jungleActorCenter(m) / 53));
  m.i(0x5462, s16(m.i(0x6858) - 16) >> 5);
}
export function initializeJunglePlatformEdges(m) {
  for (let i = 0; i < 40; i++) {
    m.i(0x3a4a + i * 2, i * 53 + 55);
    m.i(0x3a9a + i * 2, i * 53 - 2);
  }
}
export const jungleRightEdge = (m, column) => word(m, 0x3a4a + column * 2);
export const jungleLeftEdge = (m, column) => word(m, 0x3a9a + column * 2);
export const junglePlatformAt = (m, column, row) =>
  word(m, 0x95ea + column * 8 + row * 2);

// Original1090:041c. Its column bound is41, even though the supplied maps
// populate22 columns. Preserve the original access to remaining DS cells.
export function queryJunglePlatform(m, horizontal, vertical) {
  const column = s16(
    m.i(0x544c) + (horizontal === 1 ? 1 : horizontal === 0 ? -1 : 0),
  );
  if (column < 0 || column >= 41) return null;
  let row;
  if (horizontal === 0 || horizontal === 1) {
    if (vertical === 2) {
      row = s16(m.i(0x5462) - 1);
      if (row < 0) return null;
    } else if (vertical === 3) {
      row = s16(m.i(0x5462) + 1);
      if (row > 2) return null;
    } else return null;
  } else {
    if (horizontal !== 2 || m.i(0x5462) < 1) return null;
    row = s16(m.i(0x5462) - 1);
  }
  return junglePlatformAt(m, column, row) === 0 ? null : { column, row };
}

// e4c:0004 and118a:043f. The caller compares signed high words followed by
// unsigned low words of the squared distance; this is a signed32 comparison.
export function jungleVineReach(m, index, x, y, threshold) {
  if (index <= 0) return false;
  if (m.signedByte(0x8990) === 0) threshold = s16(threshold * 3);
  else if (m.signedByte(0x8990) === 1) threshold = s16(threshold << 1);
  const dx = s16(x - word(m, 0x5d52 + index * 34)),
    dy = s16(y - word(m, 0x5d54 + index * 34));
  return ((Math.imul(dx, dx) + Math.imul(dy, dy)) | 0) < s16(threshold);
}

// f26:04de. Bucket division/remainder truncate toward zero, not floor.
export function findJungleFishSupport(m, x) {
  x = s16(x);
  let bucket = s16(Math.trunc(x / 128) + 1);
  if (x % 128 < m.i(0x6950)) bucket = s16(bucket - 1);
  const origin = s16(bucket * 128 + m.i(0x6950) - 128),
    count = m.i(0x882c);
  if (count === 0) throw Error("Invalid jungle fish count: division by zero");
  const index = s16(bucket + m.i(0x778c)) % count,
    at = index * 32;
  if (
    word(m, at + 0x514e) !== 1 ||
    word(m, at + 0x5156) >= word(m, at + 0x5158)
  )
    return -1;
  const left = s16(word(m, at + 0x5156) + origin + 10),
    right = s16(word(m, at + 0x5152) + origin),
    center = jungleActorCenter(m);
  return left <= center && center <= right ? index : -1;
}

// f97:0357. Dirty rectangles are simulation state used by original redraw
// decisions. Keep the original eight-pixel right-side overscan.
export function markJungleDirty(m, x, y, width, height, type) {
  if (m.i(0x78e8) >= 2) return;
  x = s16(x - m.i(0x5ed2));
  if (x < 0) {
    width = s16(width + x);
    if (width <= 0) return;
    x = 0;
  } else {
    if (x >= 320) return;
    if (s16(x + width) > 320) width = s16(328 - x);
  }
  if (y < 0) {
    height = s16(height + y);
    if (height <= 0) return;
    y = 0;
  } else {
    if (y > 176) return;
    if (s16(y + height) > 176) height = s16(176 - y);
  }
  if (width <= 0 || height <= 0) return;
  const at = (0x374c + type * 14) & 65535;
  [2, x, y, width, height, type].forEach((value, i) => m.i(at + i * 2, value));
}
function invalidatePlatform(m, id, kind) {
  const at = id * 50;
  m.i(at + 0x605e, 2);
  if (m.i(at + 0x6060) === 0 || kind === 3) m.i(at + 0x6060, kind);
  if (kind === 3) {
    markJungleDirty(m, m.i(at + 0x606a), s16(m.i(at + 0x606c) - 6), 72, 32, 24);
    for (const offset of [0x604e, 0x6050])
      if (m.i(at + offset) !== 0)
        flagJunglePlatformDirty(m, m.i(at + offset), 2);
  }
}
export { invalidatePlatform as flagJungleMovingPlatformDirty };

// ea1:00f5 and1036:050f. Initialization and later hazard updates share these
// redraw/dependency flags; requesting a redraw does not render or advance time.
export function flagJungleMonkeyDirty(m, id, kind) {
  const at = id * 62;
  m.i(at + 0x58da, 2);
  if (m.i(at + 0x58dc) === 0 || kind === 7) m.i(at + 0x58dc, kind);
  if (kind !== 7) return;
  markJungleDirty(m, m.i(at + 0x58f0), m.i(at + 0x58f4), 64, 74, id + 1);
  for (const off of [0x58e2, 0x58e4, 0x58e6])
    if (m.i(at + off) !== 0) flagJunglePlatformDirty(m, m.i(at + off), 7);
}
export function flagJungleBirdDirty(m, id, kind) {
  const at = id * 38;
  m.i(at + 0x398a, 2);
  if (m.i(at + 0x398c) === 0 || kind === 5) m.i(at + 0x398c, kind);
  if (kind !== 5) return;
  markJungleDirty(m, m.i(at + 0x3996), m.i(at + 0x3998), 64, 48, 11);
  for (const off of [0x399e, 0x39a0, 0x39a2])
    if (m.i(at + off) !== 0) flagJunglePlatformDirty(m, m.i(at + off), 5);
}
export function flagJungleSnakeDirty(m, id, kind) {
  const at = id * 38;
  m.i(at + 0x704a, 2);
  if (m.i(at + 0x704c) === 0 || kind === 8) m.i(at + 0x704c, kind);
}
export function flagJungleFishDirty(m, id, kind) {
  const at = id * 32;
  m.i(at + 0x5166, 2);
  if (m.i(at + 0x5168) === 0 || kind === 6) m.i(at + 0x5168, kind);
  if (kind === 6)
    markJungleDirty(
      m,
      m.i(at + 0x5160),
      m.i(at + 0x5164),
      88,
      30,
      (id % 4) + 18,
    );
}
export function flagJunglePlatformDirty(m, id, kind) {
  const at = id * 50;
  m.i(at + 0x6066, 2);
  if (m.i(at + 0x6068) === 0 || kind === 2) m.i(at + 0x6068, kind);
  if (kind !== 3 && m.i(at + 0x6048) !== 0) invalidatePlatform(m, id, 2);
  if (kind !== 8 && m.i(at + 0x604a) !== 0) {
    const snake = m.i(at + 0x604a) * 38;
    m.i(snake + 0x704a, 2);
    if (m.i(snake + 0x704c) === 0) m.i(snake + 0x704c, 2);
  }
}
export function leaveJungleMovingPlatform(m, id, effects = {}) {
  const at = id * 50;
  m.i(at + 0x606e, 1);
  for (const address of [0x8924, 0x882a, 0x3a44, 0x3a46]) m.i(address, 0);
  invalidatePlatform(m, id, 3);
  initializeJungleObjectAnimation(
    m,
    24,
    at + 0x6052,
    1,
    m.i(at + 0x606a),
    m.i(at + 0x606c),
    effects,
  );
}

// Main0b1e. Pickups and unsupported-ground transitions precede the action
// frame update. No RNG, wall clock or rendering is consumed here.
export function collideJungleGround(m, effects = {}) {
  const center = jungleActorCenter(m),
    row = jungleFeetRow(m),
    column = m.i(0x544c);
  const id = row < 3 ? junglePlatformAt(m, column, row) : 0;
  if (
    id !== 0 &&
    word(m, 0x8c30 + id * 2) !== 0 &&
    s16(column * 53 + 15) <= center &&
    center <= s16(column * 53 + 33) &&
    s16(row * 32 + 33) <= s16(m.i(0x6858) + 18) &&
    s16(m.i(0x6858) + 18) <= s16(row * 32 + 48)
  ) {
    if (m.b(0x3be)) effects.sound?.(0x20);
    m.i((0x8c30 + id * 2) & 65535, 0);
    m.view.setUint32(0x8cc0, u32(m.view.getUint32(0x8cc0, true) + 50), true);
    m.i(0x78e8, 3);
  }
  if (
    [1, 5].includes(m.i(0x6882)) &&
    m.i(0x8924) === 0 &&
    junglePlatformAt(m, column, row) === 0 &&
    m.i(0x5462) < 3 &&
    (junglePlatformAt(m, column - 1, row) === 0 ||
      jungleRightEdge(m, column - 1) <= s16(center + 1)) &&
    (junglePlatformAt(m, column + 1, row) === 0 ||
      s16(center + 4) <= jungleLeftEdge(m, column + 1))
  ) {
    m.i(0x6882, 2);
    selectJungleActorAnimation(m, 2, effects);
  }
}
