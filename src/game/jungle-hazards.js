import { s16, u16, nextRandom } from "./integer.js";
import {
  advanceJungleObjectFrame,
  initializeJungleObjectAnimation,
  selectJungleActorAnimation,
} from "./jungle-animation.js";
import {
  jungleActorCenter,
  jungleFeetRow,
  junglePlatformAt,
  markJungleDirty,
  flagJunglePlatformDirty,
  flagJungleMovingPlatformDirty,
  flagJungleMonkeyDirty,
  flagJungleBirdDirty,
  flagJungleSnakeDirty,
  flagJungleFishDirty,
} from "./jungle-collision.js";

const word = (m, at) => m.i(at & 65535);
const add = (m, at, value) => m.i(at, m.i(at) + value);
const random = (m) => {
  const value = nextRandom(m.i(0x2229));
  m.i(0x2229, value);
  return value;
};
const sound = (m, effects, id) => {
  if (m.b(0x3be)) effects.sound?.(id);
};
const complete = (m, at) => s16(m.i(at + 10) - 1) <= m.i(at + 6);
const actor = (m, action, effects) => {
  m.i(0x6882, action);
  selectJungleActorAnimation(m, action, effects);
};
const inside = (x, y, left, top, right, bottom) =>
  s16(left) <= s16(x) &&
  s16(x) <= s16(right) &&
  s16(top) <= s16(y) &&
  s16(y) <= s16(bottom);
const overlap = (left, top, right, bottom, left2, top2, right2, bottom2) =>
  !(
    s16(right2) < s16(left) ||
    s16(right) < s16(left2) ||
    s16(bottom2) < s16(top) ||
    s16(bottom) < s16(top2)
  );
const distance = (x, y, x2, y2) =>
  (Math.imul(s16(x - x2), s16(x - x2)) + Math.imul(s16(y - y2), s16(y - y2))) |
  0;
const dividedPower = (value, bits) => {
  value = s16(value);
  const sign = value >> 15;
  return s16(((s16((value ^ sign) - sign) >> bits) ^ sign) - sign);
};

// Resident040e:14d7/151a. XLAT replaces AL, preserving AH. Retain the
// original word operations and lookup table, including out-of-range quirks.
export function jungleTrig(m, value, sine = false) {
  let ax = u16(value),
    negative = false;
  const low = () => ax & 255;
  const setLow = (v) => {
    ax = (ax & 0xff00) | (v & 255);
  };
  if (sine) {
    if (low() > 192) {
      ax = u16(-ax);
      ax = u16(ax + 256);
      negative = true;
    } else if (low() > 128) {
      setLow(low() - 128);
      negative = true;
    } else if (low() > 64) ax = u16(-ax + 128);
  } else {
    if (low() > 192) setLow(low() - 192);
    else if (low() > 128) {
      ax = u16(-ax + 192);
      negative = true;
    } else if (low() > 64) {
      setLow(low() - 64);
      negative = true;
    } else ax = u16(-ax + 64);
  }
  if (low() === 64) ax = 256;
  else setLow(m.b(0x269a + low()));
  return s16(negative ? -ax : ax);
}

// Main0591. Camera movement is independent of drawing and wall time.
export function advanceJungleCamera(m) {
  const scroll = m.i(0x5ed2),
    x = m.i(0x5f46);
  if (m.i(0x8e0e) === 0) {
    let direction;
    if (x >= s16(scroll + 240) && scroll <= 855) direction = 1;
    else if (
      x < s16(scroll + 72) &&
      ![8, 6].includes(m.i(0x6882)) &&
      scroll > 0
    )
      direction = 0;
    if (direction !== undefined) {
      m.i(0x8e0e, 1);
      m.i(0x7960, word(m, 0x1aac + Math.trunc(x / 104) * 2));
      m.i(0x5ed8, direction);
    }
  } else {
    const target = m.i(0x7960),
      right = m.i(0x5ed8) === 1;
    add(m, 0x5ed2, right ? 8 : -8);
    if ((right && m.i(0x5ed2) < target) || (!right && target < m.i(0x5ed2)))
      return;
    m.i(0x5ed2, target);
    m.i(0x8e0e, 0);
    m.i(0x6d84, 1);
  }
}

