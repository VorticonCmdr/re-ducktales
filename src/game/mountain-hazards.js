import { s16, u16, u32, nextRandom } from "./integer.js";

// Overlay5 body189e..2829 (helper segment da0:000e).
// draw snapshots a descriptor immediately; subsequent writes must not change
// a previously emitted sprite. HUD refresh is an explicit drawing effect.
export function advanceMountainHazards(m, firstRow, offset, draw, sound, hud) {
  const add = (at, n) => m.i(at, m.i(at) + n);
  const redraw = () => m.i(0x4cf2, 2);
  const hurt = (frame, action, dx = 0, active = false) => {
    m.i(0x6d3c, frame);
    m.i(0x6882, action);
    if (active) m.i(0x6df0, 0x5ce8);
    if (dx) add(0x5ae0, dx);
    redraw();
  };
  const inRange = (row, x, width, avoidTransport = true) =>
    row === m.i(0x5c70) &&
    x >> 4 <= m.i(0x54f6) &&
    s16((x >> 4) + width) >= m.i(0x54f6) &&
    (!avoidTransport || m.i(0x6882) !== 10);
  m.b(0x88e4, 0);
  const below = offset < 0 ? 1 : 0;
  for (
    let row = firstRow - below;
    row < firstRow - below + 5 && row < 25;
    row++
  ) {
    if (row <= 0) continue;
    const h = u16(m.i(0x5d26) + row * 6);
    const type = m.b(h),
      state = m.b(h + 1),
      x = m.i(h + 2);
    const y = s16(-(row - firstRow) * 40 + offset);
    const pose = (at, px, py, frame) => {
      m.i(at, px);
      m.i(at + 2, py);
      m.b(at + 18, frame);
      draw(at);
    };
    switch (type) {
      case 0:
      case 5:
      case 7:
        break;
      case 1: {
        pose(0x5804, x, y + 130, 0);
        if (!inRange(row, x, 1)) break;
        m.b(0x88e4, 1);
        const delta = state === 1 ? 1 : -1;
        for (let to = row + delta; to > 0 && to < 25; to += delta) {
          const dest = u16(m.i(0x5d26) + to * 6);
          if (m.b(dest) !== 1) continue;
          m.b(0x54f0, to);
          m.i(0x5c46, u16(m.i(dest + 2)) & 0xfff0);
          break;
        }
        break;
      }
      case 2: {
        pose(0x5804, x, y + 130, state < 10 ? 0 : 1);
        const px = s16(x + (state < 10 ? 14 : -22));
        m.i(0x5818, px);
        m.i(0x581a, y + 130);
        let frame = m.b(0x582a);
        const counter = () => add(h + 4, -1);
        const next = (newFrame) => {
          frame = newFrame;
          m.b(h + 1, state + 1);
          m.i(h + 4, 2);
        };
        if (state === 0 || state === 10) {
          frame = state === 0 ? 0 : 5;
          if (inRange(row, px, state === 0 ? 3 : 2)) {
            if (add(h + 4, 1) >= (state === 0 ? 20 : 10)) {
              m.b(h + 1, state + 1);
              m.i(h + 4, 0);
              sound(0x0e);
            }
          }
        } else if (state >= 1 && state <= 3) {
          if (counter() <= 0) next(state);
          else frame = state - 1;
        } else if (state === 4) {
          if (counter() <= 0) {
            frame = 4;
            m.b(h + 1, 5);
            m.i(h + 4, 3);
            if (inRange(row, px, 3)) hurt(10, 9, 32);
          } else frame = 3;
        } else if (state >= 5 && state <= 7) {
          if (counter() <= 0) next(8 - state);
          else frame = 9 - state;
        } else if (state === 8) {
          m.b(h + 1, 0);
          frame = 1;
        } else if (state >= 11 && state <= 13) {
          if (counter() <= 0) next(state - 5);
          else frame = state - 6;
        } else if (state === 14) {
          if (counter() === 0) {
            frame = 9;
            m.b(h + 1, 15);
            m.i(h + 4, 3);
            if (
              row === m.i(0x5c70) &&
              (px >> 4) - 1 < m.i(0x54f6) &&
              (px >> 4) + 3 > m.i(0x54f6)
            )
              hurt(4, 9, -32, true);
          } else frame = 8;
        } else if (state >= 15 && state <= 17) {
          if (counter() === 0) next(23 - state);
          else frame = 24 - state;
        } else if (state === 18) {
          m.b(h + 1, 10);
          frame = 6;
        }
        m.b(0x582a, frame);
        draw(0x5818);
        break;
      }
      case 3: {
        m.i(0x582c, x);
        m.i(0x582e, y + 124);
        if (state === 0) {
          m.b(0x583e, 0);
          if (inRange(row, x, 2, false) && add(h + 4, 1) >= 10) {
            m.b(h + 1, 1);
            m.i(h + 4, 0);
            sound(0x5b);
          }
        } else if (state === 1) {
          m.b(0x583e, 1);
          m.i(h + 4, 5);
          m.b(h + 1, 2);
        } else if (state === 2) {
          if (add(h + 4, -1) <= 0) {
            m.b(0x583e, 2);
            m.i(h + 4, 5);
            m.b(h + 1, 3);
            hurt(10, 9, 32, true);
          } else m.b(0x583e, 1);
        } else if (state === 3) {
          if (add(h + 4, -1) <= 0) {
            m.b(0x583e, 3);
            m.b(h + 1, 0);
          } else m.b(0x583e, 2);
        }
        draw(0x582c);
        break;
      }
      case 4: {
        m.i(0x5842, y + 140);
        m.i(0x5856, y + 144);
        m.b(0x5866, 0);
        if (state === 0) {
          m.i(0x5840, x);
          m.b(0x5852, 0);
          m.b(h + 1, 1);
          m.i(h + 4, ((2 - m.signedByte(0x8990)) << 3) + 8);
        } else if (state === 1) {
          if (add(h + 4, -1) <= 0) {
            m.b(h + 1, 2);
            m.i(0x5854, x + 16);
          }
          m.b(0x5852, 0);
        } else if (state === 2) {
          if (add(h + 4, -1) <= 0) {
            m.b(h + 1, 3);
            m.b(0x5852, 2);
            m.i(0x5854, x + 16);
            sound(0x15);
          } else m.b(0x5852, 1);
        } else if (state === 3) {
          m.b(0x5852, 0);
          if (add(0x5854, -16) < 0) m.b(h + 1, 0);
          else if (
            row === m.i(0x5c70) &&
            m.i(0x5854) >> 4 === m.i(0x54f6) &&
            ![22, 28].includes(m.i(0x6d3c)) &&
            m.i(0x6882) !== 10
          ) {
            redraw();
            m.b(h + 1, 0);
            m.b(0x6ed4, 0);
            m.i(0x6882, 8);
            sound(0x18);
            sound(0x0f);
          } else draw(0x5854);
        }
        draw(0x5840);
        break;
      }
      case 6: {
        pose(0x5804, x, y + 130, 0);
        m.i(0x586a, y + 124);
        if (state === 0) {
          if (
            row === m.i(0x5c70) &&
            m.i(0x6882) !== 10 &&
            add(h + 4, 1) >= 40
          ) {
            m.b(h + 1, 1);
            m.i(h + 4, 20);
            sound(0x12);
          }
        } else if (state === 1 || state === 2) {
          m.b(h + 1, state === 1 ? 2 : 1);
          m.b(0x587a, state === 1 ? 0 : 1);
          draw(0x5868);
          hurt(state === 1 ? 10 : 11, 9, 0, true);
          if (add(h + 4, -1) <= 0) m.b(h + 1, 3);
        } else if (state === 3) {
          m.i(h + 4, 0);
          m.b(h + 1, 0);
          hurt(10, 9, 0, true);
          m.i(0x5510, 0);
          draw(0x5868);
        }
        break;
      }
      case 8:
        pose(0x5890, x, y + 131, 0);
        break;
      case 9:
        m.i(0x58a4, x);
        m.i(0x58a6, y + 148);
        m.b(0x58b6, 0);
        if (state === 0) {
          draw(0x58a4);
          if (inRange(row, x, 1)) {
            m.b(h + 1, 1);
            sound(0x20);
            m.view.setUint32(
              0x8cc0,
              u32(m.view.getUint32(0x8cc0, true) + 50),
              true,
            );
            hud();
          }
        }
        break;
      default:
        // Original unsigned switch skips types above9.
        break;
    }
  }
  advanceCloud(m, firstRow, offset, draw, sound);
  advanceRock(m, firstRow, offset, draw, sound);
}

