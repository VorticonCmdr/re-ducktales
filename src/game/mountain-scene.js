import { FlightMemory } from "./flight-physics.js";

const LAYOUTS = [0x0fec, 0x11fa, 0x1408];
const HAZARDS = [0x1618, 0x16ae, 0x1744];

// Overlay5:0125 selects these resident tables. Each of the 25 rows has
// twenty ASCII cells and a NUL terminator; F leaves the background visible.
export function mountainLayouts(image) {
  if (image?.length !== 87664)
    throw Error("Missing supported mountain executable");
  return LAYOUTS.map((at) => {
    const table = image.slice(0x120e0 + at, 0x120e0 + at + 25 * 21);
    for (let row = 0; row < 25; row++) {
      if (table[row * 21 + 20] !== 0)
        throw Error("Invalid mountain row terminator");
      for (let x = 0; x < 20; x++) {
        const cell = table[row * 21 + x];
        if (cell !== 0x46 && (cell < 0x30 || cell > 0x38))
          throw Error("Invalid mountain terrain cell");
      }
    }
    return table;
  });
}

export function prepareMountain(
  { image, entries, variant, difficulty, seed, money },
  previousMemory,
) {
  const layouts = mountainLayouts(image);
  if (
    !Number.isInteger(variant) ||
    variant < 0 ||
    variant > 2 ||
    ![0, 1, 2].includes(difficulty) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 65535 ||
    !Number.isInteger(money) ||
    money < 0 ||
    money > 0xffffffff
  )
    throw Error("Invalid mountain starting contract");
  if (
    entries?.length !== 16 ||
    entries[0]?.type !== 1 ||
    entries[0].width !== 320 ||
    entries[0].height !== 200 ||
    entries[1]?.type !== 2 ||
    entries[1].width !== 16 ||
    entries[1].height !== 40 ||
    entries[1].frames !== 9
  )
    throw Error("Missing supported MT.ARC resources");
  const bytes = new Uint8Array(65536);
  bytes.set(image.subarray(0x120e0));
  const m = previousMemory ?? new FlightMemory(bytes);
  // Resident175c's observable descriptor fields. Allocator pointers stay
  // outside this terrain/initial-state boundary.
  for (const [asset, at] of [
    [1, 0x36f2],
    [2, 0x5c48],
    [3, 0x5ce8],
    [12, 0x3720],
    ...[5, 6, 7, 8, 9, 10, 11, 13, 14, 15].map((id, i) => [
      id,
      0x57f0 + (i + 1) * 20,
    ]),
  ]) {
    const e = entries[asset];
    if (e?.type !== 2) throw Error(`Missing mountain sprite ${asset}`);
    for (const [offset, value] of [
      [0, 0],
      [2, 0],
      [4, e.width / 8],
      [6, e.height],
      [8, (e.width * e.frames) / 8],
      [10, e.height],
    ])
      m.i(at + offset, value);
    m.b(at + 18, 0);
  }
  m.i(0x2229, seed);
  m.b(0x8990, difficulty);
  m.view.setUint32(0x8cc0, money, true);
  m.i(0x57ee, LAYOUTS[variant]);
  m.i(0x5d26, HAZARDS[variant]);
  m.b(0x4d34, 3);
  // Overlay5:2e87 runs at expedition start; 2e31 runs at each life start.
  for (let row = 0; row < 25; row++) {
    const at = HAZARDS[variant] + row * 6;
    if ([4, 6, 9].includes(m.b(at))) m.b(at + 1, 0);
  }
  m.b(0x17db, 0);
  m.b(0x17e1, 0);
  let column = 1;
  while (column < 20 && layouts[variant][column] === 0x46) column++;
  if (column === 20) throw Error("Mountain has no starting platform");
  for (const [at, value] of [
    [0x5c70, 0],
    [0x6df0, 0x5c48],
    [0x54f6, column],
    [0x5ae0, column << 4],
    [0x5c72, 131],
    [0x6d3c, 20],
    [0x6882, 0],
    [0x36ea, column << 4],
    [0x36ee, 131],
    [0x3734, 20],
    [0x3706, 0],
    [0x36ec, column << 4],
    [0x36f0, 131],
    [0x3736, 20],
    [0x3708, 0],
    [0x3d12, 0],
  ])
    m.i(at, value);
  m.b(0x5c5a, 20);
  m.b(0x6ed4, 0);
  return { memory: m, entries, layouts, variant };
}

// Overlay5:166c. The original builds five 40-pixel strips in a scratch
// buffer, copies them bottom-to-top, then copies only the top 168 pixels.
// This terrain layer deliberately excludes actors, hazards and the HUD.
export function composeMountainTerrain(m, firstRow = 0) {
  return composeMountainViewport(m, firstRow, 0);
}

export function composeMountainViewport(m, firstRow, offset) {
  if (!Number.isInteger(firstRow) || firstRow < 0 || firstRow >= 25)
    throw Error("Invalid mountain scroll row");
  if (!Number.isInteger(offset) || offset < -40 || offset > 40)
    throw Error("Invalid mountain scroll displacement");
  const commands = [];
  for (let strip = offset < 0 ? -1 : 0; strip < (offset > 0 ? 6 : 5); strip++) {
    const y = 160 - strip * 40 + offset;
    const top = Math.max(0, y),
      bottom = Math.min(168, y + 40);
    if (top >= bottom) continue;
    if (firstRow + strip < 0)
      throw Error("Mountain camera scrolled below first row");
    const source = [
      {
        op: "copy",
        asset: 0,
        sourceX: 0,
        sourceY: ((firstRow + strip) % 5) * 40,
        x: 0,
        y: 0,
        width: 320,
        height: 40,
      },
    ];
    const row = firstRow + strip;
    if (row < 25)
      for (let column = 0; column < 20; column++) {
        const cell = m.b(m.i(0x57ee) + row * 21 + column);
        if (cell === 0x46) continue;
        if (cell < 0x30 || cell > 0x38)
          throw Error("Invalid mountain tile frame");
        source.push({
          op: "sprite",
          asset: 1,
          frame: cell - 0x30,
          x: column * 16,
          y: 0,
        });
      }
    commands.push({
      op: "restore",
      source,
      sourceX: 0,
      sourceY: top - y,
      x: 0,
      y: top,
      width: 320,
      height: bottom - top,
    });
  }
  return commands;
}
