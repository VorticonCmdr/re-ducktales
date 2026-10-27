import { nextRandom, u16 } from "./integer.js";

// Physical overlay7. All addresses below are original DS offsets. Rendering,
// clocks and input are deliberately outside these original leaf routines.
const random = (m) => {
  const value = nextRandom(u16(m.i(0x2229)));
  m.i(0x2229, value);
  return value;
};

// Main006b..0249. LOC uses variants1..6; Borneo6 takes the default branch.
// Variant0 is retained here only for direct default-branch comparisons.
// The AND15 roll is consumed once, including variant3.
export function selectPhotographyTarget(m, variant) {
  if (!Number.isInteger(variant) || variant < 0 || variant > 6)
    throw Error(`Unsupported photography variant ${variant}`);
  const roll = random(m) & 15;
  let target;
  switch (variant) {
    case 0:
    case 6:
      target = roll < 5 ? 30 : roll < 10 ? 32 : roll < 13 ? 40 : 41;
      break;
    case 1:
      target = roll < 5 ? 31 : roll < 10 ? 44 : 37;
      break;
    case 2:
      target =
        roll < 2
          ? 30
          : roll < 4
            ? 31
            : roll < 6
              ? 37
              : roll < 8
                ? 35
                : roll < 10
                  ? 40
                  : roll < 12
                    ? 43
                    : 34;
      break;
    case 3:
      target = roll & 1 ? 35 : 32;
      break;
    case 4:
      target =
        roll < 3
          ? 38
          : roll < 6
            ? 39
            : roll < 9
              ? 33
              : roll < 12
                ? 34
                : roll < 15
                  ? 42
                  : 43;
      break;
    case 5:
      target =
        roll < 3
          ? 38
          : roll < 6
            ? 39
            : roll < 9
              ? 33
              : roll < 12
                ? 34
                : roll < 15
                  ? 40
                  : 41;
      break;
  }
  m.i(0x5f48, target);
  return target;
}

// 0d39:0006 (body1226). Copy original executable's five companion IDs.
export function selectPhotographyAnimals(m, variant) {
  if (!Number.isInteger(variant) || variant < 1 || variant > 6)
    throw Error(`Unsupported photography variant ${variant}`);
  m.i(0x6d30, m.i(0x5f48) - 16);
  for (let i = 1; i < 6; i++)
    m.i(0x6d30 + i * 2, m.i(0x1a48 + variant * 10 + i * 2));
}

// Main05d4..06fe. The second bank intentionally repeats the first bank's
// collision/animation metadata, even where the replacement art is smaller.
export function initializePhotographyActors(m) {
  m.b(0x5d2a, 12);
  for (let slot = 0; slot < 3; slot++) {
    m.b(0x896c + slot * 12, 0);
    m.i(0x896e + slot * 12, 0);
  }
  const metadata = [
    [12, 48, 48],
    [12, 48, 46],
    [12, 32, 32],
    [2, 64, 62],
    [1, 64, 62],
    [4, 32, 32],
    [1, 48, 48],
    [2, 48, 48],
    [1, 48, 45],
    [2, 48, 45],
    [2, 48, 48],
    [1, 48, 48],
    [2, 48, 48],
    [1, 48, 48],
    [1, 48, 44],
    [2, 48, 44],
  ];
  for (let i = 0; i < 32; i++) {
    const at = 0x77fa + i * 6,
      [mask, width, height] = metadata[i % 16];
    m.b(at, mask);
    m.i(at + 2, width);
    m.i(at + 4, height);
  }
}

// 0d39:0043/006f (body1263/128f). Frame comparison in main0952 is
// unsigned; the countdown's later sign/zero tests belong to each animal.
export function photographyShutterLimit(m, record) {
  if (!m.b(record)) return 0;
  const animal = m.i(record + 2);
  return animal === 16 || animal === 32 ? 4 : 3;
}
export function reactToPhotographyShutter(m, record) {
  const animal = m.i(record + 2);
  if (animal === 16 || animal === 32) {
    m.b(record + 6, 1);
    m.b(record + 4, 4);
  } else {
    m.b(record + 6, animal === 19 || animal === 35 ? 0 : 1);
    if (animal === 19 || animal === 35) m.b(record + 5, 0);
    m.b(record + 4, 3);
  }
  return 0;
}

