import { s16 } from "./integer.js";
import { rememberJungleActor } from "./jungle-animation.js";
import {
  flagJunglePlatformDirty,
  flagJungleFishDirty,
} from "./jungle-collision.js";
import {
  jungleProjectilePosition,
  presentJungleProjectile,
  collideJungleProjectile,
} from "./jungle-hazards.js";

const pointer = (m, at) => m.view.getUint16(at & 65535, true);

// Original f97:02f6. Draw immediately: later objects may reuse this descriptor.
export function presentJungleObject(m, at, draw) {
  if (m.i(at + 12) <= 0) return;
  const list = pointer(m, at + 16),
    resource = pointer(m, list);
  m.i(resource, m.i(at) + m.i(list + 10) - m.i(0x5ed2));
  m.i(resource + 2, m.i(at + 2) + m.i(list + 12));
  m.b(resource + 18, m.b(list + 2));
  draw(resource);
  m.i(at + 12, m.i(at + 12) - 1);
  if (m.i(at + 12) === 0) m.i(at + 14, 0);
}

// Original1090:000c. Static platform redraws precede the separate pickup pass.
export function presentJungleTerrain(m, draw) {
  if (m.i(0x3a48) !== 0) {
    m.i(0x3a48, 0);
    for (let col = 0; col < 24; col++)
      for (let row = 2; row >= 0; row--) {
        const id = m.i(0x95ea + col * 8 + row * 2),
          at = 0x6040 + id * 50;
        if (id && m.i(at + 8) === 0) {
          m.i(at + 42, col * 53 + (col & 1 ? -4 : -24));
          m.i(at + 44, row * 32 + 48);
        }
      }
  }
  const first = Math.max(0, Math.trunc(s16(m.i(0x5ed2) - 12) / 53));
  for (let col = first + 6; col >= first; col--)
    for (let row = 2; row >= 0; row--) {
      const id = m.i(0x95ea + col * 8 + row * 2),
        at = 0x6040 + id * 50;
      if (!id) continue;
      if (m.i(0x78e8) !== 0) flagJunglePlatformDirty(m, id, 2);
      if (m.i(at + 38) > 0 && m.i(at + 8) === 0) {
        const resource = pointer(m, 0x7160);
        m.i(resource, m.i(at + 42) - m.i(0x5ed2));
        m.i(resource + 2, m.i(at + 44));
        m.b(resource + 18, m.b(at + 6));
        draw(resource);
        m.i(at + 38, m.i(at + 38) - 1);
        if (m.i(at + 38) === 0) m.i(at + 40, 0);
      }
    }
  for (let col = first + 6; col >= first; col--)
    for (let row = 2; row >= 0; row--) {
      const id = m.i(0x95ea + col * 8 + row * 2),
        at = 0x6040 + id * 50;
      if (
        id &&
        m.i(at + 38) > 0 &&
        m.i(0x8c30 + id * 2) > 0 &&
        m.i(at + 10) === 0
      ) {
        const resource = pointer(m, 0x96da);
        m.i(resource, col * 53 - m.i(0x5ed2) + 16);
        m.i(resource + 2, row * 32 + 35);
        draw(resource);
      }
    }
}

// Original f97:04ab. Handles identify original surfaces; the sink owns pixels.
export function presentJungleBackground(m, worldX, x, width, save, effects) {
  let offset = s16(worldX + 48) % 104;
  for (let done = 0; done < width; offset = 0) {
    let chunk = Math.min(width - done, 104 - offset);
    if (chunk > 0) chunk = ((chunk - 1) >> 3) * 8 + 8;
    effects.copy({
      from: pointer(m, 0x7118),
      to: pointer(m, 0x2038),
      sourceX: offset,
      sourceY: 0,
      x: s16(x + done),
      y: 0,
      width: chunk,
      height: 176,
    });
    done += chunk;
  }
  presentJungleTerrain(m, effects.draw);
  for (
    let section = Math.trunc(worldX / 104);
    section <= Math.trunc(s16(worldX + 320) / 104);
    section++
  ) {
    const id = m.i(0x6a2e + section * 14);
    if (id && m.i(0x6882) !== 45)
      presentJungleObject(m, 0x703e + id * 38, effects.draw);
  }
  if (save) {
    effects.copy({
      from: pointer(m, 0x2038),
      to: pointer(m, 0x203a),
      sourceX: x,
      sourceY: 0,
      x,
      y: 0,
      width,
      height: 200,
    });
    m.i(0x3d10, m.i(0x5ed2));
  }
}

