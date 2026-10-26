import { FlightMemory } from "./flight-physics.js";
import { nextRandom, u16 } from "./integer.js";

export function parseCaveMaps(entries) {
  if (entries.length !== 8)
    throw Error("Expected eight CAVEMAPS.ARC resources");
  return entries.map((e, index) => {
    const text = new TextDecoder("ascii")
      .decode(e.data)
      .replace(/\x1a.*$/s, "")
      .trim();
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    if (lines.length !== 8 || lines.some((l) => !/^\d+(?: \d+){7}$/.test(l)))
      throw Error(`Invalid cave map ${index}`);
    const cells = lines.flatMap((l) => l.split(" ").map(Number));
    if (cells.some((n) => n < 0 || n > 65535))
      throw Error(`Invalid cave cell ${index}`);
    return Uint16Array.from(cells);
  });
}
export const CAVE_SPRITES = new Map([
  [17, 0x79de],
  [18, 0x6d04],
  [19, 0x8e12],
  [20, 0x6d5c],
  [21, 0x8eca],
  [4, 0x54da],
  [5, 0x8ef2],
  [6, 0x9780],
  [3, 0x4d38],
  [22, 0x9738],
  [23, 0x9584],
  [26, 0x88fa],
  [37, 0x5c5c],
  [38, 0x6cf0],
  [39, 0x6d70],
  [40, 0x6e42],
  [41, 0x6ed8],
  [42, 0x711c],
  [43, 0x5b10],
  [14, 0x78ba],
  [15, 0x5ea8],
  [16, 0x8dbe],
  [1, 0x5c32],
  [2, 0x6eec],
  [7, 0x974e],
  [8, 0x7198],
  [9, 0x57da],
  [27, 0x5496],
  [28, 0x8cac],
  ...Array.from({ length: 8 }, (_, i) => [29 + i, 0x8f06 + i * 20]),
  [44, 0x8c1c],
  [45, 0x5cfe],
  [46, 0x716c],
]);
export function caveRandom(m) {
  const seed = nextRandom(m.i(0x2229));
  m.i(0x2229, seed);
  return seed;
}
export function loadCaveSprite(m, entries, asset) {
  const at = CAVE_SPRITES.get(asset),
    e = entries[asset];
  if (at === undefined || e?.type !== 2)
    throw Error(`Unsupported cave sprite ${asset}`);
  m.i(at, 0);
  m.i(at + 2, 0);
  m.i(at + 4, e.width / 8);
  m.i(at + 6, e.height);
  m.i(at + 8, (e.width * e.frames) / 8);
  m.i(at + 10, e.height);
  m.b(at + 18, 0);
  return at;
}
export function prepareCave(
  { image, entries, maps, variant, difficulty, seed, money },
  previousMemory,
) {
  if (image?.length !== 87664 || entries?.length !== 47 || maps?.length !== 8)
    throw Error("Missing supported cave resources");
  if (
    ![0, 1, 2].includes(difficulty) ||
    !Number.isInteger(variant) ||
    variant < 0 ||
    variant >= 8 ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 65535
  )
    throw Error("Invalid cave starting contract");
  const bytes = new Uint8Array(65536);
  bytes.set(image.subarray(0x120e0));
  const m = previousMemory ?? new FlightMemory(bytes);
  m.i(0x2229, seed);
  m.b(0x8990, difficulty);
  m.view.setUint32(0x8cc0, money >>> 0, true);
  // Supported renderer is the original EGA driver pairing, not CGA door animations.
  m.i(0x2042, 0x100);
  m.i(0x2044, 0);
  m.b(0x5d2b, 1);
  m.b(0x3c1, 0);
  m.b(0x546a, 0);
  maps[variant].forEach((cell, i) => m.i(0x5a42 + i * 2, cell));
  for (const asset of [
    17, 18, 19, 20, 21, 4, 5, 6, 3, 22, 23, 26, 37, 38, 39, 40, 41, 42, 43, 14,
  ])
    loadCaveSprite(m, entries, asset);
  for (const [at, x, y] of [
    [0x79de, 82, 38],
    [0x54da, 220, 40],
    [0x8ef2, 0, 144],
    [0x9780, 240, 122],
    [0x4d38, 40, 24],
    [0x9738, 71, 141],
    [0x9584, 176, 110],
    [0x88fa, 141, 3],
    [0x5c5c, 112, 137],
    [0x5b10, 160, 115],
  ]) {
    m.i(at, x);
    m.i(at + 2, y);
  }
  for (const [at, x, y] of [
    [0x6cf0, 16, 65],
    [0x6d70, 28, 43],
    [0x6e42, 53, 19],
    [0x6ed8, 99, 45],
    [0x711c, 112, 63],
  ]) {
    m.i(at, 82 + x);
    m.i(at + 2, 38 + y);
  }
  m.i(0x4e28, 14);
  for (let i = 0; i < 64; i++) {
    const value = m.i(0x5a42 + i * 2);
    if (value & 32) m.i(0x97b0, i);
    else if (value & 16) m.i(0x4d32, i);
  }
  do {
    m.i(0x6810, caveRandom(m) & 63);
  } while (m.i(0x6810) === m.i(0x4d32));
  m.i(0x8eb2, 1);
  m.b(0x6d44, 0);
  m.b(0x8b54, 0);
  m.b(0x6f14, 0);
  m.i(0x54ac, [64, 48, 32][difficulty]);
  m.i(0x8b3e, m.i(0x54ac) >> 2);
  return { memory: m, entries, enemyInterval: [20, 16, 7][difficulty] };
}
export function caveDistance(a, b) {
  return Math.abs((a >> 3) - (b >> 3)) + Math.abs((a & 7) - (b & 7));
}
export function caveTrapNearby(m, room) {
  const cell = m.b(0x5a42 + room * 2);
  return [
    [1, -1, (room & 7) !== 0],
    [2, 1, (room & 7) !== 7],
    [8, -8, room > 7],
    [4, 8, room < 56],
  ].some(
    ([bit, delta, valid]) =>
      valid && cell & bit && m.b(0x5a42 + (room + delta) * 2) & 64,
  );
}
function draw(commands, m, asset) {
  const at = CAVE_SPRITES.get(asset);
  if (at === undefined) throw Error(`Missing cave descriptor ${asset}`);
  commands.push({
    op: "sprite",
    asset,
    x: m.i(at),
    y: m.i(at + 2),
    frame: m.b(at + 18),
  });
}
function dot(commands, x, y, color, cell, links) {
  commands.push({ op: "fill", x, y, width: 3, height: 3, color });
  if (links)
    for (const [bit, dx, dy] of [
      [8, 3, -1],
      [4, -1, 3],
      [2, 3, 3],
      [1, -1, -1],
    ])
      if (cell & bit)
        commands.push({
          op: "fill",
          x: x + dx,
          y: y + dy,
          width: 1,
          height: 1,
          color: 7,
        });
}
export function caveMinimap(m) {
  const commands = [];
  for (let i = 0; i < 64; i++)
    if (!m.b(0x8990) || m.b(0x5a42 + i * 2) & 16) {
      const x = 115 + (7 - (i >> 3) + (i & 7)) * 4,
        y = 139 + ((i >> 3) + (i & 7)) * 4;
      dot(
        commands,
        x,
        y,
        caveTrapNearby(m, i) ? 2 : 7,
        m.b(0x5a42 + i * 2),
        true,
      );
    }
  return commands;
}
// Overlay6:26bb room composition. No presentation, time or input is consumed.
export function composeCaveRoom(m, entries) {
  const commands = [
    {
      op: "copy",
      asset: 0,
      sourceX: 0,
      sourceY: 0,
      x: 0,
      y: 0,
      width: 320,
      height: 200,
    },
  ];
  const cell = m.b(0x5a42 + m.i(0x4d32) * 2);
  for (const [bit, id] of [
    [8, 4],
    [4, 5],
    [2, 6],
    [1, 3],
  ])
    if (!(cell & bit)) draw(commands, m, id);
  const place = (id, x, y) => {
    const at = loadCaveSprite(m, entries, id);
    m.i(at, x);
    m.i(at + 2, y);
    draw(commands, m, id);
  };
  if (cell & 64) place(2, 26, 92);
  const distance = m.i(0x4e08);
  if (distance < 2) place(9, 104, 8);
  else if (distance < 4) place(8, 104, 8);
  else if (distance < 6) place(7, 104, 65);
  if (caveTrapNearby(m, m.i(0x4d32))) place(1, 87, 14);
  return commands;
}
// Overlay6:20b8, normal EGA party/torch drawing. RNG is consumed here exactly
// once per original drawing call, even if the browser does not display the frame.
export function drawCaveParty(m, commands, { asset = 17, pose = 0 } = {}) {
  const party = CAVE_SPRITES.get(asset);
  if (party === undefined) throw Error(`Untranslated cave party ${asset}`);
  m.i(party, pose === 6 ? 85 : m.b(0x546a) === 2 ? 83 : 82);
  m.i(party + 2, pose === 6 ? 48 : m.b(0x546a) === 2 ? 47 : 38);
  if (pose !== 5 && pose !== 6) draw(commands, m, asset);
  const torch =
    m.signedByte(0x8b54) < m.i(0x54ac) >> 1
      ? 14
      : m.signedByte(0x8b54) < m.i(0x54ac) - m.i(0x8b3e)
        ? 15
        : 16;
  const at = CAVE_SPRITES.get(torch),
    table = 0x19dc + pose * 4;
  m.b(at + 18, m.b(0x6d44));
  m.i(
    at,
    (m.b(0x546a) === 2
      ? torch === 14
        ? 67
        : torch === 15
          ? 71
          : 76
      : m.i(party) + (torch === 14 ? -15 : torch === 15 ? -11 : -6)) +
      m.i(table),
  );
  m.i(
    at + 2,
    (m.b(0x546a) === 2
      ? torch === 14
        ? -26
        : torch === 15
          ? -13
          : -4
      : m.i(party + 2) + (torch === 14 ? -64 : torch === 15 ? -51 : -42)) +
      m.i(table + 2),
  );
  draw(commands, m, torch);
  if (pose === 5 || pose === 6) draw(commands, m, asset);
  for (const id of [26, 22, 23]) draw(commands, m, id);
  if (!m.b(0x546a)) {
    draw(commands, m, 37);
    commands.push(...caveMinimap(m));
    for (const [room, color, links] of [
      [m.i(0x4d32), 12, true],
      ...(m.b(0x8990) !== 2 ? [[m.i(0x97b0), 14, true]] : []),
      [m.i(0x6810), 6, false],
    ]) {
      dot(
        commands,
        115 + (7 - (room >> 3) + (room & 7)) * 4,
        139 + ((room >> 3) + (room & 7)) * 4,
        color,
        m.b(0x5a42 + room * 2),
        links,
      );
    }
  }
  let frame = caveRandom(m) & 3;
  if (frame === m.b(0x5c74)) frame = (frame + 1) & 3;
  m.b(0x6d44, frame);
  m.b(0x5c74, frame);
  return commands;
}
