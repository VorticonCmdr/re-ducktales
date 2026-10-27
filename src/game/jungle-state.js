import { prepareJungleMap } from "./jungle-map.js";
import { initializeJungleActorLists } from "./jungle-animation.js";
import { JUNGLE_SPRITES, jungleSceneResources } from "./jungle-scene.js";
import {
  initializeJungleMonkeys,
  initializeJungleBirds,
  initializeJungleVines,
  initializeJungleFish,
  initializeJungleBonus,
  initializeJungleSnakes,
  initializeJungleTransports,
  initializeJungleLife,
  initializeJunglePlatforms,
} from "./jungle-initialization.js";

// Original main13d4 loader,using explicit virtual near descriptors rather than
// DOS heap addresses. No captured game state or generated asset data is needed.
export function prepareJungle(options, previousMemory) {
  const {
    image,
    entries,
    mainEntries,
    mountainEntries,
    variant,
    difficulty,
    seed,
    money,
    day,
  } = options;
  if (
    ![0, 1, 2].includes(difficulty) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 65535 ||
    !Number.isInteger(money) ||
    money < 0 ||
    money > 0xffffffff ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 30
  )
    throw Error("Invalid jungle campaign contract");
  const resources = jungleSceneResources(entries, mainEntries, mountainEntries);
  const prepared = prepareJungleMap(
      { image, entries, variant },
      previousMemory,
    ),
    m = prepared.memory;
  //13d4 copies the source text before parsing; preserve its writes too.
  const text = entries[variant + 1].data;
  m.bytes.set(text, 0x3d28);
  m.i(0x6d46, text.length);
  prepareJungleMap({ image, entries, variant }, m);
  let descriptor = 0xa000;
  for (const [at, asset] of JUNGLE_SPRITES) {
    const e = resources.entries[asset];
    if (e?.type !== 2 || e.width % 8 !== 0)
      throw Error(`Missing supported jungle sprite ${asset}`);
    m.i(at, descriptor);
    m.bytes.fill(0, descriptor, descriptor + 20);
    for (const [offset, value] of [
      [4, e.width / 8],
      [6, e.height],
      [8, (e.width * e.frames) / 8],
      [10, e.height],
    ])
      m.i(descriptor + offset, value);
    descriptor += 20;
  }
  for (const [at, handle, stride, height, segment] of [
    [0x2038, 0xa400, 40, 200, 0xa200],
    [0x203a, 0xa40c, 40, 200, 0],
    [0x7118, 0xa418, 16, 176, 0],
  ]) {
    m.i(at, handle);
    m.bytes.fill(0, handle, handle + 12);
    m.i(handle, stride);
    m.i(handle + 2, height);
    m.i(handle + 6, segment);
    m.i(handle + 8, stride * height);
  }
  for (const [at, x, y] of [
    [0x96dc, 8, 178],
    [0x6d9c, 40, 177],
  ]) {
    const resource = m.view.getUint16(at, true);
    m.i(resource, x);
    m.i(resource + 2, y);
  }
  m.i(0x2229, seed);
  m.b(0x8990, difficulty);
  m.b(0x4e0e, day);
  m.view.setUint32(0x8cc0, money, true);
  m.b(0x2042, 0);
  m.bytes.set(m.bytes.slice(0x3d0, 0x3e1), 0x2056);
  initializeJungleActorLists(m);
  resetJungleLoader(m);
  m.i(0x3d10, 0);
  return { ...prepared, resources };
}

// Common prefix of main13d4,also used by the original life-reset path.
export function resetJungleLoader(m) {
  for (const at of [0x5ed2, 0x5f16, 0x8e0e, 0x1aac]) m.i(at, 0);
  m.i(0x78e8, 3);
}
export function initializeJungleEntry(m, effects) {
  initializeJungleMonkeys(m, effects);
  initializeJungleBirds(m, effects);
  initializeJungleVines(m);
  initializeJungleFish(m);
  initializeJungleBonus(m);
  initializeJungleSnakes(m, effects);
  initializeJungleTransports(m);
  initializeJungleLife(m, true, effects);
  initializeJunglePlatforms(m, true, effects);
  m.view.setUint32(0x27f8, 0, true);
  m.view.setUint32(0x27fc, 3, true);
  const id = m.i(0x95ea + m.i(0x544c) * 8 + m.i(0x5462) * 2);
  m.i(0x8c30 + id * 2, 0);
  m.i(0x88ac, 0);
}
