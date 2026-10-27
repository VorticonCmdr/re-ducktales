const pointer = (m, at) => m.view.getUint16(at, true);

// Jungle overlay8:173e..1ef4 initializes sparse14-byte animation records.
// Fields omitted below retain incoming DS bytes, as in the original writes.
// sprite,frame,delay,motion,flags,dx,dy live at offsets0,2,4,6,8,10,12.
export function initializeJungleActorLists(m) {
  const list = (base, count, sprite, rows) => {
    for (let i = 0; i < count; i++) m.i(base + i * 14, m.i(sprite));
    for (const [index, fields] of rows.entries())
      for (const [key, value] of Object.entries(fields))
        m.i(
          base +
            index * 14 +
            {
              sprite: 0,
              frame: 2,
              delay: 4,
              motion: 6,
              flags: 8,
              dx: 10,
              dy: 12,
            }[key],
          key === "sprite" ? m.i(value) : value,
        );
  };
  list(0x6812, 5, 0x9762, [{ frame: 20 }, { frame: 24 }]);
  list(
    0x8a9e,
    10,
    0x9762,
    Array.from({ length: 10 }, (_, frame) => ({
      frame,
      ...([0, 5].includes(frame) ? { dx: 16 } : {}),
    })),
  );
  list(
    0x89a6,
    10,
    0x9762,
    Array.from({ length: 10 }, (_, i) => ({
      frame: i + 10,
      ...([0, 5].includes(i) ? { dx: -16 } : {}),
    })),
  );
  list(0x5c76, 8, 0x9762, [
    { frame: 21, dx: 10, dy: 0 },
    { frame: 20, dx: 2, dy: -12 },
    ...[12, 8, 10, 14].map((dy) => ({ sprite: 0x5f90, frame: 7, dx: 2, dy })),
    { frame: 21, dx: 10, dy: 0 },
    { frame: 20, dx: -10, dy: 0 },
  ]);
  list(0x5b40, 8, 0x9762, [
    { frame: 25, dx: -10, dy: 0 },
    { frame: 24, dx: -2, dy: -12 },
    ...[12, 8, 10, 14].map((dy) => ({ sprite: 0x5f90, frame: 3, dx: -2, dy })),
    { frame: 25, dx: -10, dy: 0 },
    { frame: 24, dx: 10, dy: 0 },
  ]);
  list(0x54b0, 3, 0x9762, [
    { frame: 21, dx: 16 },
    { frame: 22, dx: 0, delay: 7 },
    { frame: 20, dx: -16 },
  ]);
  list(0x95c0, 3, 0x9762, [
    { frame: 25, dx: -16 },
    { frame: 26, dx: 0, delay: 7 },
    { frame: 24, dx: 16 },
  ]);
  for (const [base, frames, dy] of [
    [0x8e50, [4, 5, 6, 7, 8, 7, 4], [-8, -12, -8, -6, 0, 0, -21]],
    [0x8d02, [4, 7, 8, 7, 6, 5, 4], [3, 14, 0, 0, 6, 10, 6]],
    [0x797c, [4, 5, 6, 7, 8, 7, 4], [-7, 3, -7, -6, 0, 0, -22]],
    [0x68ee, [4, 7, 8, 7, 6, 5, 4], [-7, 23, 0, 0, 6, 8, -4]],
  ])
    list(
      base,
      7,
      0x5f2c,
      frames.map((frame, i) => ({ frame, dy: dy[i] })),
    );
  list(0x8b5c, 9, 0x5f90, [
    { frame: 4 },
    { frame: 5 },
    { sprite: 0x5f2c, frame: 0, dx: 5, dy: -14 },
    { sprite: 0x5f2c, frame: 0, dx: 5, dy: -12 },
    { sprite: 0x5f2c, frame: 0, dx: 5, dy: -10 },
    { frame: 7, dx: 5, dy: -8 },
    { frame: 7, dx: 5, dy: 2 },
    { frame: 6, dx: 13, dy: 3 },
    { sprite: 0x9762, frame: 20, dx: -10, dy: 4 },
  ]);
  list(0x4d92, 1, 0x5f2c, [{ frame: 9, delay: 5 }]);
  list(0x96be, 1, 0x5f90, [{ frame: 5 }]);
  list(0x96cc, 1, 0x5f2c, [{ frame: 0, dx: 4, dy: -7 }]);
  list(0x9244, 1, 0x5f90, [{ frame: 1 }]);
  list(0x9252, 1, 0x5f2c, [{ frame: 2, dx: -4, dy: -7 }]);
  list(0x8926, 5, 0x9762, [
    { frame: 21, dx: 14 },
    { sprite: 0x5f90, frame: 4, dx: -8 },
    { sprite: 0x5f90, frame: 7, delay: 8, dx: -8, dy: -24 },
    { sprite: 0x5f90, frame: 4, dx: 8, dy: 24 },
    { frame: 21, dx: 8 },
  ]);
  list(0x7902, 5, 0x9762, [
    { frame: 25, dx: -14 },
    { sprite: 0x5f90, frame: 0, dx: 8 },
    { sprite: 0x5f90, frame: 3, delay: 8, dx: 6, dy: -24 },
    { sprite: 0x5f90, frame: 0, dx: -6, dy: 24 },
    { frame: 25, dx: -8 },
  ]);
  list(0x9274, 3, 0x5f2c, [{ frame: 4, dy: -8 }, { frame: 5 }, { frame: 4 }]);
  list(
    0x96f2,
    5,
    0x957e,
    Array.from({ length: 5 }, (_, frame) => ({
      frame,
      delay: 3,
      ...(frame === 0 ? { dx: -23 } : {}),
    })),
  );
  list(0x5fc0, 6, 0x546c, [
    { frame: 0, delay: 1, motion: 0 },
    { frame: 1, delay: 1, motion: 10 },
    { frame: 2, delay: 4, motion: 23 },
    { frame: 1, delay: 1, motion: 10 },
    { frame: 0, delay: 1, motion: 0 },
    { frame: 3, delay: 3, motion: -4 },
  ]);
  for (let i = 0; i < 6; i++) m.i(0x5fcc + i * 14, -6);
}

