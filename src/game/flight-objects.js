import { nextRandom, s16 } from "./integer.js";

export function flightRandom(m) {
  const seed = nextRandom(m.i(0x2229));
  m.i(0x2229, seed);
  return seed;
}

export function* tileObjects(m, tile) {
  if (tile < 0 || tile >= 130) throw Error(`Unsupported flight tile ${tile}`);
  const index = m.i(0x4f44 + tile * 4);
  if (index === -1) return;
  if (index < 0) throw Error(`Invalid flight object index ${index}`);
  for (let at = 0x79f2 + index * 14; ; at += 14) {
    if (at + 14 > 65536)
      throw Error(`Unterminated flight objects for tile ${tile}`);
    if (m.b(at) !== tile) return;
    yield at;
  }
}

// Overlay 4:194b..22ed. draw snapshots a descriptor at this consumption point;
// later mutations of that same descriptor must not change earlier commands.
export function updateFlightObjects(m, tile, draw, sound) {
  const place = (desc, x, y) => {
    m.i(desc, x);
    m.i(desc + 2, y);
    draw(desc);
  };
  const increment = (at) => m.b(at, m.b(at) + 1);
  const decrement = (at) => m.b(at, m.b(at) - 1);
  const distance = (o) => s16(Math.trunc(m.f(0x6d18) - m.i(o + 2)));
  const setSling = (o) => {
    m.i(0x5ac2, m.i(0x6ec0) + 16);
    m.i(0x5ac4, m.i(0x6ec2) + m.i(0x6ec6));
    m.i(o + 0x12, m.i(0x5ac4));
  };
  for (const o of tileObjects(m, tile)) {
    const type = m.b(o + 12);
    if (type === 0x11) {
      m.i(0x6ec0, m.i(o + 2));
      const bottom = s16(m.i(o + 4) + m.i(o + 10));
      if (m.f(0x6d3e) > s16(bottom + 6)) m.i(o + 4, m.i(o + 4) + 1);
      else if (m.f(0x6d3e) < s16(bottom - 6)) m.i(o + 4, m.i(o + 4) - 1);
      m.i(0x6ec2, m.i(o + 4));
      draw(0x6ec0);
      const dx = distance(o);
      if (
        m.b(o + 13) === 0 &&
        dx > -100 &&
        dx < 100 &&
        s16(m.i(o + 4) + m.i(o + 10)) < m.f(0x6d3e) &&
        s16(m.i(o + 0x26) + 12) < s16(160 - m.i(o + 0x26))
      ) {
        m.b(o + 0x28, 2);
        m.b(o + 13, 1);
        m.b(o + 0x1b, 2);
      }
      const body = m.b(o + 0x29);
      const [falling, landed] =
        body === 0x14
          ? [0x4cf4, 0x4d08]
          : body === 0x16
            ? [0x6954, 0x6968]
            : body === 0x18
              ? [0x9598, 0x9598]
              : [0x6f16, 0x6f16];
      const phase = m.b(o + 13);
      if (phase === 0) {
        setSling(o);
        draw(0x5ac2);
      } else if (phase === 1) {
        m.i(0x95ae, m.i(0x6ec2) + m.i(0x6ec6));
        m.i(0x95ac, m.i(0x6ec0) + 16);
        m.i(o + 0x20, m.i(0x95ae) + 4);
        place(falling, m.i(0x6ec0) + 8, m.i(o + 0x20));
        draw(0x95ac);
        if (decrement(o + 0x1b) === 0) {
          sound(0x33);
          m.b(o + 13, 2);
        }
      } else if (phase === 2) {
        setSling(o);
        increment(o + 0x28);
        m.i(o + 0x20, m.i(o + 0x20) + m.signedByte(o + 0x28));
        if (s16(160 - m.i(o + 0x26)) < m.i(o + 0x20)) {
          m.i(o + 0x20, 160 - (m.i(o + 0x26) >> 1));
          if (m.i(0x4f42 + tile * 4) < 12) {
            const correction = body === 0x16 ? 4 : body === 0x14 ? 5 : 0;
            m.i(o + 0x20, m.i(o + 0x20) - correction);
            place(falling, m.i(0x6ec0) + 8, m.i(o + 0x20));
            draw(0x5ac2);
            m.i(o + 0x20, m.i(o + 0x20) + correction);
            m.b(o + 0x1b, 8);
            sound(
              body === 0x14
                ? 0x28
                : body === 0x16
                  ? 0x29
                  : body === 0x18
                    ? 0x38
                    : 0x34,
            );
            m.b(o + 13, 3);
            continue;
          }
          if (body === 0x14) m.i(o + 0x20, m.i(o + 0x20) - 5);
          m.b(o + 0x1b, 2);
          m.b(o + 13, 4);
        }
        place(falling, m.i(0x6ec0) + 8, m.i(o + 0x20));
        draw(0x5ac2);
      } else if (phase === 3) {
        if (m.signedByte(o + 0x1b) > 5)
          place(landed, m.i(0x6ec0) + 8, m.i(o + 0x20) - 2);
        setSling(o);
        draw(0x5ac2);
        if (decrement(o + 0x1b) === 0) {
          m.b(o + 0x28, 0);
          m.b(o + 13, 0);
        }
      } else if (phase === 4) {
        sound(0x3a);
        place(0x7182, m.i(0x6ec0) - 12, 160 - m.i(0x7188));
        setSling(o);
        draw(0x5ac2);
        if (decrement(o + 0x1b) === 0) {
          m.b(o + 0x28, 0);
          m.b(o + 0x1b, 5);
          m.b(o + 13, 0);
        }
      }
    } else if (type === 0x1d) {
      const bottom = s16(m.i(o + 4) + m.i(o + 10));
      if (m.f(0x6d3e) > s16(bottom + 6)) m.i(o + 4, m.i(o + 4) + 2);
      else if (m.f(0x6d3e) < s16(bottom - 6)) m.i(o + 4, m.i(o + 4) - 2);
      const maximum = s16(176 - m.i(o + 10) - m.i(0x5e9a));
      if (m.i(o + 4) < -52) m.i(o + 4, -52);
      else if (m.i(o + 4) > maximum) m.i(o + 4, maximum);
      place(0x929e, m.i(o + 2), m.i(o + 4));
      m.i(0x5e94, m.i(0x929e) + 7);
      m.i(o + 16, m.i(0x5e94));
      m.i(0x5e96, m.i(0x92a0) + m.i(0x92a4) - 11);
      m.i(o + 18, m.i(0x5e96));
      if (
        (m.i(0x5e96) < m.f(0x6d3e) &&
          m.f(0x6d3e) < s16(m.i(0x5e96) + m.i(0x5e9a)) &&
          m.f(0x6d18) < s16(m.i(o + 8) + m.i(0x929e) + 16) &&
          s16(m.i(0x929e) - 16) < m.f(0x6d18) &&
          flightRandom(m) % 100 > 5) ||
        m.signedByte(0x0fba) > 0
      ) {
        draw(0x5e94);
        m.b(o + 0x1b, 1);
        m.b(0x0fba, m.b(0x0fba) === 0 ? 10 : m.b(0x0fba) - 1);
      } else m.b(o + 0x1b, 0);
    } else if (type === 0x20) {
      if (m.b(o + 13) === 0 && m.b(o - 8) === 3) m.b(o - 8, 0);
      m.i(0x8dd2, m.i(o - 12));
      m.i(0x8dd4, m.i(o - 10));
      if (decrement(o - 1) === 0 && m.signedByte(o - 8) < 2) {
        m.b(o - 1, 3);
        increment(o - 8);
      }
      if (m.signedByte(o - 1) < 1) m.b(o - 1, 3);
      m.b(0x8de4, m.b(o - 8));
      draw(0x8dd2);
      const dx = distance(o);
      if (
        (dx > -129 && dx < 129 && m.f(0x6d3e) <= m.f(0x33a2)) ||
        m.b(o + 13) !== 0
      ) {
        if (m.b(o + 13) === 0 && m.b(o - 8) === 2) {
          sound(0x2a);
          m.b(o - 8, 3);
          m.b(o + 13, 1);
          m.i(o + 4, 144);
          m.b(o + 6, 2);
        } else if (m.b(o + 13) === 3 && m.signedByte(o + 6) > 2) {
          m.b(o + 6, 0);
          m.b(o + 13, 0);
          continue;
        }
        if (m.i(o + 4) < 0) {
          m.b(o - 8, 0);
          m.i(o + 4, 144);
          m.b(o + 13, 0);
          continue;
        }
        if (m.i(o + 4) < m.f(0x6d3e) && m.signedByte(o + 13) < 3) {
          sound(0x31);
          m.b(o - 8, 0);
          m.b(o + 13, 3);
          m.b(o + 6, 0);
        }
        const phase = m.b(o + 13);
        if (phase === 1 || phase === 2) {
          m.b(0x8bec, phase - 1);
          m.i(0x8bda, m.i(o + 2));
          m.i(0x8bdc, m.i(o + 4));
          m.i(o + 4, m.i(o + 4) - 7);
          draw(0x8bda);
          if (decrement(o + 6) === 0) {
            m.b(o + 6, phase === 1 ? 2 : 3);
            m.b(o + 13, phase === 1 ? 2 : 1);
          }
        } else if (m.signedByte(o + 13) > 2 && m.signedByte(o + 13) < 6) {
          if (phase === 3) increment(o + 6);
          m.b(0x96f0, phase - 3);
          place(0x96de, m.i(o + 2), m.i(o + 4));
          if (increment(o + 13) > 5) m.b(o + 13, 3);
        }
      }
    } else if (type === 0x2e) {
      const dx = distance(o);
      if (
        (s16(160 - m.i(0x4d54) - m.i(0x7136)) <= m.f(0x6d3e) &&
          dx >= -120 &&
          dx <= 120) ||
        m.b(o + 13) !== 0
      ) {
        if (m.b(o + 13) === 0) {
          m.b(o + 13, 1);
          m.b(o + 0x1b, 1);
          continue;
        }
        if ((dx < -128 || dx > 128) && m.signedByte(o + 13) < 6) {
          m.b(o + 13, 6);
          m.b(o + 0x1b, 8);
        }
        const phase = m.b(o + 13);
        const desc = { 1: 0x6e56, 2: 0x6f00, 3: 0x7130, 6: 0x6f00, 7: 0x6e56 }[
          phase
        ];
        if (desc !== undefined) place(desc, m.i(o + 2), m.i(o + 4));
        else if (phase === 4 || phase === 5) {
          const jaws = phase === 4 ? 0x4cc8 : 0x4d4e;
          place(jaws, m.i(o + 2), m.i(o + 4) - m.i(jaws + 6));
          place(0x7130, m.i(o + 2), m.i(o + 4));
        } else continue;
        if (decrement(o + 0x1b) === 0) {
          const next = {
            1: [2, 2],
            2: [3, 2],
            3: [4, 6],
            4: [5, 8],
            5: [3, 6],
            6: [7, 5],
            7: [0, 0],
          }[phase];
          if (phase === 3) sound(0x37);
          m.b(o + 13, next[0]);
          m.b(o + 0x1b, next[1]);
        }
      }
    } else if (type === 0x34) place(0x890e, m.i(o + 2), m.i(o + 4));
  }
}