export function presentJungleFish(m, draw) {
  const scroll = m.i(0x5ed2),
    sign = scroll >> 15;
  const bucket = s16(((s16((scroll ^ sign) - sign) >> 7) ^ sign) - sign);
  const count = m.i(0x882c);
  if (count <= 0) throw Error("Invalid jungle presentation fish count");
  const phase = s16(bucket + m.i(0x778c)) % count;
  for (let i = 0; i < 4; i++) {
    const id = s16(phase + i) % count,
      at = 0x514a + id * 32;
    if (m.i(at + 4) !== 1) continue;
    const x = s16((bucket + i) * 128 + m.i(0x6950) - 128),
      y = m.i(at + 2);
    if (m.i(0x5ada) !== 0) {
      const point = jungleProjectilePosition(m, m.i(0x5ada));
      if (
        point &&
        point.x >= x &&
        point.x <= s16(x + m.i(at + 8)) &&
        point.y >= s16(y - m.i(at + 10)) &&
        point.y <= s16(y + m.i(at + 10))
      )
        flagJungleFishDirty(m, id, 7);
    }
    if (m.i(at + 28) > 0 && m.i(at + 12) < m.i(at + 14)) {
      const type = m.i(at + 6);
      if (type !== 17 && type !== 18)
        throw Error(`Unsupported jungle presentation fish type ${type}`);
      const resource = pointer(m, type === 17 ? 0x4dca : 0x4d36);
      m.b(resource + 18, m.b(at + 12));
      m.i(resource, x - scroll);
      m.i(resource + 2, y);
      if (m.i(resource) < 320) draw(resource);
      m.i(at + 28, m.i(at + 28) - 1);
      if (m.i(at + 28) === 0) m.i(at + 30, 0);
    }
    m.i(at + 22, m.i(at + 20));
    m.i(at + 26, m.i(at + 24));
    m.i(at + 20, x);
    m.i(at + 24, y);
  }
}

export function presentJungleVine(m, id, effects) {
  const at = 0x5d40 + id * 34;
  effects.color = m.b(at + 30);
  effects.line({
    x: s16(m.i(at + 12) - m.i(0x5ed2)),
    y: m.i(at + 14),
    x2: s16(m.i(at + 18) - m.i(0x5ed2)),
    y2: m.i(at + 20),
    color: effects.color,
  });
  m.i(at + 6, m.i(at + 4));
  m.i(at + 4, m.i(at + 18));
  m.i(at + 10, m.i(at + 8));
  m.i(at + 8, m.i(at + 20));
}

export function presentJungleHud(m, effects) {
  const saved = effects.color;
  const line = (x, y, x2, y2) =>
    effects.line({ x, y, x2, y2, color: effects.color });
  if (m.i(0x6882) === 6 || s16(m.i(0x6858) + 32) === 176 || m.i(0x78e8) !== 0) {
    effects.color = 0;
    for (let y = 176; y < 199; y++) line(0, y, 319, y);
    effects.color = 6;
    line(319, 176, 319, 199);
    line(0, 199, 319, 199);
    line(0, 176, 0, 199);
    effects.draw(pointer(m, 0x96dc));
    effects.draw(pointer(m, 0x6d9c));
    const resource = pointer(m, 0x5adc);
    m.b(resource + 18, 2);
    m.i(resource, 216);
    m.i(resource + 2, 186);
    for (let i = 0; i <= s16(3 - m.i(0x5cfc)); i++) {
      effects.draw(resource);
      m.b(resource + 18, m.b(resource + 18) - 1);
      m.i(resource, m.i(resource) + 32);
    }
    const money = String(m.view.getUint32(0x8cc0, true)),
      day = m.signedByte(0x4e0e);
    effects.text({ text: money, x: 175 - money.length * 8, y: 180, color: 14 });
    effects.text({
      text: String(day),
      x: day < 10 ? 18 : 14,
      y: 185,
      color: 0,
    });
  }
  effects.color = 6;
  line(0, 176, 319, 176);
  effects.color = saved;
}