// Body1cba. Exactly two or three RNG draws per attempted spawn. Invalid
// placement masks consume their draws and return without touching the slot.
export function spawnPhotographyAnimal(m, slot, effects = {}) {
  if (![0, 1, 2].includes(slot))
    throw Error(`Unsupported photography animal slot ${slot}`);
  let animal;
  if (random(m) % 100 < u16(m.signedByte(0x4d66))) animal = m.i(0x5f48);
  else animal = m.i(0x6d30 + (random(m) % 6) * 2);
  const placeRoll = random(m),
    place = slot === 1 ? placeRoll & 3 : placeRoll % 5,
    masks = [0x1a46, 0x1a4b, 0x1a4f],
    metadata = (animal * 6 + 0x77a6) & 65535;
  if (!(m.b(masks[slot] + place) & m.b(metadata))) return false;
  const record = 0x896c + slot * 12;
  m.b(record, slot === 0 && place === 4 ? 14 : place + 1 + slot * 4);
  m.i(record + 2, animal);
  m.b(record + 4, 0);
  m.b(record + 5, 1);
  m.b(record + 6, m.signedByte(0x8990) === 0 && m.b(0x4dde) !== slot ? 2 : 1);
  m.i(record + 8, m.i((metadata + 2) & 65535));
  m.i(record + 10, m.i((metadata + 4) & 65535));
  if (m.b(0x3be)) effects.sound?.([0x67, 0x69, 0x68][slot]);
  return true;
}

// Body136f..148b. Time changes both target selection and spawn frequency.
// The empty-slot chance draws occur in the original order: left,right,center.
export function spawnPhotographyAnimals(m, effects = {}) {
  const hard = m.signedByte(0x8990) >= 2,
    timer = m.b(0x5eec);
  const targetChance =
    timer > 8
      ? hard
        ? 15
        : 25
      : timer > 2
        ? hard
          ? 20
          : 40
        : hard
          ? 25
          : 50;
  const spawnChance =
    timer > 8 ? (hard ? 80 : 90) : timer > 2 ? (hard ? 20 : 35) : hard ? 8 : 15;
  m.b(0x4d66, targetChance);
  for (const slot of [0, 2, 1])
    if (!m.b(0x896c + slot * 12) && random(m) % 100 < spawnChance)
      spawnPhotographyAnimal(m, slot, effects);
}

// Body1b04..1c2d. Position and frame are written before the draw call.
export function positionPhotographyAnimal(m, record, descriptor) {
  const width = m.i(record + 8),
    height = m.i(record + 10);
  let x = 100,
    y = 100;
  switch (m.b(record)) {
    case 1:
      x = 8;
      y = 80 - height;
      break;
    case 2:
      x = 14;
      y = 108 - height;
      break;
    case 3:
      x = 44;
      y = 124 - height;
      break;
    case 4:
      x = 78 - width;
      y = 124 - height;
      break;
    case 5:
      x = 140;
      y = 106 - height;
      break;
    case 6:
      x = 146;
      y = 64 - height;
      break;
    case 7:
      x = 144;
      y = 106 - height;
      break;
    case 8:
      x = 206 - width;
      y = 106 - height;
      break;
    case 9:
      x = 271 - width;
      y = 121 - height;
      break;
    case 10:
      x = 272;
      y = 70 - height;
      break;
    case 11:
      x = 232;
      y = 121 - height;
      break;
    case 12:
      x = 217;
      y = 151 - height;
      break;
    case 13:
      x = 240;
      y = 36;
      break;
    case 14:
      x = 0;
      y = 176 - height;
      break;
  }
  m.b(descriptor + 18, m.b(record + 4));
  m.i(descriptor, x);
  m.i(descriptor + 2, y);
}

// Body1c2e: foreground draw order. Place14 intentionally draws no occluder.
export function photographyOccluders(place) {
  return (
    [
      [],
      [0x8c84],
      [0x8cc6],
      [0x8d68],
      [0x8da8, 0x8d68],
      [0x8de6, 0x8eb6],
      [0x8e28],
      [0x8eb6],
      [0x9260, 0x8eb6],
      [0x956a, 0x6028],
      [0x5f2e],
      [0x6028],
      [0x68d8],
      [0x6cdc],
    ][place] ?? []
  );
}

// Main1094..11b5. No award for a missed photograph; a target photograph
// replaces the ordinary $50 with $500. Settlement/one-time guard is the
// caller's responsibility, matching the single original results pass.
export function settlePhotographyResults(m, photographs) {
  if (!(photographs instanceof Uint8Array) || photographs.length !== 12)
    throw Error("Photography requires exactly twelve result slots");
  let score = m.view.getUint32(0x97a8, true),
    success = 0;
  const target = m.i(0x5f48);
  for (const value of photographs) {
    const animal = (value << 24) >> 24;
    if (animal === target) {
      score += 500;
      success = 1;
    } else if (value !== 0) score += 50;
  }
  m.view.setUint32(0x97a8, score, true);
  m.view.setUint32(0x8cc0, m.view.getUint32(0x8cc0, true) + score, true);
  return success;
}

// Main1204..1219, after the results display and resource/palette cleanup.
export function finishPhotographyReturn(m, success) {
  if (success !== 0 && success !== 1)
    throw Error("Invalid photography completion result");
  const location = m.signedByte(0x5b3c);
  if (location < 1 || location > 34)
    throw Error(`Invalid photography campaign location ${location}`);
  if (success) m.b(0x4e30 + location * 8, 1);
  m.b(0x4e0e, m.b(0x4e0e) + 1);
  return success;
}
