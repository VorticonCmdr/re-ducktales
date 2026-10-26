import { nextRandom, s16, u16 } from "./integer.js";
import { markJungleDirty } from "./jungle-collision.js";

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