// Main032b..047c, before the graphics-driver page operation. The sink snapshots
// descriptor bytes at consumption; it must not defer reads until after this pass.
export function presentJungleFrame(m, effects) {
  for (const method of ["draw", "copy", "line", "text"])
    if (typeof effects?.[method] !== "function")
      throw Error(`Missing jungle ${method} presentation sink`);
  if (
    !Number.isInteger(effects.color) ||
    effects.color < 0 ||
    effects.color > 255
  )
    throw Error("Missing jungle driver drawing color");
  if (m.i(0x78e8) > 1) for (let i = 0; i < 40; i++) m.i(0x374c + i * 14, 0);
  if (m.i(0x78e8) > 0) {
    presentJungleBackground(m, m.i(0x5ed2), 0, 320, m.i(0x78e8) === 1, effects);
    m.i(0x78e8, m.i(0x78e8) - 1);
  } else
    for (let i = 0; i < 40; i++) {
      const at = 0x374c + i * 14;
      if (m.i(at) === 0) continue;
      m.i(at, m.i(at) - 1);
      if (m.i(at + 6) > 0 && m.i(at + 8) > 0)
        effects.copy({
          from: pointer(m, 0x203a),
          to: pointer(m, 0x2038),
          sourceX: m.i(at + 2),
          sourceY: m.i(at + 4),
          x: m.i(at + 2),
          y: m.i(at + 4),
          width: m.i(at + 6),
          height: m.i(at + 8),
        });
    }
  const first = Math.trunc(m.i(0x5ed2) / 104),
    end = first + (m.i(0x8e0e) ? 4 : 3);
  for (let section = first; section < end; section++) {
    const at = 0x6a26 + section * 14,
      platform = m.i(at),
      monkey = m.i(at + 10);
    if (platform) presentJungleObject(m, 0x6052 + platform * 50, effects.draw);
    if (monkey) {
      const base = 0x58cc + monkey * 62;
      if (m.i(base + 42) !== 14) presentJungleObject(m, base + 2, effects.draw);
      m.i(base + 36, m.i(base + 34));
      m.i(base + 40, m.i(base + 38));
      m.i(base + 38, m.i(base + 30));
      m.i(base + 34, m.i(base + 28));
    }
  }
  presentJungleFish(m, effects.draw);
  for (let section = first; section < end; section++) {
    const at = 0x6a26 + section * 14;
    if (m.i(at + 2))
      presentJungleObject(m, 0x397e + m.i(at + 2) * 38, effects.draw);
    if (m.i(at + 10)) {
      presentJungleProjectile(m, m.i(at + 10), effects.draw);
      collideJungleProjectile(m, m.i(at + 10), effects);
    }
    if (m.i(at + 4)) {
      presentJungleVine(m, m.i(at + 4), effects);
      if (m.i(at + 6)) presentJungleVine(m, m.i(at + 6), effects);
    }
    if (m.i(at + 8) && m.i(0x6882) === 45)
      presentJungleObject(m, 0x703e + m.i(at + 8) * 38, effects.draw);
    if (m.i(at + 12)) {
      const base = 0x776e + m.i(at + 12) * 10;
      if (m.i(0x78e8) > 0 || m.i(base + 8) > 0) {
        const resource = pointer(m, 0x8c04);
        m.i(resource, m.i(base + 4) - m.i(0x5ed2));
        m.i(resource + 2, m.i(base + 6));
        effects.draw(resource);
        m.i(base + 8, m.i(0x78e8) === 0 ? m.i(base + 8) - 1 : 2);
      }
    }
  }
  rememberJungleActor(m);
  if (m.i(0x6882) !== 45) effects.draw(pointer(m, 0x797a));
  if (m.i(0x71f4) !== 0) {
    m.i(0x71d4, m.i(0x71e8));
    m.i(0x71d6, m.i(0x71ea));
    presentJungleObject(m, 0x71d4, effects.draw);
  }
  m.i(0x71f0, m.i(0x71ec));
  m.i(0x71f2, m.i(0x71ee));
  m.i(0x71ec, m.i(0x71e8));
  m.i(0x71ee, m.i(0x71ea));
  presentJungleHud(m, effects);
}