export function jungleProjectilePosition(m, id) {
  const at = id * 62;
  return word(m, at + 0x58f8) !== 0
    ? { x: word(m, at + 0x58fc), y: word(m, at + 0x58fe) }
    : null;
}

// 1090:01fe: redraw platforms under a world rectangle, including the
// original kind10 widening and truncating signed column division.
function flagPlatformsUnder(m, x, y, width, height, kind) {
  let right = s16(x + width),
    bottom = s16(y + height - (kind === 10 ? 16 : 48));
  if (kind === 10) {
    x = s16(x - 24);
    right = s16(right + 24);
  }
  const leftColumn = Math.max(0, Math.trunc(x / 53)),
    rightColumn = Math.trunc(right / 53),
    topRow = Math.max(0, s16(y - 48) >> 5),
    bottomRow = bottom >> 5;
  for (let col = leftColumn; col <= rightColumn; col++)
    for (let row = topRow; row <= bottomRow; row++) {
      const id = junglePlatformAt(m, col, row);
      if (id) flagJunglePlatformDirty(m, id, kind);
    }
}

export function advanceJunglePlatform(m, id, effects = {}) {
  const at = 0x6040 + id * 50,
    old = m.i(at + 46);
  let action = old,
    changed = false;
  if (action === 1) {
    if (m.i(at + 2) === jungleFeetRow(m) && m.i(at) === m.i(0x544c)) {
      m.i(0x8924, 1);
      m.i(0x882a, id);
      action = 3;
      changed = true;
    }
  } else if (action === 3) {
    changed = true;
    if ((m.i(at) === m.i(0x544c) || m.i(0x6882) === 18) && m.i(0x8d64) === 0)
      advanceJungleObjectFrame(m, 24, at + 18, effects.sound);
    else {
      action = 1;
      for (const field of [0x8924, 0x882a, 0x3a44, 0x3a46]) m.i(field, 0);
    }
  }
  if (old !== action) {
    m.i(at + 46, action);
    initializeJungleObjectAnimation(
      m,
      24,
      at + 18,
      action,
      m.i(at + 42),
      m.i(at + 44),
      effects,
    );
  }
  if (m.i(0x78e8) === 0 && !changed) {
    const p =
      m.i(0x5ada) !== 0 ? jungleProjectilePosition(m, m.i(0x5ada)) : null;
    if (
      !p ||
      !inside(
        p.x,
        p.y,
        m.i(at + 42),
        m.i(at + 44) - 6,
        m.i(at + 42) + 64,
        m.i(at + 44) + 32,
      )
    )
      return;
  }
  flagJungleMovingPlatformDirty(m, id, m.i(0x78e8) === 0 ? 3 : 0);
}