function advanceCloud(m, firstRow, offset, draw, sound) {
  const h = 0x17da,
    at = 0x587c,
    state = m.b(h + 1);
  const add = (a, n) => m.i(a, m.i(a) + n);
  const cloud = (frame) => {
    m.b(at + 18, frame);
    draw(at);
  };
  const sparks = () => cloud(m.i(h + 4) & 1 ? 2 : 3);
  if (state === 0) {
    if (100 - (20 << m.b(0x8990)) < m.b(0x1615)) {
      // Original computes a candidate X locally but does not store it to h+2.
      m.b(h + 1, 1);
      m.b(0x1615, 0);
      m.i(at + 2, -30);
    }
  } else if (state === 1) {
    m.i(at, m.i(h + 2));
    add(at + 2, 2);
    cloud(0);
    sparks();
    if (m.i(at + 2) >= 0) {
      m.i(at + 2, 0);
      m.b(h + 1, 2);
      m.i(h + 4, 40);
      sound(0x0d);
    }
  } else if (state === 2) {
    let x = m.i(h + 2),
      target = m.i(0x5ae0) - (m.i(0x3d12) === 0 ? 0 : 16);
    if (x < target) x = s16(x + 8);
    else if (x > target) x = s16(x - 8);
    if (x < 0) x = 0;
    else if (x > 320 - m.i(at + 4)) x = 320 - (m.i(at + 4) << 3);
    m.i(h + 2, x);
    m.i(at, x);
    cloud(0);
    sparks();
    if (add(h + 4, -1) <= 0 && m.i(0x6882) !== 7) {
      m.b(h + 1, 4);
      m.i(h + 4, 0);
    }
  } else if (state === 4) {
    m.i(at, m.i(h + 2));
    cloud(1);
    sparks();
    m.b(0x5866, 1);
    m.i(0x5854, m.i(h + 2) + 18);
    m.i(0x5856, 40);
    draw(0x5854);
    m.i(h + 4, 5);
    m.b(h + 1, 5);
    sound(0x0b);
  } else if (state === 5) {
    m.i(at, m.i(h + 2));
    cloud(1);
    sparks();
    m.b(0x5866, 1);
    m.i(0x5854, m.i(h + 2) + 18);
    const previous = m.i(h + 4);
    add(h + 4, 1);
    m.i(0x5856, previous << 3);
    if (s16(m.i(0x5856) + 16) > 168) {
      m.i(0x5856, 152);
      m.b(h + 1, 0);
      sound(0);
    }
    draw(0x5854);
    const row = s16(Math.trunc(s16(160 - m.i(0x5856)) / 40) + firstRow);
    const column = m.i(0x5854) >> 4,
      player = m.i(0x54f6),
      frame = m.i(0x6d3c);
    if (
      row === m.i(0x5c70) &&
      ((column === player && m.i(0x6882) !== 10) ||
        (frame === 22 && column === player + 1) ||
        (frame === 28 && column === player - 1))
    ) {
      m.i(0x6df0, 0x5ce8);
      m.i(0x6d3c, m.i(0x3d12) === 0 ? 5 : 11);
      m.i(0x6882, 8);
      m.i(0x4cf2, 2);
      sound(0x38);
      sound(0x0f);
      m.b(h + 1, 0);
    }
    m.b(0x1615, 0);
  }
}

