import { s16 } from "./integer.js";
import {
  tileObjects,
  updateFlightObjects,
  foregroundFlightObjects,
} from "./flight-objects.js";

// Overlay 4:f78..132f and 2ba0..2cf7. This original drawing pass also advances
// scenery, rival and object state. Canvas only observes the returned commands.
export function advanceFlightScene(
  m,
  { assets, scenery },
  plane = 0x6f3e,
  sound = () => {},
) {
  const commands = [
    { op: "fill", color: 11, x: 0, y: 0, width: 320, height: 200 },
  ];
  const draw = (address) => {
    const asset = assets.get(address);
    if (asset === undefined)
      throw Error(`Unloaded flight sprite DS:${address.toString(16)}`);
    commands.push({
      op: "sprite",
      asset,
      x: m.i(address),
      y: m.i(address + 2),
      frame: m.b(address + 18),
    });
  };
  const position = (address, x, y) => {
    m.i(address, x);
    m.i(address + 2, y);
    draw(address);
  };
  for (const [x, y, width, height] of [
    [0, 176, 320, 1],
    [0, 199, 320, 1],
    [0, 177, 1, 23],
    [319, 177, 1, 23],
  ])
    commands.push({ op: "fill", color: 4, x, y, width, height });
  draw(0x5eee);
  if (s16(m.i(0x78ea) + 42) <= m.i(0x0fb4)) {
    m.b(0x4e0e, m.b(0x4e0e) + 1);
    m.i(0x78ea, m.i(0x78ea) + 42);
  }
  commands.push({
    op: "text",
    text: String(Math.min(30, m.signedByte(0x4e0e))),
    x: m.signedByte(0x4e0e) < 10 ? 18 : 14,
    y: 184,
    color: 0,
  });
  draw(0x5f18);
  const progress = (tile) =>
    Math.trunc((tile / m.i(0x5ce6)) * m.d(0x33be) + m.d(0x33c6));
  position(0x6f2a, progress(m.i(0x0fb4)), m.b(0x5ed4) ? 177 : 182);
  if (m.b(0x5ed4)) position(0x5faa, progress(m.i(0x8d7c)), 186);
  let left = s16(-m.i(0x5ed6)),
    first = m.i(0x0fb2);
  if (m.i(0x5ed6) < 0) {
    left = s16(left - 80);
    first--;
  }
  let tile = first,
    found = false,
    finishLeft;
  while (left < 320) {
    left = s16(left & 0xfff8);
    let sourceX = 0,
      x = left,
      width = 80;
    if (left < 0) {
      width = left + 80;
      sourceX = -left;
      x = 0;
    } else if (left > 240) width = 320 - left;
    // 0fd8/1010 rounds the left edge before testing its width. Scroll -1..-7
    // gives an empty preceding strip (-1): no terrain pointer is read. Keep
    // processing the strip's counters, as the original does at113e/1154.
    if ((tile < 0 || tile >= 130) && !(tile === -1 && width === 0))
      throw Error(`Unsupported terrain drawing tile ${tile}`);
    if (width > 0) {
      const terrain = m.i(0x4f42 + tile * 4);
      if (terrain < 0 || terrain > 16)
        throw Error(`Unsupported terrain asset ${terrain}`);
      commands.push({
        op: "copy",
        asset: terrain,
        sourceX,
        sourceY: 0,
        x,
        y: terrain >= 1 && terrain <= 10 ? 144 : 160,
        width,
        height: terrain >= 1 && terrain <= 10 ? 32 : 16,
      });
    }
    for (const o of tileObjects(m, tile)) {
      m.i(o + 2, left);
      const type = m.b(o + 12);
      if (type === 0x23 || type === 0x24 || type === 0x1c) {
        if (width > 0)
          commands.push({
            op: "copy",
            asset: type === 0x1c ? 28 : scenery.picture,
            sourceX,
            sourceY: 0,
            x,
            y: m.i(o + 4),
            width,
            height: m.i(o + 10),
          });
      } else if (type === 0x20) m.i(o + 2, left + 32);
      else if (type === 0x1b) m.i(o + 2, left + 40);
    }
    if (m.b(0x5ed4)) {
      if (tile === m.i(0x8d7c)) {
        if (tile >= m.i(0x5ce6) - 3 && m.i(0x5d14) < 149)
          m.i(0x5d14, m.i(0x5d14) + 5);
        m.i(0x5d12, left + m.i(0x4d4c));
        draw(0x5d12);
      }
      // The rival advances once per visible terrain strip, including strips
      // where it is not drawn. This is the original timing, not once per frame.
      m.i(0x4d4c, m.i(0x4d4c) + 2);
      if (m.i(0x4d4c) > 79) {
        m.i(0x4d4c, 0);
        m.i(0x8d7c, m.i(0x8d7c) + 1);
      }
    }
    if (tile === m.i(0x5ce6) - 2) finishLeft = left;
    left = s16(left + 80);
    if (m.f(0x6d18) < left && !found) {
      found = true;
      m.i(0x0fb4, tile);
    }
    tile++;
  }
  const last = tile;
  for (tile = first; tile < last; tile++) {
    updateFlightObjects(m, tile, draw, sound);
    if (tile === m.i(0x0fb4)) {
      if (m.i(0x974c) === 0 && ![0x4d1e, 0x5f02, 0x7182].includes(plane)) {
        m.b(0x89a4, m.b(0x8a32));
        position(
          0x8992,
          Math.trunc(m.f(0x6d18)),
          Math.trunc(m.f(0x6d3e) + m.d(0x3322)),
        );
        if (m.f(0x0fae) > m.d(0x32fe) && m.f(0x0fae) < m.d(0x332a)) {
          m.b(0x77c2, m.b(0x8a32));
          position(
            0x77b0,
            Math.trunc(m.f(0x6d18) - m.d(0x3332)),
            Math.trunc(m.f(0x6d3e) + m.d(0x333a)),
          );
        }
      } else {
        draw(plane);
        if (m.i(0x974c) === 1 || m.i(0x974c) === 2) {
          m.b(0x77c2, m.b(0x8a32));
          position(
            0x77b0,
            Math.trunc(m.f(0x6d18) - m.d(0x3342)),
            Math.trunc(m.f(0x6d3e) + m.d(m.i(0x974c) === 1 ? 0x334a : 0x3352)),
          );
        }
      }
      // Special sprite pointers skip the propeller-counter increment in 126b.
      if (!(m.i(0x974c) === 0 && [0x4d1e, 0x5f02, 0x7182].includes(plane))) {
        m.b(0x8a32, m.b(0x8a32) + 1);
        if (m.signedByte(0x8a32) > 3) m.b(0x8a32, 0);
      }
    }
    foregroundFlightObjects(m, tile, draw, sound);
    if (tile === m.i(0x5ce6) - 2) {
      if (finishLeft === undefined) throw Error("Missing flight finish strip");
      position(0x686e, finishLeft + 40, 149);
    }
  }
  return commands;
}