// f97:064e. Countdown and frame-index updates occur on separate calls: a
// positive delay decrements to zero without advancing until the next call.
export function advanceJungleActorFrame(m) {
  if (m.i(0x7164) > 0) {
    m.i(0x7164, m.i(0x7164) - 1);
    return;
  }
  m.i(0x88ae, m.i(0x88ae) + 1);
  if (m.i(0x88ae) >= m.i(0x6d9a) || m.i(0x4cf0) === 0) return;
  m.i(0x4cf0, m.i(0x4cf0) + 14);
  applyJungleActorFrame(m);
}

function applyJungleActorFrame(m) {
  const at = pointer(m, 0x4cf0);
  m.i(0x797a, m.i(at));
  m.i(0x5f46, m.i(0x5f46) + m.i(at + 10));
  m.i(0x6858, m.i(0x6858) + m.i(at + 12));
  m.b(pointer(m, 0x797a) + 18, m.b(at + 2));
  m.i(0x7164, m.i(at + 4));
}

// f97:06a9. Vine attachment uses an explicit geometric provider because it
// consumes the vine's current projection. Missing translation stops strictly.
export function selectJungleActorAnimation(
  m,
  action,
  { sound = () => {}, vinePoint } = {},
) {
  if (!Number.isInteger(action) || action < -32768 || action > 32767)
    throw Error("Invalid jungle actor action");
  m.i(0x88ae, 0);
  m.i(0x7164, 0);
  m.i(0x8b56, 1);
  m.i(0x4cf0, 0);
  const emit = (id) => {
    if (m.b(0x3be)) sound(id);
  };
  const facing = m.i(0x3d12);
  const sequence = (count, at) => {
    m.i(0x6d9a, count);
    m.i(0x4cf0, at);
  };
  switch (action) {
    case 1: {
      const first = m.i(0x8e26) !== 0 ? 0 : 5;
      m.i(0x88ae, first);
      sequence(
        first === 0 ? 5 : 10,
        (facing === 1 ? 0x8a9e : 0x89a6) + first * 14,
      );
      break;
    }
    case 2:
      m.i(0x8d64, 0);
      m.i(0x8924, 0);
      m.i(0x6d9a, 0);
      m.i(0x797a, m.i(0x5f2c));
      m.b(pointer(m, 0x797a) + 18, facing === 1 ? 1 : 3);
      emit(0x0f);
      break;
    case 3:
      sequence(9, facing === 1 ? 0x8b5c : 0x882e);
      break;
    case 4:
      sequence(8, facing === 1 ? 0x5c76 : 0x5b40);
      break;
    case 5:
      sequence(0, facing === 1 ? 0x6812 : 0x6820);
      break;
    case 6:
      emit(0x58);
      m.i(0x6858, 142);
      sequence(5, 0x96f2);
      break;
    case 8: {
      if (!vinePoint)
        throw Error("Untranslated jungle vine projection for actor attachment");
      m.i(0x6d9a, 1);
      m.i(0x797a, m.i(0x9762));
      const { x, y, anchorX } = vinePoint(m.i(0x7166));
      m.i(0x5f46, x);
      m.i(0x6858, y);
      let frame;
      if (anchorX > x) {
        frame = facing === 1 ? 28 : 30;
        m.i(0x5f46, x - (facing === 0 ? 12 : 3));
        m.i(0x6858, y + (facing === 0 ? 8 : 9));
      } else if (anchorX < x) {
        frame = facing === 1 ? 29 : 31;
        m.i(0x5f46, x + (facing === 0 ? 0 : 10));
        m.i(0x6858, y + (facing === 0 ? 10 : 17));
      } else {
        frame = facing === 1 ? 23 : 27;
        m.i(0x5f46, x + (facing === 0 ? -6 : 1));
        m.i(0x6858, y + 22);
      }
      m.b(pointer(m, 0x797a) + 18, frame);
      m.i(0x5f46, m.i(0x5f46) - 6);
      m.i(0x6858, m.i(0x6858) - 21);
      break;
    }
    case 10:
      sequence(3, facing === 1 ? 0x54b0 : 0x95c0);
      break;
    case 12:
      sequence(7, 0x8e50);
      break;
    case 13:
      sequence(7, 0x8d02);
      break;
    case 14:
      sequence(1, 0x4d92);
      break;
    case 16:
      sequence(2, 0x9244);
      break;
    case 17:
      sequence(2, 0x96be);
      break;
    case 18:
      sequence(5, facing === 0 ? 0x7902 : 0x8926);
      emit(0x64);
      break;
    case 19:
      sequence(3, 0x9274);
      break;
    case 20:
      sequence(7, 0x797c);
      break;
    case 21:
      sequence(7, 0x68ee);
      break;
    case 45:
      m.i(0x6d9a, 0);
      break;
    // Original switch defaults leave the previous count but no active list.
  }
  if (m.i(0x4cf0) !== 0) applyJungleActorFrame(m);
}