export function advanceJungleBird(m, id, effects = {}) {
  const at = 0x397e + id * 38;
  let changed = false,
    initialize = false;
  if (m.i(0x78e8) === 0 || m.b(0x2042) !== 0) add(m, 0x3a3c, -1);
  else m.i(0x3a3c, m.i(0x397c));
  const choose = (action) => {
    m.i(at + 20, action);
    changed = true;
    initialize = true;
  };
  switch (m.i(at + 20)) {
    case 14:
      if (m.i(0x3a3c) === 0) choose(18);
      break;
    case 18:
      if (
        m.i(at + 28) === m.i(0x544c) &&
        m.i(at + 30) === jungleFeetRow(m) &&
        [5, 1, 12].includes(m.i(0x6882))
      )
        actor(m, 14, effects);
      if (m.i(0x3a3c) === 0) {
        if (random(m) % 100 < u16(m.i(0x3a3e))) {
          choose(14);
          m.i(0x3a3c, m.i(0x397c) * 3);
        } else if (
          random(m) % 100 < u16(m.i(0x3a40)) &&
          inside(
            jungleActorCenter(m),
            m.i(0x6858) + 16,
            m.i(at + 24) + 6,
            m.i(at + 26) + 12,
            m.i(at + 24) + 58,
            m.i(at + 26) + 64,
          ) &&
          m.i(0x6882) !== 8
        ) {
          choose(19);
          sound(m, effects, 99);
        }
      }
      break;
    case 19:
      if (
        m.i(0x6882) !== 10 &&
        inside(
          jungleActorCenter(m),
          m.i(0x6858) + 16,
          m.i(at + 24),
          m.i(at + 26),
          m.i(at + 24) + 64,
          m.i(at + 26) + 48,
        )
      ) {
        add(m, 0x6858, -24);
        if (m.i(0x8d64)) m.i(0x8d64, 0);
        actor(m, 2, effects);
      }
      if (complete(m, at)) choose(18);
      else {
        changed = true;
        advanceJungleObjectFrame(m, 11, at, effects.sound);
      }
      break;
  }
  if (m.i(0x78e8) !== 0) flagJungleBirdDirty(m, id, 0);
  else if (
    changed ||
    distance(
      m.i(at + 24) + 32,
      m.i(at + 26) + 24,
      jungleActorCenter(m),
      m.i(0x6858) + 16,
    ) < 10000
  )
    flagJungleBirdDirty(m, id, 5);
  else {
    const section = Math.trunc(m.i(at + 24) / 104) * 14;
    if (word(m, 0x6a2a + section) !== 0 || word(m, 0x6a1c + section) !== 0)
      add(m, at + 12, 1);
  }
  if (initialize)
    initializeJungleObjectAnimation(
      m,
      11,
      at,
      m.i(at + 20),
      m.i(at + 24),
      m.i(at + 26),
      effects,
    );
  if (m.i(0x3a3c) < 1) m.i(0x3a3c, m.i(0x397c));
}

export function advanceJungleVine(m, id, effects = {}) {
  const at = 0x5d40 + id * 34;
  add(m, at + 22, m.i(at + 28));
  let turnSound;
  if (m.i(at + 26) < m.i(at + 22)) {
    m.i(at + 28, -m.i(at + 28));
    turnSound = 0x5a;
  } else if (m.i(at + 22) < m.i(at + 24)) {
    m.i(at + 28, -m.i(at + 28));
    turnSound = 0x5d;
  }
  if (turnSound !== undefined && m.i(0x6882) === 8 && m.i(0x7166) === id)
    sound(m, effects, turnSound);
  const angle = s16(m.i(at + 22) - 128);
  m.i(
    at + 18,
    dividedPower(s16(m.i(at + 16) * jungleTrig(m, angle)), 8) + m.i(at + 12),
  );
  m.i(
    at + 20,
    dividedPower(s16(m.i(at + 16) * jungleTrig(m, angle, true)), 8) +
      m.i(at + 14),
  );
  let width;
  if (m.i(at + 6) < m.i(at + 12)) width = s16(m.i(at + 12) - m.i(at + 6));
  else {
    width = s16(m.i(at + 6) - m.i(at + 12));
    m.i(at + 6, m.i(at + 12));
  }
  markJungleDirty(
    m,
    m.i(at + 6),
    m.i(at + 14),
    s16(width + 16),
    s16(m.i(at + 10) - m.i(at + 14) + 1),
    id + 28,
  );
  for (const offset of [0, 2])
    if (m.i(at + offset)) flagJunglePlatformDirty(m, m.i(at + offset), 4);
}