function advanceRock(m, firstRow, offset, draw, sound) {
  const h = 0x17e0,
    at = 0x58b8,
    state = m.b(h + 1);
  const add = (a, n) => m.i(a, m.i(a) + n);
  let x = m.i(h + 2);
  const startFall = () => {
    m.b(h + 1, 1);
    if (Math.abs(s16(m.i(0x3742) - m.i(0x5c70))) < 4) sound(0x41);
  };
  if (state === 0) {
    if (add(h + 4, -1) <= 0) {
      m.i(0x3742, 24);
      m.i(0x3744, 40);
      m.b(at + 18, 0);
      const seed = nextRandom(m.i(0x2229));
      m.i(0x2229, seed);
      m.i(h + 2, (seed % 320) & 0xfff0);
      startFall();
    }
  } else if (state === 1) {
    if (add(0x3744, -8) < 0) {
      x = m.i(h + 2);
      const cell = m.b(u16(m.i(0x57ee) + m.i(0x3742) * 21 + (x >> 4)));
      if (cell !== 0x46) {
        m.b(h + 1, x > 160 ? 3 : 2);
        if (Math.abs(s16(m.i(0x3742) - m.i(0x5c70))) < 6) sound(0x1c);
        if (m.i(0x3742) === firstRow) m.i(0x3744, 0);
      } else {
        add(0x3742, -1);
        m.i(0x3744, 40);
      }
    }
  } else if (state === 2 || state === 3) {
    x = add(h + 2, state === 2 ? 2 : -2);
    m.i(0x3744, -2);
    let frame = m.b(at + 18) + (state === 2 ? 1 : -1);
    if (state === 2 && frame > 2) frame = 0;
    else if (state === 3 && frame < 0) frame = 2;
    m.b(at + 18, frame);
    if (x <= 0) {
      m.i(h + 2, 0);
      m.b(h + 1, 0);
      m.i(h + 4, 5);
    } else if (s16(x + 16) >= 320) {
      m.i(h + 2, 303);
      m.b(h + 1, 0);
      m.i(h + 4, 5);
    }
    // Original continues using the local, unclamped X for this lookup.
    const cell = m.b(u16(m.i(0x57ee) + m.i(0x3742) * 21 + (x >> 4)));
    if (cell === 0x46) {
      add(0x3742, -1);
      m.i(0x3744, 40);
      startFall();
    } else if (
      m.i(0x5c70) === m.i(0x3742) &&
      Math.abs(s16((m.i(0x54f6) << 4) - x)) < 8 &&
      ![2, 3].includes(m.i(0x6882))
    ) {
      m.i(0x6df0, 0x5ce8);
      m.i(0x6d3c, m.i(0x3d12) === 0 ? 5 : 11);
      m.i(0x6882, 8);
      m.i(0x4cf2, 2);
      sound(0x38);
      sound(0x0f);
    }
  }
  // Original27cc compares h (17e0) with six times a byte local. That
  // product is at most1530 and cannot equal6112, so the jump cannot fire.
  if (firstRow + 5 > m.i(0x3742) && firstRow <= m.i(0x3742)) {
    m.i(at, m.i(h + 2));
    m.i(at + 2, -(m.i(0x3742) - firstRow) * 40 + offset - m.i(0x3744) + 146);
    if (m.i(h + 2) >= 0 && m.i(h + 2) < 304) draw(at);
  }
}