// f97:000c. Shared object record: world X/Y, frame index, delay, count,
// redraw counters, list pointer and action remain in their original DS slots.
export function initializeJungleObjectAnimation(
  m,
  type,
  at,
  action,
  x,
  y,
  { sound = () => {}, wait } = {},
) {
  if (![2, 8, 11, 24, 33].includes(type))
    throw Error(`Untranslated jungle animation type${type}`);
  if (type === 2 && action === 18 && typeof wait !== "function")
    throw Error("Missing jungle driver wait provider");
  at &= 65535;
  const emit = (id) => {
    if (m.b(0x3be)) sound(id);
  };
  m.i(at + 6, 0);
  m.i(at + 18, action);
  m.i(at, x);
  m.i(at + 2, y);
  const sequence = (count, list) => {
    m.i(at + 10, count);
    m.i(at + 16, list);
  };
  if (type === 33) {
    sequence(4, 0x6df4);
    emit(0x59);
  }
  if (type === 24 && [1, 3].includes(action))
    sequence(action === 1 ? 1 : 6, 0x5fc0);
  if (type === 11) {
    if (action === 14) sequence(0, 0x8a34);
    if (action === 18) sequence(0, 0x8a42);
    if (action === 19) sequence(3, 0x6884);
  }
  if (type === 8) {
    if (action === 20) sequence(1, 0x6e6c);
    if (action === 45) sequence(5, 0x6e7a);
  }
  if (type === 2) {
    const sequences = {
      11: [2, 0x9764],
      12: [2, 0x8a80],
      13: [0, 0x9772],
      15: [3, 0x5ae6],
      16: [0, 0x5f4a],
      17: [5, 0x5f4a],
      18: [12, 0x697e],
    };
    if (sequences[action]) sequence(...sequences[action]);
    if (action === 18) {
      emit(0);
      wait(0);
      wait(0x07);
      emit(0x61);
    }
  }
  m.i(at + 8, m.i(pointer(m, at + 16) + 4));
}