export function advanceJungleSnake(m, id, effects = {}) {
  const at = 0x7034 + id * 38;
  add(m, at + 36, -1);
  if (m.i(at + 30) === 45) {
    m.i(0x78e8, 3);
    if (!complete(m, at + 10)) {
      flagJungleSnakeDirty(m, id, 8);
      advanceJungleObjectFrame(m, 8, at + 10, effects.sound);
    } else {
      m.i(at + 30, 20);
      flagJungleSnakeDirty(m, id, 8);
      initializeJungleObjectAnimation(
        m,
        8,
        at + 10,
        20,
        m.i(at + 32),
        m.i(at + 34),
        effects,
      );
      actor(m, 2, effects);
    }
  }
  if (m.i(0x78e8)) flagJungleSnakeDirty(m, id, 8);
  if (m.i(at + 36) < 1) m.i(at + 36, 20);
}
export function collideJungleSnake(m, id, effects = {}) {
  const at = 0x7034 + id * 38;
  let x = jungleActorCenter(m),
    y = s16(m.i(0x6858) + 16);
  if (m.i(0x6882) === 19) y = s16(m.i(0x6858) + 24);
  else if (m.i(0x6882) === 18) x = s16(x - 16);
  if (m.i(at + 30) === 45 || [2, 6, 7].includes(m.i(0x6882))) return false;
  if (
    inside(
      x,
      y,
      m.i(at + 32) + 16,
      m.i(at + 34),
      m.i(at + 32) + 48,
      m.i(at + 34) + 56,
    )
  ) {
    if (m.i(0x8d64)) {
      m.i(0x8d64, 0);
      m.i(0x7158, 0);
    }
    actor(m, 45, effects);
    m.i(at + 30, 45);
    initializeJungleObjectAnimation(
      m,
      8,
      at + 10,
      45,
      m.i(at + 32),
      m.i(at + 34),
      effects,
    );
    sound(m, effects, 0x62);
    m.i(0x78e8, 3);
    return true;
  }
  if (
    m.i(at) === m.i(0x544c) &&
    m.i(at + 2) === jungleFeetRow(m) &&
    [12, 1, 5].includes(m.i(0x6882))
  )
    actor(m, 14, effects);
  return false;
}

export function collideJungleTransport(m, id) {
  const at = 0x776e + id * 10,
    column = m.i(0x544c);
  if (s16(m.i(at) - 2) <= column && column <= s16(m.i(at) + 1)) {
    m.i(at + 8, 2);
    if (
      inside(
        jungleActorCenter(m),
        m.i(0x6858) + 16,
        m.i(at + 4),
        m.i(at + 6),
        m.i(at + 4) + 48,
        m.i(at + 6) + 30,
      )
    )
      m.i(0x1aac, 1);
  }
}

export function advanceJungleFish(m) {
  if (m.i(0x8e0e) === 0) {
    if (m.i(0x5b3e) < 1) m.i(0x5b3e, 2);
  } else m.i(0x5b3e, 3);
  add(m, 0x5b3e, -1);
  const count = m.i(0x882c);
  if (count < 1 || count > 16) throw Error("Unsupported jungle fish count");
  const bucket = s16(dividedPower(m.i(0x5ed2), 7) + m.i(0x778c)) % count;
  for (let i = 0; i < 5; i++) {
    const id = s16(bucket + i) % count,
      at = 0x514a + id * 32;
    if (m.i(0x5b3e) === 0) {
      if (m.i(at + 4) === 0 || s16(m.i(at + 20) + m.i(at + 8)) < 1169) {
        if (m.i(at + 4) === 1 && (random(m) & 15) < u16(m.i(at + 18))) {
          if (m.i(at + 16) === 2) {
            if (m.i(at + 12) < 1 && (random(m) & 15) < u16(m.i(0x8c82)))
              m.i(at + 16, 3);
            else if (m.i(at + 12) > 0) add(m, at + 12, -1);
          } else if (m.i(at + 16) === 3) {
            if (
              m.i(at + 12) < m.i(at + 14) ||
              (random(m) & 15) >= u16(m.i(0x8c82))
            ) {
              if (m.i(at + 12) < m.i(at + 14)) add(m, at + 12, 1);
            } else m.i(at + 16, 2);
          }
        }
      } else if (m.i(at + 12) < m.i(at + 14)) add(m, at + 12, 1);
      flagJungleFishDirty(m, id, 6);
    }
    if (s16(m.i(0x6858) + 16) >> 5 >= 3) flagJungleFishDirty(m, id, 10);
    else if (m.i(0x78e8)) flagJungleFishDirty(m, id, 6);
  }
  if (m.i(0x5b3e) === 0) {
    add(m, 0x6950, 4);
    if (m.i(0x6950) > 127) {
      m.i(0x6950, 0);
      add(m, 0x778c, -1);
      if (m.i(0x778c) < 0) m.i(0x778c, count - 1);
    }
  }
}

