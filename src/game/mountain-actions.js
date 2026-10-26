import { s16, u8, u16 } from "./integer.js";

// Overlay5:0000's BP-relative locals, kept separately from the resident DS.
// A capture can supply these 0x52 bytes without conflating a local-state
// comparison with a complete emulator checkpoint.
export class MountainLocals {
  constructor(bytes = new Uint8Array(0x52)) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 0x52)
      throw Error("Invalid mountain stack locals");
    this.bytes = Uint8Array.from(bytes);
    this.view = new DataView(this.bytes.buffer);
  }
  i(offset, value) {
    if (value === undefined) return this.view.getInt16(0x52 + offset, true);
    this.view.setInt16(0x52 + offset, value, true);
    return this.i(offset);
  }
  b(offset, value) {
    if (value === undefined) return this.view.getUint8(0x52 + offset);
    this.view.setUint8(0x52 + offset, value);
    return this.b(offset);
  }
}

// One consumed joystick byte at original 0317. This is an action update,
// not a simulation tick: the caller owns original waits, scrolling and hazards.
export function advanceMountainAction(m, l, input, sound = () => {}) {
  if (!Number.isInteger(input) || input < 0 || input > 255)
    throw Error("Invalid mountain joystick byte");
  l.b(-0x28, 0);
  l.b(-0x1e, input);
  l.b(-0x36, (input & 0xc0) !== 0 ? 1 : 0);
  l.i(-0x50, l.i(-0x50) - 1);
  if (l.i(-0x50) > 0) return;
  l.i(-0x50, 0);
  const action = m.i(0x6882);
  const facing = m.i(0x3d12);
  const iadd = (at, n) => m.i(at, m.i(at) + n);
  const ladd = (at, n) => l.i(at, l.i(at) + n);
  const idle = () => {
    m.i(0x6d3c, facing === 0 ? 20 : 26);
    m.i(0x6882, 0);
  };
  const hookPoint = (angle, hand) => {
    const at = 0x0fca + angle * 2;
    l.i(-0x3c, m.i(0x5ae0) + m.signedByte(at) * 4 + hand);
    l.i(-0x40, m.i(0x5c72) + m.signedByte(at + 1) * 4 + 14);
  };
  switch (action) {
    case 0: {
      m.i(0x6df0, 0x5c48);
      if (l.b(-0x36)) {
        m.i(0x6d3c, facing === 0 ? 21 : 27);
        l.b(-0x2e, facing === 0 ? 0 : 8);
        l.i(-0x48, facing === 0 ? 11 : 23);
        l.i(-0x4a, 14);
        hookPoint(l.b(-0x2e), l.i(-0x48));
        m.i(0x6882, 4);
        sound(0x10);
        m.i(0x5510, 10);
        m.b(0x6ed4, 1);
        return;
      }
      m.b(0x6ed4, 0);
      if (input === 1) {
        if (m.b(0x88e4)) {
          m.i(0x6882, 10);
          sound(0x13);
          return;
        }
        const at = u16(m.i(0x57ee) + 21 * m.i(0x5c70) + m.i(0x54f6));
        if (facing === 0) {
          m.i(0x6d3c, 22);
          iadd(0x5ae0, 16);
          if (m.b(u16(at + 22)) !== 0x30) {
            m.i(0x6882, 2);
            l.i(-0x50, 1);
            m.i(0x5510, 1);
            return;
          }
        } else if (facing === 1) {
          m.i(0x6d3c, 28);
          iadd(0x5ae0, -16);
          if (m.b(u16(at + 20)) !== 0x38) {
            m.i(0x6882, 2);
            l.i(-0x50, 1);
            m.i(0x5510, 1);
            return;
          }
        } else return;
        m.i(0x6882, 3);
        sound(0x19);
        m.i(0x5510, 0);
        l.i(-0x50, 1);
      } else if (input === 5) {
        if (facing === 0) {
          if (m.i(0x6d3c) === 20) iadd(0x5ae0, 16);
          m.i(0x6d3c, 22);
        } else if (facing === 1) {
          if (m.i(0x6d3c) === 26) iadd(0x5ae0, -16);
          m.i(0x6d3c, 28);
        } else return;
        l.i(-0x50, 5);
      } else if (input === 7 || input === 3) {
        const left = input === 7;
        if ((left && facing === 0) || (!left && facing === 1)) {
          m.i(0x6d3c, left ? 26 : 20);
          m.i(0x3d12, left ? 1 : 0);
          iadd(0x5ae0, left ? 16 : -16);
          l.i(-0x50, 2);
          return;
        }
        m.i(0x6d3c, (left ? 10 : 0) + (l.b(-0x32) ? 5 : 0));
        l.b(-0x32, l.b(-0x32) ^ 1);
        iadd(0x5ae0, left ? -16 : 16);
        m.i(0x6882, 1);
        m.i(0x5510, 0);
      } else {
        if (m.i(0x6d3c) === 22) iadd(0x5ae0, -16);
        else if (m.i(0x6d3c) === 28) iadd(0x5ae0, 16);
        m.i(0x6d3c, facing === 0 ? 20 : 26);
      }
      return;
    }
    case 1:
      m.i(0x6df0, 0x5c48);
      l.i(-0x50, 0);
      iadd(0x5510, 1);
      if (m.i(0x5510) === 3) sound(0x0a);
      if (m.i(0x5510) >= 5) m.i(0x6882, 0);
      else iadd(0x6d3c, 1);
      return;
    case 2:
      if (m.i(0x5510) !== 0) {
        m.i(0x6df0, 0x5ce8);
        m.i(0x6d3c, facing === 0 ? 0 : 6);
        l.i(-0x50, 1);
        iadd(0x5c72, -8);
        m.i(0x5510, 0);
      } else {
        m.i(0x6df0, 0x5c48);
        sound(0x0a);
        m.i(0x6d3c, facing === 0 ? 20 : 26);
        iadd(0x5ae0, facing === 0 ? 16 : -16);
        iadd(0x5c72, 8);
        l.i(-0x50, 0);
        m.i(0x6882, 0);
      }
      return;
    case 3: {
      const stage = iadd(0x5510, 1);
      m.i(0x6df0, 0x5ce8);
      if (stage === 1) {
        m.i(0x6d3c, facing === 0 ? 0 : 6);
        if (facing === 0) iadd(0x5ae0, -8);
        iadd(0x5c72, -16);
      } else if (stage === 2) {
        m.i(0x6d3c, facing === 0 ? 1 : 7);
        iadd(0x5ae0, facing === 0 ? 8 : -8);
        iadd(0x5c72, -10);
        l.i(-0x50, 2);
      } else if (stage === 3 || stage === 4) {
        m.i(0x6d3c, (facing === 0 ? 0 : 6) + stage - 1);
        if (stage === 4) iadd(0x5c72, 1);
        l.i(-0x50, 2);
      } else {
        m.i(0x6df0, 0x5c48);
        if (facing !== 0) iadd(0x5ae0, 8);
        iadd(0x5c72, -15);
        idle();
        iadd(0x5c70, 1);
        l.i(-0x50, 0);
      }
      return;
    }
    case 4: {
      l.i(-0x50, 0);
      if (l.b(-0x36) === 0 && m.i(0x5510) > 0) l.b(-0x36, 1);
      if (l.b(-0x36)) {
        l.b(-0x2e, (l.b(-0x2e) + (facing === 0 ? -1 : 1)) & 15);
        hookPoint(l.b(-0x2e), facing === 0 ? 11 : 23);
        iadd(0x5510, -1);
        if (l.b(-0x2e) === 4) sound(0x10);
        else if (l.b(-0x2e) === 12) sound(0x1d);
      } else {
        const angle = facing === 0 ? 15 - l.b(-0x2e) : l.b(-0x2e);
        l.i(-0x4e, -m.signedByte(0x0fcb + angle * 2));
        l.i(-6, m.signedByte(0x0fca + angle * 2) * (facing === 0 ? -1 : 1));
        l.b(-0x2e, (l.b(-0x2e) + (facing === 0 ? -2 : 2)) & 15);
        ladd(-0x3c, l.i(-0x4e));
        ladd(-0x40, l.i(-6));
        m.i(0x5510, (4 >> m.b(0x8990)) + 8);
        m.i(0x6882, 5);
        sound(0x0c);
      }
      return;
    }
    case 5: {
      if (m.i(0x5510) <= 0) {
        sound(0x16);
        m.b(0x6ed4, 0);
        idle();
        return;
      }
      iadd(0x5510, -1);
      // Original AND byte [BP-3c],f8 preserves the high byte.
      l.i(-0x3c, u16(l.i(-0x3c) + l.i(-0x4e)) & 0xfff8);
      ladd(-0x40, l.i(-6));
      let y = l.i(-0x40),
        x = l.i(-0x3c);
      if (y > 0 && (s16(y + 8) % 40 >= 16 || y >= s16(m.i(0x5c72) + 16)))
        return;
      y = l.i(-0x40, Math.max(0, y));
      x = l.i(-0x3c, Math.max(0, Math.min(320, x)));
      const row = u8(Math.trunc(s16(152 - y) / 40) + l.b(-0x34) + 1);
      l.b(-2, row);
      if (row >= 25) return;
      const cell = m.b(u16(m.i(0x57ee) + row * 21 + (x >> 4)));
      l.b(-0x20, cell);
      if (cell === 0x30 || cell === 0x38) {
        const toRight = x > s16(m.i(0x5ae0) + 12);
        const distance = toRight
          ? s16(x - m.i(0x5ae0) - 12)
          : s16(m.i(0x5ae0) - x + 12);
        l.i(-0x30, Math.min(128, s16((distance >> 1) + m.i(0x5c72) + 16)));
        l.i(-0x3a, (distance >> 2) - 8);
        l.i(-4, 0);
        l.b(-0x26, toRight ? 1 : 0);
        iadd(0x5ae0, toRight ? 24 : -24);
        m.i(0x6d3c, cell === 0x30 ? 24 : 30);
        m.i(0x3d12, cell === 0x30 ? 0 : 1);
        l.i(-0x48, cell === 0x30 ? 21 : 11);
        l.i(-0x3c, (u16(x) & 0xfff0) + (cell === 0x30 ? 5 : 11));
        l.i(-0x2a, l.i(-0x3c) - l.i(-0x48));
        l.i(-0x40, -(row - l.b(-0x34)) * 40 + 160);
        l.i(-0x4a, 0);
        sound(0x11);
        m.i(0x6882, 6);
      } else if (cell >= 1 && cell <= 7) {
        l.i(-6, l.i(-6) > 0 ? -4 : 4);
        ladd(-0x40, l.i(-6) < 0 ? -16 : 16);
      }
      return;
    }
    case 6: {
      const target = l.i(-0x2a),
        x = m.i(0x5ae0),
        direction = l.b(-0x26);
      iadd(0x5ae0, direction === 1 ? 8 : -8);
      iadd(
        0x5c72,
        (target > x && direction !== 1) || (target <= x && direction === 1)
          ? -2
          : 2,
      );
      if (m.i(0x5c72) > 128) m.i(0x5c72, 128);
      if (m.i(0x5ae0) < 0) {
        m.i(0x5ae0, 0);
        ladd(-0x3a, -1);
      } else if (m.i(0x5c72) > 280) {
        // Original0b10 compares Y, then writes X. Preserve that quirk.
        m.i(0x5ae0, 280);
        ladd(-0x3a, -1);
      }
      ladd(-4, 1);
      if (l.i(-4) >= l.i(-0x3a)) {
        ladd(-0x3a, -8);
        l.i(-4, 0);
        l.b(-0x26, direction ^ 1);
        sound(l.b(-0x26) ? 0x5a : 0x5d);
      }
      if (l.i(-0x3a) <= 0) {
        m.i(0x5ae0, target);
        m.i(0x6882, 7);
        sound(0);
        m.i(0x5510, 0);
        l.i(-0x50, 1);
      }
      return;
    }
    case 7:
      if (l.i(-0x40) <= s16(m.i(0x5c72) - 16)) {
        sound(0x1a);
        m.i(0x6df0, 0x5c48);
        const frame = m.i(0x6d3c);
        if ([24, 30].includes(frame)) {
          iadd(0x5c72, -9);
          m.i(0x6d3c, frame + 1);
          l.i(-0x50, 2);
        } else if ([25, 31].includes(frame)) {
          iadd(0x5c72, -6);
          m.i(0x6d3c, frame - 1);
          l.i(-0x50, 3);
        }
      } else {
        m.i(0x6df0, 0x5ce8);
        const stage = m.i(0x5510);
        if (stage === 0) {
          m.b(0x6ed4, 0);
          m.i(0x5c72, l.i(-0x40) - 16);
          m.i(0x6d3c, facing === 0 ? 1 : 7);
          l.i(-0x50, 3);
        } else if (stage === 1 || stage === 2) {
          if (stage === 2) sound(0x77);
          m.i(0x6d3c, (facing === 0 ? 1 : 7) + stage);
          l.i(-0x50, 3);
        } else {
          m.i(0x5ae0, u16(l.i(-0x3c)) & 0xfff0);
          // The facing adjustment at0bae is overwritten at0bb9.
          m.i(0x5c72, l.i(-0x40) - 29);
          m.i(0x6df0, 0x5c48);
          idle();
          l.i(-0x50, 0);
        }
        iadd(0x5510, 1);
      }
      return;
    case 8: {
      if (m.i(0x5c72) > 128) {
        m.b(0x4d34, m.b(0x4d34) - 1);
        l.b(-0x28, 1);
        return;
      }
      m.i(0x6df0, 0x5ce8);
      const cell = m.b(u16(m.i(0x57ee) + 21 * m.i(0x5c70) + m.i(0x54f6)));
      const landing = cell !== 0x46 && m.i(0x5c72) % 40 < 16;
      m.i(0x6d3c, (facing === 0 ? 0 : 6) + (landing ? 5 : 4));
      l.i(-0x50, landing ? 0 : 1);
      iadd(0x5c72, 8);
      m.b(0x6ed4, 0);
      return;
    }
    case 9: {
      m.i(0x6df0, 0x5ce8);
      const cell = m.b(u16(m.i(0x57ee) + 21 * m.i(0x5c70) + m.i(0x54f6)));
      if (
        m.i(0x5c72) > 120 ||
        (cell !== 0x46 && m.i(0x5c72) % 40 > 16 && m.i(0x5510) > 10)
      ) {
        m.i(0x6df0, 0x5c48);
        m.i(
          0x5c72,
          m.i(0x5c72) > 120 ? 131 : -(m.i(0x5c70) - l.b(-0x34)) * 40 + 131,
        );
        idle();
        sound(0x77);
        l.i(-0x50, 0);
      } else {
        iadd(0x5c72, 8);
        m.i(0x6d3c, 10);
        iadd(0x5510, 1);
      }
      m.b(0x6ed4, 0);
      return;
    }
    case 10:
      if (u16(m.i(0x5c70)) < m.b(0x54f0)) iadd(0x5c72, -40);
      else if (u16(m.i(0x5c70)) > m.b(0x54f0)) iadd(0x5c72, 40);
      else {
        m.i(0x5ae0, m.i(0x5c46));
        idle();
        sound(0x14);
        m.i(0x6df0, 0x5c48);
      }
      m.b(0x6ed4, 0);
      return;
    default:
      // The original switch ignores values above10. No substitution is used.
      if (u16(action) <= 10)
        throw Error(`Untranslated mountain action ${action}`);
  }
}

