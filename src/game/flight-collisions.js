import { s16 } from "./integer.js";
import { flightRandom, tileObjects } from "./flight-objects.js";

// Overlay 4:261f..2b9f. A spin yields real presentation steps through the
// supplied generator; no animation is collapsed into a guessed final heading.
export function* collideFlight(m, { sound = () => {}, flushInput, spin } = {}) {
  if (m.b(0x5ed4) && m.i(0x8d7c) >= m.i(0x5ce6) && m.i(0x5d12) > 288) return 2;
  const tile = m.i(0x0fb4);
  if (m.i(0x0fbc) !== tile) m.i(0x0fbc, 0);
  const remember = (type) => {
    m.i(0x0fbc, tile);
    m.i(0x0fbe, type);
  };
  for (const o of tileObjects(m, tile)) {
    const type = m.b(o + 12),
      signedType = m.signedByte(o + 12);
    if (m.i(0x0faa) !== 0) {
      m.i(0x974c, m.i(0x974c) < 4 || m.i(0x974c) > 12 ? 0 : 8);
      if (m.i(0x0fac) === 0) {
        m.i(0x0faa, 0);
        sound(0x39);
        m.b(0x7978, 1);
        m.view.setUint32(
          0x8cc0,
          (m.view.getUint32(0x8cc0, true) + 50) >>> 0,
          true,
        );
        m.i(0x0fac, 1);
      }
      return 0;
    }
    if (
      ((type === 0x2a || type === 0x2b) && m.b(o + 13) === 0) ||
      (m.b(o - 16) === 0x11 &&
        (m.signedByte(o - 15) < 1 || m.signedByte(o - 15) > 3)) ||
      type === 0x1a ||
      type === 0x3a ||
      (type === 0x2c && m.b(o - 1) !== 4) ||
      (type === 0x2d && m.b(o - 15) !== 5) ||
      (type === 0x1f && m.b(o + 13) === 0)
    )
      continue;
    let top = m.i(o + 4),
      bottom = s16(top + m.i(o + 10));
    let left = m.i(o + 2),
      right = s16(left + m.i(o + 8));
    if (type === 0x11) {
      top = s16(top + 10);
      left = s16(left + 4);
    } else if (type === 0x28 || type === 0x29) {
      bottom = s16(bottom - 5);
      top = s16(top + 9);
      left = s16(left + 20);
      right = s16(right - 20);
    } else if (type === 0x21 || type === 0x22) {
      top = s16(top + 9);
      left = s16(left + 20);
      right = s16(right - 20);
      bottom = s16(bottom + 3);
    } else if (type === 0x23 || type === 0x24) {
      const n = m.f(0x0fae) > m.d(0x332a) ? 24 : 30;
      left = s16(left + m.signedByte(o + 6) + n);
      right = s16(right + m.signedByte(o + 6) - n);
    } else if (type === 0x1c) {
      const n = m.f(0x0fae) > m.d(0x332a) ? 25 : 37;
      left = s16(left + n);
      right = s16(right - n);
    } else if (type === 0x20) {
      left = s16(left - 4);
      right = s16(right + 4);
    } else if (type === 0x1f) {
      left = s16(left + 6);
      right = s16(right - 6);
      bottom = s16(bottom - 10);
    } else if (type === 0x1b) {
      left = s16(left + 8);
      top = s16(top + 10);
    } else if (type === 0x34) {
      left = s16(left + 32);
      top = s16(top + 6);
    } else if (type === 0x31) {
      top = s16(top + 16);
      bottom = s16(top + 20);
      right = s16(left + 80);
      left = s16(left + 6);
    }
    if (m.b(o - 16) === 0x11 && m.b(o + 13) !== 0x14) {
      left = s16(left - 8);
      right = s16(right + 8);
      top = s16(top - 8);
      bottom = s16(bottom + 8);
    }
    if (
      m.i(0x36c8) <= top ||
      bottom <= m.i(0x36ca) ||
      m.i(0x36d4) <= left ||
      right <= m.i(0x36ce)
    )
      continue;
    if (m.i(0x0fbc) === tile && signedType === m.i(0x0fbe)) return 0;
    if (type === 0x2a || type === 0x2b) {
      m.f(0x6d3e, m.f(0x33b2));
      m.i(0x974c, flightRandom(m) & 1 ? 8 : 0);
      m.i(0x0fc0, 1);
      remember(signedType);
      if (typeof flushInput !== "function")
        throw Error(
          "Flight lightning collision requires the original input-flush provider",
        );
      flushInput();
      m.i(0x5466, 0);
      m.i(0x8a9c, 0);
      return 0;
    }
    if (type === 0x34) {
      m.i(0x715a, m.i(o + 2) + 64);
      m.i(0x715c, m.i(o + 4) + 8);
      m.i(0x77c4, m.i(o + 2) + 48);
      m.i(0x77da, m.i(o + 4) + 35);
      m.i(0x0fc0, 1);
      m.b(0x0fb7, 1);
      return 0;
    }
    if (type === 0x1b) {
      m.f(0x6d18, m.f(0x3312));
      return 1;
    }
    if ([0x21, 0x22, 0x28, 0x29].includes(type)) {
      if (!spin)
        throw Error(
          "Flight collision requires the original spin animation provider",
        );
      yield* spin();
      if (m.i(0x974c) > 8 && m.i(0x974c) < 16) m.f(0x0fae, m.f(0x3316));
      m.i(0x0fc0, 1);
      remember(signedType);
      return 0;
    }
    if (type === 0x1c) {
      m.i(0x974c, (m.i(0x974c) + 8) & 15);
      sound(0x35);
      return 0;
    }
    if (type === 0x23 || type === 0x24) {
      m.i(0x974c, (m.i(0x974c) + 8) & 15);
      sound(0x32);
      return 0;
    }
    if (type === 0x31) {
      if (left < m.i(0x36ce) && m.i(0x36d4) < right) {
        if (m.i(0x36ca) < top) {
          if (m.i(0x974c) > 8) m.i(0x974c, 16 - m.i(0x974c));
          else if (m.i(0x974c) === 0) m.i(0x974c, 2);
          else if (m.i(0x974c) === 8) m.i(0x974c, 6);
        } else m.i(0x974c, m.i(0x974c) < 4 || m.i(0x974c) > 12 ? 0 : 8);
      } else m.i(0x974c, (m.i(0x974c) + 8) & 15);
      m.i(0x0fc0, 1);
      sound(0x32);
      return 0;
    }
    if (type === 0x2c) m.b(0x0fb8, 1);
    else if (type === 0x2d) m.b(0x0fb8, 2);
    else if (type === 0x1f) m.b(0x0fb6, 1);
    else sound(0x28);
    m.i(0x974c, flightRandom(m) & 15);
    remember(signedType);
    m.i(0x0fc0, 1);
    if (m.i(0x974c) > 8 && m.i(0x974c) < 16) m.f(0x0fae, m.f(0x3316));
    if (m.f(0x6d3e) >= m.d(0x33b6)) m.i(0x974c, 0);
  }
  return 0;
}
