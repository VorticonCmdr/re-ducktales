import { nextRandom, s16, u16 } from "./integer.js";
import {
  markJungleDirty,
  initializeJunglePlatformEdges,
  flagJunglePlatformDirty,
  flagJungleMovingPlatformDirty,
  flagJungleMonkeyDirty,
  flagJungleBirdDirty,
} from "./jungle-collision.js";
import {
  initializeJungleObjectAnimation,
  selectJungleActorAnimation,
} from "./jungle-animation.js";
import { jungleStartingPlatform } from "./jungle-map.js";

const writeWords = (m, values) => {
  for (const [at, value] of values) m.i(at, value);
};
const listResources = (m, base, count, source) => {
  for (let i = 0; i < count; i++) m.i(base + i * 14, m.i(source));
};

// Main12dd. Palette output is explicit; it cannot feed back into simulation.
export function initializeJungleLife(m, first, effects = {}) {
  m.i(0x5cfc, first ? 1 : m.i(0x5cfc) + 1);
  const lives = s16(4 - m.i(0x5cfc));
  const colors = { 1: [0xc2, 0x4a], 2: [0x49, 1], 3: [0x84, 0x8c] }[lives];
  if (colors) {
    m.b(0x205b, colors[0]);
    m.b(0x2063, colors[1]);
  }
  effects.palette?.({
    mode: m.b(0x2042) === 0 ? 0 : 0x1101,
    bytes: m.bytes.slice(0x2056, 0x2067),
  });
  writeWords(m, [
    [0x6882, 5],
    [0x3d12, 1],
    [0x8e26, 0],
    [0x8d64, 0],
    [0x8924, 0],
    [0x7158, 0],
    [0x882a, 0],
    [0x7166, 0],
  ]);
  const { column, row } = jungleStartingPlatform(m);
  m.i(0x544c, column);
  m.i(0x5462, row);
  m.i(0x5f46, column * 53 + 8);
  m.i(0x6858, row * 32 + 16);
  m.i(0x7030, m.i(0x5f46) - 16);
  m.i(0x711a, m.i(0x5f46) - 16);
  m.i(0x716a, m.i(0x6858));
  m.i(0x7196, m.i(0x6858));
  selectJungleActorAnimation(m, m.i(0x6882), effects);
}

// e7a:0006. Reset all six monkey slots, including inactive map entries.
export function initializeJungleMonkeys(m, effects = {}) {
  for (const base of [0x8a80, 0x9764]) listResources(m, base, 2, 0x5b26);
  listResources(m, 0x5ae6, 3, 0x5b26);
  listResources(m, 0x697e, 12, 0x5b26);
  listResources(m, 0x5f4a, 5, 0x5b26);
  writeWords(m, [
    [0x8a82, 0],
    [0x8a8c, 0],
    [0x8a90, 1],
    [0x8a9a, 12],
    [0x9766, 0],
    [0x9774, 1],
    [0x977e, 12],
    [0x5ae8, 2],
    [0x5aea, 5],
    [0x5af6, 3],
    [0x5af8, 128],
    [0x5b04, 1],
    [0x5f4c, 6],
    [0x5f4e, 3],
    [0x5f5a, 7],
    [0x5f5c, 0],
    [0x5f68, 7],
    [0x5f6a, 0],
    [0x5f76, 7],
    [0x5f78, 64],
    [0x5f84, 6],
    [0x5f86, 3],
  ]);
  for (let i = 0; i < 12; i++) {
    m.i(0x6980 + i * 14, i % 2 === 0 ? 4 : 5);
    if (i % 2 === 1) m.i(0x6982 + i * 14, 2);
  }
  const difficulty = m.b(0x8990);
  if (difficulty === 0) m.i(0x3748, 6);
  else if (difficulty === 1)
    writeWords(m, [
      [0x1b0c, 50],
      [0x1b0e, 75],
      [0x1b10, 75],
      [0x3748, 3],
    ]);
  else if (difficulty === 2)
    writeWords(m, [
      [0x1b0c, 75],
      [0x1b0e, 75],
      [0x1b10, 85],
      [0x3748, 2],
    ]);
  for (let id = 0; id < 6; id++) {
    const at = id * 62;
    m.i(at + 0x58e8, m.i(at + 0x58ec));
    m.i(at + 0x58f6, 14);
    m.i(at + 0x58f8, 0);
    m.i(at + 0x5908, m.i(0x3748));
    flagJungleMonkeyDirty(m, id, 7);
    initializeJungleObjectAnimation(
      m,
      2,
      at + 0x58ce,
      14,
      m.i(at + 0x58e8),
      m.i(at + 0x58ea),
      effects,
    );
  }
}