// Original0e60..0f85, before camera movement and hazard presentation.
export function updateMountainPosition(m, l, sound = () => {}) {
  m.i(0x5ae0, Math.max(0, Math.min(288, m.i(0x5ae0))));
  m.i(0x5c70, Math.trunc(s16(144 - m.i(0x5c72)) / 40) + l.b(-0x34));
  let column = s16((m.i(0x5ae0) >> 4) - m.i(0x3d12) + 1);
  if (m.i(0x6d3c) === 22) column = s16(column - 1);
  else if (m.i(0x6d3c) === 28) column = s16(column + 1);
  m.i(0x54f6, column);
  if (
    l.i(-0x22) === column &&
    l.i(-0x4c) === m.i(0x5c70) &&
    [20, 26].includes(m.i(0x6d3c))
  )
    m.b(0x1615, m.b(0x1615) + 1);
  else {
    l.i(-0x22, column);
    l.i(-0x4c, m.i(0x5c70));
    m.b(0x1615, 0);
  }
  if (m.i(0x6882) !== 0) return;
  let at = u16(m.i(0x57ee) + 21 * m.i(0x5c70) + column);
  if (m.b(at) !== 0x46 || m.i(0x5c70) === 0) return;
  if (m.b(u16(at - 21)) !== 0x46) {
    m.i(0x5c70, m.i(0x5c70) - 1);
    m.i(0x5c72, -(m.i(0x5c70) - l.b(-0x34)) * 40 + 131);
    m.i(0x6df0, 0x5c48);
    const right = m.i(0x3d12) === 0;
    m.i(0x6d3c, right ? 22 : 28);
    m.i(0x5ae0, m.i(0x5ae0) + (right ? 16 : -16));
    l.i(-0x50, 2);
  } else {
    m.i(0x6882, 8);
    sound(0x0f);
    m.i(0x5c72, m.i(0x5c72) + 8);
    m.i(0x5510, 0);
  }
}
