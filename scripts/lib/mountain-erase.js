// Original mountain156a/15c5/282a..2d08. Source copy-call plan,not raster
// reconstruction. No DOM,clock,RNG or guessed background rectangles.
const s16 = (v) => (v << 16) >> 16;
export function eraseMountainSource(m, firstRow, copy) {
  if (
    !m?.view ||
    typeof copy !== "function" ||
    !Number.isInteger(firstRow) ||
    firstRow < 0 ||
    firstRow > 24
  )
    throw Error("Unsupported mountain erase input");
  const word = (at) => m.view.getUint16(at & 65535, true);
  const emit = (x, y, width, height) =>
    copy({
      from: word(0x203a),
      to: word(0x2038),
      sourceX: s16(x),
      sourceY: s16(y),
      x: s16(x),
      y: s16(y),
      width: s16(width),
      height: s16(height),
    });
  const page = word(0x370a);
  if (page > 1) throw Error("Unsupported mountain erase page");
  const old = m.i(0x3706 + page * 2);
  if ([5, 6].includes(old) || m.i(0x4cf2) > 0) {
    emit(0, 0, 320, 168);
    m.i(0x4cf2, m.i(0x4cf2) - 1);
    return;
  }
  let x = s16(m.i(0x36ea + page * 2) - 8),
    y = m.i(0x36ee + page * 2),
    width = 56,
    height = 40;
  if ([21, 27].includes(m.i(0x3734 + page * 2))) {
    x = s16(x - 40);
    y = s16(y - 40);
    width = 128;
    height = 128;
  }
  if (s16(y + height) > 168) height = s16(168 - y);
  if (x < 0) x = 0;
  else if (s16(x + width) > 320) width = s16(320 - x);
  emit(x, y, width, height);
  for (let row = firstRow; row < firstRow + 5 && row < 25; row++) {
    const at = (word(0x5d26) + row * 6) & 65535,
      type = m.b(at),
      state = m.b(at + 1),
      delta = row - firstRow;
    if (type === 2) {
      emit(
        s16(m.i(at + 2) + (state < 10 ? 22 : -22)),
        Math.max(0, s16(130 - delta * 40)),
        48,
        33,
      );
    } else if (type === 3) {
      emit(m.i(at + 2), Math.max(0, s16(124 - delta * 40)), 40, 40);
    } else if (type === 4) {
      if (state === 0 || state === 3)
        emit(s16(m.i(0x5854) + 16), Math.max(0, s16(144 - delta * 40)), 32, 16);
      if (state <= 3)
        emit(m.i(at + 2), Math.max(0, s16(140 - delta * 40)), 64, 24);
    } else if (type === 6) {
      emit(m.i(at + 2), Math.max(0, s16(124 - delta * 40)), 64, 40);
    } else if (type === 9 && [1, 2].includes(state)) {
      emit(m.i(at + 2), s16(148 - delta * 40), 16, 16);
      m.b(at + 1, state + 1);
    }
  }
  // Cloud state3 has no initialized width/height in the original. Its source
  // inspected transitions do not produce3. Wider reachability is unproven;
  // do not invent prior stack contents for it.
  const cloud = m.b(0x17db);
  if (![0, 1, 2, 4, 5].includes(cloud))
    throw Error("Unsupported mountain erase cloud state");
  x = Math.max(0, s16(m.i(0x17dc) - 16));
  y = 0;
  if (cloud === 0)
    emit(s16(x + 8), 136, s16(x + 56) > 319 ? s16(312 - x) : 48, 32);
  else if (cloud === 4) emit(s16(m.i(0x17dc) + 18), 40, 16, 16);
  else if (cloud === 5) emit(s16(m.i(0x17dc) + 18), 0, 24, 168);
  emit(x, y, 72, 32);
  // The inactive rock path deliberately retains the cloud's X/Y locals.
  const rock = m.b(0x17e1);
  if ([1, 2, 3].includes(rock)) {
    x = s16(m.i(0x17e2) + (rock === 2 ? -2 : rock === 3 ? 2 : 0));
    const position = s16(s16(m.i(0x3742) - firstRow) * 40 + m.i(0x3744));
    y = s16((rock === 1 ? 138 : 146) - position);
  }
  if (firstRow === 0) {
    emit(0, 148, 32, 20);
    emit(288, 148, 32, 20);
  }
  x = s16(x - 8);
  y = s16(y - 8);
  width = 32;
  height = 32;
  if (s16(y + 32) <= 0 || y >= 168) return;
  if (y < 0) {
    height = s16(height + y);
    y = 0;
  } else if (s16(y + height) > 168) height = s16(168 - y);
  if (s16(x + width) <= 0 || x >= 320) return;
  if (x < 0) x = 0;
  else if (s16(x + width) > 319) x = 287;
  emit(x, y, width, height);
}
