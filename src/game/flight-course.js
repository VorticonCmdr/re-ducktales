import { nextRandom, s16, u16, u8 } from "./integer.js";
import { generateFlightTerrain } from "./flight-terrain.js";

export function initializeFlightTerrain(m, days) {
  const generated = generateFlightTerrain(days, u16(m.i(0x2229)));
  m.i(0x5ce6, days * 42);
  m.i(0x2229, generated.seed);
  for (let i = 0; i < 130; i++) {
    m.i(0x4f42 + i * 4, generated.tiles[i]);
    m.i(0x4f44 + i * 4, -1);
  }
  for (let i = 0; i < 260; i++) {
    m.b(0x79f2 + i * 14, 255);
    m.b(0x79fe + i * 14, 255);
  }
  return generated.draws;
}

// Overlay 4:36c9..43f8, helpers 43f9/4430. All randomness is consumed here,
// including draws in branches that produce no object. Type numbers identify
// original resource/behavior records; the renderer does not choose placements.
export function generateFlightObjects(m, { pictureDimensions } = {}) {
  const total = m.i(0x5ce6);
  if (![42, 84, 126].includes(total))
    throw Error(`Invalid flight terrain length ${total}`);
  const difficulty = m.b(0x8990);
  if (difficulty > 2) throw Error(`Invalid flight difficulty ${difficulty}`);
  let draws = 0,
    count = 0;
  const random = () => {
    draws++;
    const value = nextRandom(m.i(0x2229));
    m.i(0x2229, value);
    return value;
  };
  const roll = () => random() % 100;
  const shift = m.b(0x2042) ? 2 : m.b(0x2044) ? 1 : 3;
  const typeAt = (tile) => m.i(0x4f42 + tile * 4);
  const mark = (tile) => {
    const at = 0x4f44 + tile * 4;
    if (m.i(at) === -1) m.i(at, count);
  };
  function add(tile, y, type, variant, width, height) {
    // The original checks count<257 only at the start of each tile. A tile
    // can append several records, followed by two landing records; do not
    // impose a 260-record limit that the original helper does not enforce.
    const at = 0x79f2 + count++ * 14;
    // The original helper intentionally leaves x (+2) and state (+6) alone.
    m.b(at, tile);
    m.i(at + 4, y);
    m.b(at + 12, type);
    m.b(at + 13, variant);
    m.i(at + 8, width);
    m.i(at + 10, height);
  }
  const height = (desc) => m.i(desc + 6);
  const sprite = (tile, y, type, desc, variant = 0) =>
    add(tile, y, type, variant, s16(m.i(desc + 4) << shift), height(desc));
  const grounded = (tile, bottom, type, desc, variant = 0) =>
    sprite(tile, bottom - height(desc), type, desc, variant);
  const picture = (tile, bottom, type, index, pointer) => {
    const raw = u16(m.i(pointer));
    const dimensions = pictureDimensions
      ? pictureDimensions(index)
      : { width: s16(m.i(raw) << 3), height: m.i(raw + 2) };
    add(
      tile,
      bottom - dimensions.height,
      type,
      0,
      dimensions.width,
      dimensions.height,
    );
    return dimensions.height;
  };
  let has31 = false,
    has34 = false,
    has1c = false,
    hasBackdrop = false;
  let hasWater = false,
    has38 = false,
    hasBuilding = false,
    hasAirship = false;
  let previousCloudY = 0;
  const add31 = (tile) => {
    has31 = true;
    mark(tile);
    grounded(tile, 176, 0x31, 0x8e3c);
  };
  const add34 = (tile) => {
    has34 = true;
    mark(tile);
    grounded(tile, 176, 0x34, 0x890e);
  };
  const clearGapFlags = () => {
    has31 =
      has34 =
      has1c =
      hasBackdrop =
      hasWater =
      has38 =
      hasBuilding =
        false;
  };
  m.i(0x4f44, 0);
  grounded(0, 168, 0x1a, 0x4d68);
  grounded(0, 140, 0x3a, 0x685a);
  let selection = random() & 3;
  let p = Array(10).fill(0);
  // Helper 4430 writes these ten byte probabilities through stack pointers.
  const probabilities = [
    [
      [5, 0, 6, 2, 2, 4, 0, 0, 5, 5],
      [10, 0, 12, 2, 6, 5, 4, 10, 9, 8],
    ],
    [
      [20, 0, 12, 2, 6, 10, 8, 40, 25, 15],
      [40, 5, 22, 4, 10, 20, 13, 60, 40, 25],
    ],
    [
      [60, 10, 28, 6, 15, 35, 25, 80, 55, 35],
      [80, 20, 35, 10, 25, 50, 35, 100, 70, 45],
    ],
  ];
  for (let tile = 2; tile <= total - 2 && count < 257; tile++) {
    if (tile === 2) p = probabilities[difficulty][0];
    else if (tile === Math.trunc(total / 2)) p = probabilities[difficulty][1];
    selection = random() % 6;
    let terrain = typeAt(tile);
    if (terrain === 11 && m.b(0x544a) && !has34 && roll() < p[0]) {
      hasBackdrop = true;
      mark(tile);
      const h = picture(tile, 160, 0x23, 34 + m.b(0x544a), 0x8bee);
      if (
        terrain < 10 &&
        terrain !== 5 &&
        terrain !== 6 &&
        roll() < 40 &&
        h > 80 &&
        !has31
      )
        add31(tile);
      continue;
    }
    // 3a68: absent scenery shortens the generated three-part mountain.
    if (terrain === 11) {
      m.i(0x4f42 + tile * 4, 8);
      terrain = 8;
      if (typeAt(tile + 1) !== 15) m.i(0x4f42 + (tile + 1) * 4, 0);
    }
    if (
      roll() < p[1] &&
      !hasAirship &&
      !hasBackdrop &&
      !has1c &&
      !has31 &&
      !has34 &&
      !hasBuilding &&
      !has38 &&
      !hasWater &&
      tile > 5 &&
      typeAt(tile - 1) !== 11 &&
      m.b(0x8c80)
    ) {
      hasAirship = true;
      mark(tile);
      sprite(tile, -10, 0x1d, 0x929e);
      sprite(tile, 0, 0x1f, 0x5e94);
      if (
        terrain < 11 &&
        ![5, 6, 7, 8].includes(terrain) &&
        roll() < 50 &&
        !has31
      ) {
        add31(tile);
        continue;
      }
      if (roll() < 35 && !has34 && terrain < 11) add34(tile);
      continue;
    }
    let y = roll();
    if (y <= p[2]) {
      mark(tile);
      const variant = y % 2 === 0 ? 1 : 0;
      if (y > 18 && y < 30) y += 25;
      else if (y > 2 && y < 10) y -= 16;
      if (
        u16(y - 10) < u16(previousCloudY) &&
        u16(y + 10) > u16(previousCloudY)
      )
        y += random() & 1 ? 20 : -20;
      previousCloudY = (u8(y) << 24) >> 24;
      sprite(tile, y, 0x21, 0x6d9e + variant * 20, variant);
    } else if (y < p[2] + p[3] && m.b(0x8c81)) {
      mark(tile);
      y = random() % 50;
      if (y > 10 && y < 40) y -= 20;
      const variant = random() & 1 ? 0 : 1,
        desc = 0x8cda + variant * 20;
      sprite(tile, y, 0x28, desc, variant);
      sprite(tile, y + height(desc) - 16, 0x2a, 0x71ac);
      sprite(tile, y + height(desc) - 16, 0x2b, 0x78ce);
      if (
        terrain < 11 &&
        ![5, 6, 7, 8].includes(terrain) &&
        roll() < 20 &&
        !has34 &&
        !hasBackdrop &&
        !has1c &&
        !has31
      ) {
        add31(tile);
        continue;
      }
      if (
        terrain < 11 &&
        !has34 &&
        !hasBackdrop &&
        !has1c &&
        !has31 &&
        roll() < 40
      )
        add34(tile);
      continue;
    }
    if (terrain === 12 && roll() < p[4] && !hasWater && !hasBuilding) {
      hasWater = true;
      mark(tile);
      sprite(tile, 139, 0x2e, 0x6e56);
      grounded(tile, 139, 0x2c, 0x4cc8);
      grounded(tile, 139, 0x2d, 0x4d4e);
      continue;
    }
    switch (selection) {
      case 0:
        if (
          terrain < 11 &&
          roll() < p[5] &&
          !has34 &&
          !hasBackdrop &&
          !has1c &&
          !has31
        ) {
          add34(tile);
          continue;
        }
        break;
      case 1:
      case 2:
        if (terrain < 12 && roll() < p[6] && !has38 && !has31) {
          has38 = true;
          mark(tile);
          grounded(tile, 164, 0x38, 0x8dd2, 2);
          grounded(tile, 164, 0x20, 0x8bda);
          continue;
        }
        break;
      case 3:
        if (
          terrain === 0 &&
          m.b(0x7180) &&
          roll() < p[7] &&
          !has1c &&
          !hasBackdrop &&
          !has34 &&
          !has31 &&
          !hasBuilding
        ) {
          has1c = true;
          mark(tile);
          picture(tile, 161, 0x1c, 28, 0x78e2);
          continue;
        }
        break;
      case 4:
        if (roll() < p[8] && !hasBuilding && !has1c && !hasBackdrop) {
          hasBuilding = true;
          mark(tile);
          if (random() & 1) y = 0;
          sprite(tile, y, 0x11, 0x6ec0);
          sprite(tile, y + height(0x6ec0), 0x12, 0x5ac2, 2);
          const body = random() & 3;
          // 4261 pushes the resource choice as variant, then a zero type.
          sprite(
            tile,
            144,
            0,
            [0x4cf4, 0x6954, 0x9598, 0x6f16][body],
            [0x14, 0x16, 0x18, 0x19][body],
          );
          if (
            terrain < 11 &&
            terrain !== 5 &&
            terrain !== 6 &&
            roll() > 50 &&
            terrain !== 7 &&
            terrain !== 8 &&
            !has31 &&
            !has34 &&
            !has1c &&
            !hasBackdrop &&
            !has38
          )
            add31(tile);
          continue;
        }
        break;
      case 5:
        if (
          terrain < 11 &&
          ![5, 6, 7, 8].includes(terrain) &&
          roll() < p[9] &&
          !has31 &&
          !hasBuilding &&
          !has34 &&
          !has38 &&
          !hasBackdrop &&
          !has1c
        ) {
          add31(tile);
          continue;
        }
        break;
      default:
        throw Error(`Unsupported flight placement ${selection}`);
    }
    clearGapFlags();
  }
  mark(total);
  grounded(total, 168, 0x1b, 0x4d7c);
  grounded(total, 140, 0x3a, 0x685a, -1);
  return { draws, count };
}