// 1036:000e. Five bird slots and the sparse shared action lists.
export function initializeJungleBirds(m, effects = {}) {
  for (const base of [0x6dc6, 0x6884]) {
    listResources(m, base, 3, 0x54ee);
    for (let i = 0; i < 3; i++) m.i(base + 4 + i * 14, 1);
  }
  listResources(m, 0x8a34, 4, 0x54ee);
  writeWords(m, [
    [0x6dc8, 6],
    [0x6dd6, 7],
    [0x6de4, 6],
    [0x6886, 2],
    [0x6894, 3],
    [0x68a2, 2],
    [0x8a36, 0],
    [0x8a44, 1],
    [0x8a52, 4],
    [0x8a60, 5],
  ]);
  for (let id = 0; id < 5; id++) {
    const at = id * 38;
    m.i(at + 0x3996, m.i(at + 0x399a) * 53);
    m.i(at + 0x3998, m.i(at + 0x399c) * 32 + 32);
    m.i(at + 0x3992, 14);
    flagJungleBirdDirty(m, id, 5);
    initializeJungleObjectAnimation(
      m,
      11,
      at + 0x397e,
      14,
      m.i(at + 0x3996),
      m.i(at + 0x3998),
      effects,
    );
  }
  const settings = [
    [80, 75, 20],
    [70, 85, 20],
    [60, 90, 10],
  ][m.b(0x8990)];
  if (settings)
    writeWords(m, [
      [0x3a3e, settings[0]],
      [0x3a40, settings[1]],
      [0x397c, settings[2]],
    ]);
  m.i(0x3a3c, m.i(0x397c) * 3);
}

// 1149:034a. Snake slot0 is deliberately omitted from the actor reset loop.
export function initializeJungleSnakes(m, effects = {}) {
  listResources(m, 0x6e6c, 6, 0x5468);
  writeWords(m, [
    [0x6e6e, 0],
    [0x6e7c, 1],
    [0x6e7e, 1],
    [0x6e8a, 2],
    [0x6e8c, 1],
    [0x6e98, 3],
    [0x6e9a, 4],
    [0x6ea6, 2],
    [0x6ea8, 1],
    [0x6eb4, 1],
    [0x6eb6, 1],
  ]);
  for (let id = 1; id < 6; id++) {
    const at = id * 38;
    m.i(at + 0x7054, m.i(at + 0x7034) * 53);
    m.i(at + 0x7056, m.i(at + 0x7036) * 32 + 33);
    m.i(at + 0x7052, 20);
    m.i(at + 0x7058, 20);
    initializeJungleObjectAnimation(
      m,
      8,
      at + 0x703e,
      20,
      m.i(at + 0x7054),
      m.i(at + 0x7056),
      effects,
    );
  }
}

// 11d4:000e. The coordinate loop writes slots0/1, while the dirty helper
// receives IDs1/2. Preserve that original indexing difference.
export function initializeJungleTransports(m) {
  for (let id = 1, at = 0x776e; id < 3; id++, at += 10) {
    m.i(at + 4, m.i(at) * 53 + 12);
    m.i(at + 6, m.i(at + 2) * 32 + 21);
    m.i(0x7776 + id * 10, 2);
  }
  m.b(m.view.getUint16(0x8c04, true) + 18, 0);
}

