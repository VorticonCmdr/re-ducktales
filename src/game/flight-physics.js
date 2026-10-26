import { s16 } from "./integer.js";

// Overlay 4, 1330..194a. Addresses are offsets in the original data segment.
// Keeping these few layouts makes routine comparisons independent of rendering.
export const FLIGHT = Object.freeze({
  speed: 0x0fae,
  firstTile: 0x0fb2,
  tile: 0x0fb4,
  bounces: 0x0fb9,
  tiles: 0x5ce6,
  scroll: 0x5ed6,
  x: 0x6d18,
  y: 0x6d3e,
  heading: 0x974c,
  up: 0x5466,
  down: 0x8a9c,
});

export class FlightMemory {
  constructor(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 65536)
      throw Error("Flight requires one complete 64K data segment");
    this.bytes = Uint8Array.from(bytes);
    this.view = new DataView(this.bytes.buffer);
  }
  i(at, value) {
    if (value === undefined) return this.view.getInt16(at, true);
    this.view.setInt16(at, value, true);
    return this.i(at);
  }
  b(at, value) {
    if (value === undefined) return this.view.getUint8(at);
    this.view.setUint8(at, value);
    return this.b(at);
  }
  f(at, value) {
    if (value === undefined) return this.view.getFloat32(at, true);
    // Every original FST[P] dword rounds here, not at intermediate operations.
    this.view.setFloat32(at, value, true);
    return this.f(at);
  }
  d(at) {
    return this.view.getFloat64(at, true);
  }
  signedByte(at) {
    return this.view.getInt8(at);
  }
}

// 2cf8..2d3f. A stalled plane gradually points down; not every heading changes.
export function stalledHeading(heading) {
  if (heading === 0) return 15;
  if ((heading > 0 && heading < 4) || heading > 13) return heading - 1;
  if (heading > 4 && heading < 11) return heading + 1;
  return heading;
}