function submergeFish(m, id) {
  m.i(0x5156 + id * 32, word(m, 0x5158 + id * 32));
  flagJungleFishDirty(m, id, 6);
}

function flagBonus(m) {
  m.i(0x71e0, 2);
  markJungleDirty(m, m.i(0x71f0), m.i(0x71f2), 40, 32, 33);
  const x = Math.max(0, m.i(0x71f0));
  for (
    let section = Math.trunc(x / 104);
    section <= Math.trunc(s16(x + 40) / 104);
    section++
  ) {
    const at = 0x6a26 + section * 14;
    if (word(m, at)) flagJungleMovingPlatformDirty(m, word(m, at), 12);
    if (word(m, at + 2)) flagJungleBirdDirty(m, word(m, at + 2), 12);
    if (word(m, at + 10)) flagJungleMonkeyDirty(m, word(m, at + 10), 12);
    if (word(m, at + 8)) flagJungleSnakeDirty(m, word(m, at + 8), 12);
    if (word(m, at + 12)) m.i(0x7776 + word(m, at + 12) * 10, 2);
  }
}
export function advanceJungleBonus(m, effects = {}) {
  if (m.i(0x71f4) === 0) {
    if (m.i(0x88ac) <= m.i(0x54fa)) return;
    m.i(0x71f4, 1);
    m.i(0x71e8, m.i(0x5ed2) + 318);
    m.i(0x71ea, m.i(0x6858) + 12);
    for (const at of [0x71ec, 0x71f0]) m.i(at, m.i(0x71e8));
    for (const at of [0x71ee, 0x71f2]) m.i(at, m.i(0x71ea));
    flagBonus(m);
    initializeJungleObjectAnimation(
      m,
      33,
      0x71d4,
      1,
      m.i(0x71e8),
      m.i(0x71ea),
      effects,
    );
    return;
  }
  if (m.i(0x71f4) !== 1) return;
  let x = jungleActorCenter(m),
    y = s16(m.i(0x6858) + 16);
  if (m.i(0x6882) === 6) {
    x = s16(x + 16);
    y = s16(m.i(0x6858) + 24);
  } else if (m.i(0x6882) === 19) y = s16(m.i(0x6858) + 24);
  if (
    overlap(
      x - 4,
      y - 6,
      x + 4,
      y + 6,
      m.i(0x71e8) + 8,
      m.i(0x71ea) + 8,
      m.i(0x71e8) + 18,
      m.i(0x71ea) + 20,
    ) &&
    ![2, 45].includes(m.i(0x6882))
  ) {
    if (m.i(0x8d64)) {
      submergeFish(m, m.i(0x7158));
      m.i(0x8d64, 0);
    }
    actor(m, 2, effects);
  }
  if (s16(m.i(0x71e8) + 32) < m.i(0x5ed2)) {
    m.i(0x71f4, 0);
    m.i(0x88ac, 0);
  } else {
    add(m, 0x71e8, -4);
    advanceJungleObjectFrame(m, 33, 0x71d4, effects.sound);
  }
  flagBonus(m);
}