// 1090:0a6f. Only the first initialization rolls pickup flags and builds
// platform edge tables. Life resets preserve pickup state and consume no RNG.
export function initializeJunglePlatforms(m, first, effects = {}) {
  m.i(0x3a48, 1);
  for (let id = 1; id < m.i(0x3a42); id++) {
    flagJunglePlatformDirty(m, id, 2);
    const at = id * 50;
    if (m.i(at + 0x6048) === 0) {
      if (first) {
        const random = nextRandom(m.i(0x2229));
        m.i(0x2229, random);
        if (random % 100 < 25) m.i(0x8c30 + id * 2, 1);
      }
    } else {
      m.i(at + 0x606e, 1);
      m.i(
        at + 0x606a,
        m.i(at + 0x6040) * 53 + (m.i(at + 0x6040) & 1 ? 4 : -8) - 1,
      );
      m.i(at + 0x606c, m.i(at + 0x6042) * 32 + 48);
      flagJungleMovingPlatformDirty(m, id, 3);
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
  }
  m.i(0x3a44, 0);
  m.i(0x3a46, 0);
  if (first) initializeJunglePlatformEdges(m);
}

// Originalf26:00d4. The16 fish records each consume one original RNG draw;
// phase selection consumes one more. Reset reuses the map's type/amplitude.
export function initializeJungleFish(m) {
  const count = m.i(0x882c);
  if (count < 1 || count > 16)
    throw Error(`Unsupported jungle fish count ${count}`);
  const random = () => {
    const value = nextRandom(m.i(0x2229));
    m.i(0x2229, value);
    return value;
  };
  for (let id = 0; id < count; id++) {
    const at = 0x514a + id * 32,
      type = m.i(at + 6);
    if (type === 17) m.i(at + 14, 3);
    else if (type === 18) {
      m.i(at + 14, 4);
      m.i(at + 10, 32);
    } else throw Error(`Unsupported jungle fish type ${type} at ${id}`);
    m.i(at + 8, 80);
    // Original CWD/XOR/SUB/SAR/XOR/SUB, including the -32768 overflow.
    const value = m.i(at + 10),
      sign = value < 0 ? -1 : 0;
    const quarter = s16(((s16((value ^ sign) - sign) >> 2) ^ sign) - sign);
    const y = s16(153 - quarter);
    m.i(at + 2, y);
    m.i(at + 24, y);
    m.i(at + 26, y);
    const low = random() % 10 < 5;
    m.i(at + 12, low ? 0 : m.i(at + 14) - 1);
    m.i(at + 16, low ? 3 : 2);
    m.i(at + 28, 2);
    m.i(at + 30, 6);
    markJungleDirty(m, m.i(at + 22), m.i(at + 26), 88, 30, (id % 4) + 18);
  }
  m.i(0x5b3e, 2);
  m.i(0x778c, random() % u16(count));
  const difficulty = m.b(0x8990);
  if (difficulty <= 2) m.i(0x8c82, difficulty + 1);
}

// Original118a:0002. All ten slots are initialized, even unused map slots.
export function initializeJungleVines(m) {
  for (let id = 0; id < 10; id++) {
    const at = 0x5d40 + id * 34,
      x = m.i(at + 12),
      y = s16(m.i(at + 14) + m.i(at + 16));
    for (const off of [4, 6, 18]) m.i(at + off, x);
    for (const off of [8, 10, 20]) m.i(at + off, y);
    m.i(at + 22, 192);
    m.i(at + 30, 8);
    m.i(at + 32, 1);
  }
}

// Originalda0:0783. Sparse animation writes intentionally preserve delays
// and other tuple fields not assigned by the original initializer.
export function initializeJungleBonus(m) {
  for (let frame = 0; frame < 4; frame++) {
    m.i(0x6df4 + frame * 14, m.i(0x78e6));
    m.i(0x6df6 + frame * 14, [0, 1, 2, 1][frame]);
  }
  for (const at of [0x71f4, 0x71e8, 0x71ea]) m.i(at, 0);
  const wait = [350, 200, 100][m.b(0x8990)];
  if (wait !== undefined) m.i(0x54fa, wait);
}