export function advanceFlightPhysics(m) {
  const a = FLIGHT;
  const previousX = m.f(a.x);
  let heading = m.i(a.heading);
  if (heading < 0 || heading > 15)
    throw Error(`Unsupported plane heading ${heading}`);
  const vector = heading * 8;
  if (m.f(a.speed) !== m.d(0x32ee)) {
    m.f(a.x, m.f(a.x) + m.f(0x0ee2 + vector) * m.f(a.speed));
    m.f(a.y, m.f(a.y) - m.f(0x0ee6 + vector) * m.f(a.speed));
  }
  if (heading > 8 && heading < 16) {
    m.f(a.x, m.f(a.x) + m.f(0x5516 + vector));
    m.f(a.y, m.f(a.y) - m.f(0x551a + vector));
    m.f(a.speed, m.f(a.speed) + m.f(heading === 12 ? 0x335a : 0x335e));
  }
  if (heading > 0 && heading < 8) {
    m.f(a.x, m.f(a.x) - m.f(0x5516 + vector));
    m.f(a.y, m.f(a.y) + m.f(0x551a + vector));
    m.f(a.speed, m.f(a.speed) - m.f(heading === 4 ? 0x335e : 0x3362));
  }
  const turningLeft = heading >= 4 && heading <= 12;
  if (m.i(a.down) > 0 && m.f(a.speed) > m.d(turningLeft ? 0x32ee : 0x3366))
    heading = (heading + 1) & 15;
  else if (m.i(a.up) > 0 && m.f(a.speed) > m.d(turningLeft ? 0x3366 : 0x32ee))
    heading = (heading + 15) & 15;
  m.i(a.heading, heading);

  const ground = m.i(a.tile) < 2 || m.i(a.tile) > m.i(a.tiles) - 2 ? 139 : 144;
  const delta = m.f(a.x) - previousX;
  // FST (not FSTP) preserves the unrounded delta for the first conversion.
  m.i(a.scroll, Math.trunc(delta + m.i(a.scroll)));
  const storedDelta = Math.fround(delta);
  const forward = heading <= 4 || heading >= 12;
  if (m.f(a.x) > m.d(0x336e) && forward && m.i(a.tile) < m.i(a.tiles) - 2) {
    // The original adds this displacement twice when the camera follows.
    m.i(a.scroll, Math.trunc(storedDelta + m.i(a.scroll)));
    m.f(a.x, m.f(0x3376));
  } else if (m.f(a.x) < m.d(0x337a) && !forward && m.i(a.firstTile) !== 0) {
    m.i(a.scroll, Math.trunc(storedDelta + m.i(a.scroll)));
    m.f(a.x, m.f(0x3382));
  } else if (
    m.i(a.tile) === m.i(a.tiles) &&
    m.f(a.x) > m.d(0x330a) &&
    m.i(a.firstTile) + 3 === m.i(a.tiles)
  ) {
    m.i(a.scroll, 0);
    m.f(a.x, m.f(0x3312));
    m.i(a.heading, 8);
  } else if (m.i(a.tile) === 0 && !forward && m.f(a.x) < m.d(0x32ee)) {
    m.f(a.x, 0);
    m.i(a.heading, 0);
    m.i(a.scroll, 0);
  }
  if (m.i(a.scroll) > 79) {
    if (s16(m.i(a.firstTile) + 3) < m.i(a.tiles))
      m.i(a.firstTile, m.i(a.firstTile) + 1);
    m.i(a.scroll, m.i(a.scroll) - 80);
  } else if (m.i(a.scroll) < -79) {
    m.i(a.scroll, m.i(a.scroll) + 80);
    if (m.i(a.firstTile) > 0) m.i(a.firstTile, m.i(a.firstTile) - 1);
  }
  if (
    (m.i(a.firstTile) + 3 >= m.i(a.tiles) && m.f(a.x) > m.d(0x337a)) ||
    (m.i(a.firstTile) === 0 && m.i(a.tile) < 2 && !forward)
  )
    m.i(a.scroll, 0);

  if (m.f(a.speed) < m.d(0x32fe) && m.f(a.y) < ground)
    m.i(a.heading, stalledHeading(m.i(a.heading)));
  if (m.f(a.y) < m.d(0x32ee)) {
    m.i(a.heading, stalledHeading(m.i(a.heading)));
    m.f(a.y, 0);
  } else if (m.f(a.y) > ground) {
    if (
      m.i(a.tile) >= m.i(a.tiles) - 1 &&
      (m.i(a.heading) > 12 || m.i(a.heading) === 0)
    ) {
      m.i(a.heading, 0);
      m.f(a.y, ground);
    } else if (m.signedByte(a.bounces) > 1) {
      m.f(a.speed, 0);
      m.i(a.heading, 0);
      m.f(a.y, ground);
      m.b(0x4d30, 0);
      m.i(0x4d1e, Math.trunc(m.f(a.x) + m.d(0x3386)));
      m.i(0x4d20, Math.trunc(m.f(a.y) - 14));
      const water = m.i(0x4f42 + m.i(a.tile) * 4) === 12;
      if (water) {
        m.i(0x7182, Math.trunc(m.f(a.x) + m.d(0x338e)));
        m.i(0x7184, 168 - m.i(0x7188));
      }
      // Water animation is a separate three-retrace external effect. Do not
      // silently consume those retraces in this simulation routine.
      return {
        sprite: 0x4d1e,
        sound: water ? 0x3a : 0x2b,
        splashFrames: water ? 3 : 0,
      };
    } else {
      m.b(a.bounces, m.b(a.bounces) + 1);
      m.f(a.y, ground - 4);
      heading = m.i(a.heading);
      if (heading >= 12 || heading > 7) {
        m.i(a.heading, heading >= 12 ? 1 : 7);
        if (m.f(a.speed) < m.d(0x3396)) m.f(a.speed, m.f(0x339e));
      } else {
        m.i(a.heading, 5);
        m.f(a.speed, m.f(0x32fa));
      }
      return finishPhysics(m, 0x28);
    }
  }
  return finishPhysics(m, null);
}

function finishPhysics(m, sound) {
  const heading = m.i(FLIGHT.heading);
  m.b(0x6f50, heading);
  m.i(0x6f3e, Math.trunc(m.f(FLIGHT.x)));
  m.i(0x6f40, Math.trunc(m.f(FLIGHT.y)));
  m.i(0x36ca, Math.trunc(m.f(FLIGHT.y) + m.signedByte(0x0f7a + heading)));
  m.i(0x36c8, Math.trunc(m.f(FLIGHT.y) + m.signedByte(0x0f9a + heading)));
  m.i(0x36ce, Math.trunc(m.f(FLIGHT.x) + m.signedByte(0x0f6a + heading)));
  m.i(0x36d4, Math.trunc(m.f(FLIGHT.x) + m.signedByte(0x0f8a + heading)));
  m.i(FLIGHT.up, 0);
  m.i(FLIGHT.down, 0);
  return { sprite: 0x6f3e, sound, splashFrames: 0 };
}

// Main flight loop samples controls after the physics/render/collision phase.
export function sampleFlightControls(
  m,
  { fire = false, up = false, down = false },
) {
  if (up && down)
    throw Error("Flight direction must match one original direction code");
  if (fire)
    m.f(
      FLIGHT.speed,
      m.f(FLIGHT.speed) +
        (m.f(FLIGHT.speed) < m.d(0x32d6) ? m.f(0x32de) : -m.f(0x32de)),
    );
  else {
    if (m.f(FLIGHT.speed) >= m.d(0x32e2)) {
      m.f(FLIGHT.speed, m.f(FLIGHT.speed) - m.f(0x32ea));
      if (m.f(FLIGHT.speed) < m.d(0x32ee)) m.f(FLIGHT.speed, 0);
    }
  }
  if (up) m.i(FLIGHT.up, 1);
  if (down) m.i(FLIGHT.down, 1);
}