// f97:01e6. Advancing an object's list does not apply its dx/dy: callers use
// those as sprite offsets. Actor frames above instead move world coordinates.
export function advanceJungleObjectFrame(m, type, at, sound = () => {}) {
  if (![2, 8, 11, 24, 33].includes(type))
    throw Error(`Untranslated jungle animation type${type}`);
  at &= 65535;
  const emit = (id) => {
    if (m.b(0x3be)) sound(id);
  };
  if (m.i(at + 8) > 0) {
    m.i(at + 8, m.i(at + 8) - 1);
    return;
  }
  m.i(at + 6, m.i(at + 6) + 1);
  if (m.i(at + 6) < m.i(at + 10) && m.i(at + 16) !== 0)
    m.i(at + 16, m.i(at + 16) + 14);
  const reset = (count, list) => {
    m.i(at + 6, 0);
    m.i(at + 10, count);
    m.i(at + 16, list);
  };
  const complete = m.i(at + 6) >= m.i(at + 10);
  if (type === 33 && m.i(at + 18) !== 0 && complete) reset(4, 0x6df4);
  if (type === 24) {
    if (m.i(at + 18) === 1 && complete) reset(1, 0x5fc0);
    if (m.i(at + 18) === 3) {
      if (complete) {
        reset(6, 0x5fc0);
        emit(0x5e);
      } else if (m.i(at + 6) === 3) emit(0x57);
    }
  }
  if (m.i(at + 6) < m.i(at + 10) && m.i(at + 16) !== 0)
    m.i(at + 8, m.i(pointer(m, at + 16) + 4));
}

// Main11c5. This belongs to simulation's presentation boundary: drawing the
// original actor records page history and updates its resource descriptor.
// The raster renderer itself only consumes the resulting pure commands.
export function rememberJungleActor(m) {
  m.i(0x711a, m.i(0x7030));
  m.i(0x7196, m.i(0x716a));
  m.i(0x68ae, m.i(0x603e));
  const x = m.i(0x5f46) - (m.i(0x3d12) !== 0 ? 16 : 0);
  m.i(0x7030, x);
  m.i(0x716a, m.i(0x6858));
  m.i(0x603e, m.i(0x797a));
  const sprite = pointer(m, 0x797a);
  m.i(sprite, x - m.i(0x5ed2));
  m.i(sprite + 2, m.i(0x6858) + 1);
}

export function composeJungleActor(m, assetsByPointer) {
  if (m.i(0x6882) === 45) return [];
  const sprite = pointer(m, 0x797a),
    asset = assetsByPointer.get(sprite);
  if (asset === undefined)
    throw Error(`Unloaded jungle actor sprite DS:${sprite.toString(16)}`);
  return [
    {
      op: "sprite",
      asset,
      frame: m.b(sprite + 18),
      x: m.i(sprite),
      y: m.i(sprite + 2),
    },
  ];
}
