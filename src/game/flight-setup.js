import { FlightMemory, FLIGHT } from "./flight-physics.js";
import {
  initializeFlightTerrain,
  generateFlightObjects,
} from "./flight-course.js";
import { nextRandom, u16 } from "./integer.js";

// Resource loads at original overlay 4:2f6f..3490 and entry 00xx.
// Dynamic mask/pixel allocation pointers are represented by asset references;
// descriptor geometry and frame bytes retain their original memory layout.
export const FLIGHT_SPRITES = new Map([
  [17, 0x6ec0],
  [18, 0x5ac2],
  [19, 0x95ac],
  [20, 0x4cf4],
  [21, 0x4d08],
  [22, 0x6954],
  [23, 0x6968],
  [24, 0x9598],
  [25, 0x6f16],
  [26, 0x4d68],
  [27, 0x4d7c],
  [29, 0x929e],
  [30, 0x5f02],
  [31, 0x5e94],
  [32, 0x8bda],
  [33, 0x6d9e],
  [34, 0x6db2],
  [40, 0x8cda],
  [41, 0x8cee],
  [42, 0x71ac],
  [43, 0x78ce],
  [44, 0x4cc8],
  [45, 0x4d4e],
  [46, 0x6e56],
  [47, 0x6f00],
  [48, 0x7130],
  [49, 0x8e3c],
  [52, 0x890e],
  [53, 0x4d1e],
  [54, 0x4db4],
  [55, 0x96de],
  [56, 0x8dd2],
  [57, 0x7182],
  [58, 0x685a],
  [59, 0x5d12],
  [60, 0x5faa],
  [61, 0x6f3e],
  [62, 0x5eee],
  [63, 0x5f18],
  [64, 0x6f2a],
  [65, 0x8992],
  [66, 0x77b0],
  [67, 0x686e],
]);

export function selectFlightScenery(m) {
  for (const at of [0x8c81, 0x544a, 0x7180, 0x8c80]) m.b(at, 0);
  let seed = nextRandom(m.i(0x2229)),
    draws = 1;
  const choice = seed % 6;
  const picture = choice < 5 ? 35 + choice : 28;
  m.b(choice < 5 ? 0x544a : 0x7180, choice < 5 ? choice + 1 : 1);
  let optional;
  if (m.b(0x5ed4)) optional = [59, 60];
  else {
    seed = nextRandom(seed);
    draws++;
    optional = seed % 100 < 90 ? [40, 41, 42, 43] : [29, 30, 31];
    m.b(optional[0] === 40 ? 0x8c81 : 0x8c80, 1);
  }
  m.i(0x2229, seed);
  return { picture, optional, draws };
}

export function prepareFlightCourse(
  { image, entries, days, racing, difficulty, seed, day },
  previousMemory,
) {
  if (!(image instanceof Uint8Array) || image.length !== 87664)
    throw Error("Missing supported executable image for flight");
  if (!Array.isArray(entries) || entries.length !== 68)
    throw Error("Missing supported PLANE.ARC");
  if (
    ![0, 1, 2].includes(difficulty) ||
    ![true, false, 0, 1].includes(racing) ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 30 ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 65535
  )
    throw Error("Invalid flight starting contract");
  const initial = new Uint8Array(65536);
  initial.set(image.subarray(0x120e0));
  const m = previousMemory ?? new FlightMemory(initial);
  m.i(0x2229, u16(seed));
  m.b(0x8990, difficulty);
  m.b(0x4e0e, day);
  m.b(0x5ed4, Number(racing));
  m.f(FLIGHT.speed, 0);
  for (const at of [
    0x0fb2, 0x0fb4, 0x0fb9, 0x8a32, 0x974c, 0x5466, 0x8a9c, 0x78ea, 0x4d4c,
    0x5ed6, 0x8d7c,
  ])
    m.i(at, 0);
  for (const at of [0x0fb6, 0x0fb7, 0x0fb8, 0x7978]) m.b(at, 0);
  const terrainDraws = initializeFlightTerrain(m, days);
  const scenery = selectFlightScenery(m);
  const assets = new Map();
  for (const [index, address] of FLIGHT_SPRITES) {
    if (
      [29, 30, 31, 40, 41, 42, 43, 59, 60].includes(index) &&
      !scenery.optional.includes(index)
    )
      continue;
    const e = entries[index];
    if (e.type !== 2 || e.width % 8 || !e.height || !e.frames)
      throw Error(`Invalid flight sprite ${index}`);
    m.i(address, 0);
    m.i(address + 2, 0);
    m.i(address + 4, e.width / 8);
    m.i(address + 6, e.height);
    m.i(address + 8, (e.width * e.frames) / 8);
    m.i(address + 10, e.height);
    m.b(address + 18, 0);
    assets.set(address, index);
  }
  const objects = generateFlightObjects(m, {
    pictureDimensions: (index) => entries[index],
  });
  m.i(0x5eee, 8);
  m.i(0x5ef0, 178);
  m.i(0x5f18, 72);
  m.i(0x5f1a, 185);
  m.i(0x5d12, 0);
  m.i(0x5d14, 24);
  for (let i = 0; i < 16; i++) {
    m.f(0x5516 + i * 8, m.f(0x0ee2 + i * 8) * m.d(0x32ca));
    m.f(0x551a + i * 8, m.f(0x0ee6 + i * 8) * m.d(0x32ca));
  }
  m.f(FLIGHT.x, 0);
  m.f(FLIGHT.y, m.f(0x32d2));
  return {
    memory: m,
    assets,
    scenery,
    draws: terrainDraws + scenery.draws + objects.draws,
    objectCount: objects.count,
  };
}