// e7a:0402's eight-entry dispatch is translated from raw disassembly. The
// decompiler follows overlapping flow here and is not used as source code.
export function advanceJungleMonkey(m, id, effects = {}) {
  const at = 0x58cc + id * 62,
    done = complete(m, at + 2);
  let initialize = false;
  add(m, at + 60, -1);
  const choose = (action) => {
    m.i(at + 42, action);
    initialize = true;
  };
  const advance = () => advanceJungleObjectFrame(m, 2, at + 2, effects.sound);
  const projectile = (x, y, kind) => {
    m.i(0x5ada, id);
    m.i(at + 44, 1);
    m.i(at + 46, kind);
    for (const offset of [48, 52, 54]) m.i(at + offset, x);
    for (const offset of [50, 56, 58]) m.i(at + offset, y);
  };
  switch (m.i(at + 42)) {
    case 14:
      if (m.i(at + 60) !== 0) break;
      if (m.i(at + 28) > m.i(0x5f46) && m.i(at) !== 0 && random(m) % 100 < 75)
        choose(12);
      else if (
        s16(jungleActorCenter(m) - 32) < m.i(at + 28) &&
        random(m) % 100 < 75
      ) {
        choose(16);
        m.i(at + 30, 8);
        m.i(0x374a, s16(m.i(0x5f46) - m.i(at + 28) + 12) % 64);
        m.i(at + 28, m.i(at + 32) + m.i(0x374a));
      }
      break;
    case 16:
      if (s16(jungleActorCenter(m) - 64) > m.i(at + 28)) {
        choose(14);
        m.i(at + 28, m.i(at + 32));
      } else if (m.i(at + 44) === 0 && random(m) % 100 < u16(m.i(0x1b10))) {
        choose(17);
        projectile(s16(m.i(at + 28) + 8), s16(m.i(at + 30) + 28), 3);
      }
      break;
    case 17:
      if (m.i(at + 60) !== 0) break;
      if (done) choose(14);
      else {
        if (m.i(at + 8) === 2) sound(m, effects, 0x60);
        advance();
      }
      break;
    case 12:
      if (m.i(at + 60) !== 0) break;
      if (!done) advance();
      else {
        add(m, at + 30, 12);
        choose(
          m.i(at + 30) > 80 || s16(m.i(at + 30) + 28) >= s16(m.i(0x6858) + 32)
            ? 13
            : 12,
        );
      }
      break;
    case 11:
      if (m.i(at + 60) !== 0) break;
      if (!done) advance();
      else {
        add(m, at + 30, -12);
        choose(
          m.i(at + 30) < 16
            ? 14
            : s16(m.i(at + 30) + 32) <= s16(m.i(0x6858) + 32) &&
                m.i(at + 28) >= m.i(0x5f46)
              ? 13
              : 11,
        );
      }
      break;
    case 13:
      if (m.i(at + 60) > 0) break;
      if (random(m) % 100 < u16(m.i(0x1b0c))) {
        if (m.i(at + 44) === 0 && jungleActorCenter(m) <= m.i(at + 28)) {
          choose(15);
          m.i(0x1b32, 1);
          m.i(0x9242, 0);
          projectile(s16(m.i(at + 28) + 44), s16(m.i(at + 30) + 22), 0);
        }
      } else if (random(m) % 100 < u16(m.i(0x1b0e))) {
        const x = jungleActorCenter(m);
        if (
          (s16(m.i(at + 28) - 32) <= x && x <= s16(m.i(at + 28) + 32)) ||
          m.i(at + 28) < m.i(0x5f46)
        )
          choose(11);
        else if (s16(m.i(at + 30) + 20) < m.i(0x6858) && m.i(at + 30) < 80)
          choose(12);
        else if (s16(m.i(at + 30) + 20) > s16(m.i(0x6858) + 32)) choose(11);
      }
      break;
    case 15:
      if (done) choose(13);
      else {
        if (m.i(at + 8) === 1 && m.i(0x1b32) !== 0) {
          sound(m, effects, 0x60);
          m.i(0x1b32, 0);
        }
        advance();
      }
      break;
    case 18:
      if (done) choose(13);
      else advance();
      break;
  }
  // The original sets its dirty local to1 unconditionally before dispatch.
  flagJungleMonkeyDirty(m, id, 7);
  if (initialize)
    initializeJungleObjectAnimation(
      m,
      2,
      at + 2,
      m.i(at + 42),
      m.i(at + 28),
      m.i(at + 30),
      effects,
    );
  if (m.i(at + 60) <= 0) m.i(at + 60, m.i(0x3748));
}