// Overlay 4:22ee..2576. This is the foreground pass, after the plane.
export function foregroundFlightObjects(m, tile, draw, sound) {
  const place = (desc, o) => {
    m.i(desc, m.i(o + 2));
    m.i(desc + 2, m.i(o + 4));
    draw(desc);
  };
  for (const o of tileObjects(m, tile)) {
    const type = m.b(o + 12);
    if (type === 0x28) place(0x8cda + m.signedByte(o + 13) * 20, o);
    else if (type === 0x1a) place(0x4d68, o);
    else if (type === 0x1b) place(0x4d7c, o);
    else if (type === 0x21) place(0x6d9e + m.signedByte(o + 13) * 20, o);
    else if (type === 0x2a) {
      const roll = flightRandom(m) % 100;
      const dx = s16(Math.trunc(m.f(0x6d18) - m.i(o + 2)));
      if (
        m.b(o + 13) === 0 &&
        m.b(o + 0x1b) === 0 &&
        roll < 10 &&
        dx > -96 &&
        dx < 96
      ) {
        sound(0x36);
        m.b(o + 13, m.b(o + 13) + 1);
      } else if (m.signedByte(o + 13) < 2 && m.b(o + 13) !== 0) {
        m.b(o + 13, m.b(o + 13) + 1);
        place(0x71ac, o);
      }
    } else if (type === 0x2b) {
      if (m.signedByte(o - 1) >= 2) {
        m.b(o - 1, 0);
        m.b(o + 13, m.b(o + 13) + 1);
        place(0x78ce, o);
      } else if (m.signedByte(o + 13) > 0 && m.signedByte(o + 13) < 2) {
        m.b(o + 13, m.b(o + 13) + 1);
        place(0x78ce, o);
        if (m.b(o + 13) === 2) m.b(o + 13, 0);
      }
    } else if (type === 0x31) {
      m.i(0x36cc, m.i(o + 2));
      m.i(0x36d2, m.i(o + 2) + m.i(o + 8));
      m.i(0x36d0, m.i(o + 4) + 16);
      if (
        s16(m.i(o + 4) + 32) < m.i(0x36ca) &&
        m.i(0x36cc) < m.i(0x36ce) &&
        m.i(0x36d4) < m.i(0x36d2)
      )
        m.i(0x0faa, 1);
      else {
        m.i(0x0faa, 0);
        m.i(0x0fac, 0);
      }
      place(0x8e3c, o);
    } else if (type === 0x3a) {
      m.i(0x685a, m.i(o + 2) + (tile === 0 ? 17 : 62));
      m.i(0x685c, m.i(o + 4));
      const old = m.b(o + 6);
      m.b(o + 6, old + 1);
      if (old === 0) {
        m.b(0x686c, m.b(o + 13));
        m.b(o + 13, m.b(o + 13) + 1);
      } else m.b(o + 6, 0);
      if (m.signedByte(o + 13) > 2) m.b(o + 13, flightRandom(m) % 3);
      draw(0x685a);
    }
  }
}