export function advanceJungleProjectile(m, id, effects = {}) {
  const at = 0x58cc + id * 62;
  if (m.i(at + 44) !== 1) return;
  const choose = (action) => {
    m.i(at + 42, action);
    m.i(at + 44, 0);
    initializeJungleObjectAnimation(
      m,
      2,
      at + 2,
      action,
      m.i(at + 28),
      m.i(at + 30),
      effects,
    );
  };
  if (m.i(at + 8) === 0 || m.i(at + 46) !== 0) {
    if (m.i(at + 46) === 3 && m.i(at + 8) >= 3) {
      add(m, at + 50, 8);
      if (m.i(at + 50) >= 169) choose(16);
    }
  } else if (s16(m.i(0x5ed2) - 16) < m.i(at + 48)) {
    if (m.i(at + 48) < s16(m.i(0x5ed2) + 320)) {
      if (m.i(0x9242) === 0) {
        m.i(0x9242, 1);
        add(m, at + 48, -32);
      } else add(m, at + 48, -8);
    } else m.i(at + 44, 0);
  } else {
    choose(13);
    m.i(0x5ada, 0);
  }
  markJungleDirty(m, m.i(at + 54), m.i(at + 58), 24, 16, id + 12);
  flagPlatformsUnder(m, m.i(at + 54), m.i(at + 58), 24, 16, 11);
  const bird = word(m, 0x6a28 + Math.trunc(m.i(at + 54) / 104) * 14);
  if (bird) flagJungleBirdDirty(m, bird, 11);
}

// e7a:0912 then09c0 are separate presentation boundaries. draw must snapshot
// this descriptor now, before the later collision clears the active flag.
export function presentJungleProjectile(m, id, draw) {
  const at = 0x58cc + id * 62;
  if (m.i(at + 44) === 0) return;
  const resource = m.view.getUint16(0x8cc4, true);
  m.i(resource, m.i(at + 48) - m.i(0x5ed2));
  m.i(resource + 2, m.i(at + 50));
  m.b(resource + 18, 0);
  if (m.i(resource) > 0 && m.i(resource + 2) < 154) {
    if (typeof draw !== "function")
      throw Error("Missing jungle projectile presentation sink");
    draw(resource);
  }
  m.i(at + 54, m.i(at + 52));
  m.i(at + 58, m.i(at + 56));
  m.i(at + 52, m.i(resource) + m.i(0x5ed2));
  m.i(at + 56, m.i(resource + 2));
}
export function collideJungleProjectile(m, id, effects = {}) {
  const at = 0x58cc + id * 62,
    center = jungleActorCenter(m),
    y = m.i(0x6858);
  if (
    m.i(at + 44) === 0 ||
    !overlap(
      center - 4,
      y + 10,
      center + 4,
      y + 22,
      m.i(at + 48) + 4,
      m.i(at + 50) + 2,
      m.i(at + 48) + 8,
      m.i(at + 50) + 12,
    )
  )
    return false;
  if (m.i(at + 46) === 0) {
    m.i(at + 42, 18);
    initializeJungleObjectAnimation(
      m,
      2,
      at + 2,
      18,
      m.i(at + 28),
      m.i(at + 30),
      effects,
    );
  } else if (m.i(0x8d64)) {
    submergeFish(m, m.i(0x7158));
    m.i(0x8d64, 0);
  }
  actor(m, 2, effects);
  m.i(at + 44, 0);
  markJungleDirty(m, m.i(at + 54), m.i(at + 58), 24, 16, id + 12);
  return true;
}

// Main0251..0323. Rider and actor motion follow this pass in the caller.
export function advanceJungleHazards(m, effects = {}) {
  const first = Math.trunc(m.i(0x5ed2) / 104),
    end = first + (m.i(0x8e0e) === 0 ? 3 : 4);
  for (let section = first; section < end; section++) {
    const at = 0x6a26 + section * 14;
    if (word(m, at)) advanceJunglePlatform(m, word(m, at), effects);
    if (word(m, at + 2)) advanceJungleBird(m, word(m, at + 2), effects);
    if (word(m, at + 4)) {
      advanceJungleVine(m, word(m, at + 4), effects);
      if (word(m, at + 6)) advanceJungleVine(m, word(m, at + 6), effects);
    }
    if (word(m, at + 10)) advanceJungleMonkey(m, word(m, at + 10), effects);
    if (word(m, at + 10)) advanceJungleProjectile(m, word(m, at + 10), effects);
    if (word(m, at + 8)) {
      advanceJungleSnake(m, word(m, at + 8), effects);
      collideJungleSnake(m, word(m, at + 8), effects);
    }
    if (word(m, at + 12)) collideJungleTransport(m, word(m, at + 12));
  }
  advanceJungleFish(m);
  advanceJungleBonus(m, effects);
}
