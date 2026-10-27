import { FlightMemory } from "./flight-physics.js";
import { executableText } from "./executable.js";
import {
  selectPhotographyTarget,
  selectPhotographyAnimals,
  initializePhotographyActors,
} from "./photography-actors.js";

export const PHOTOGRAPHY_ANIMALS = [
  0x8c98, 0x8b2a, 0x68c4, 0x7964, 0x6d86, 0x68b0, 0x4df4, 0x57c6, 0x78ec,
  0x88e6, 0x57b2, 0x5482, 0x546e, 0x4de0, 0x8b40, 0x8d7e,
];
const foreground = [
  [0x8c84, 1, 3, 63],
  [0x8cc6, 2, 1, 90],
  [0x8d68, 3, 41, 120],
  [0x8da8, 4, 70, 47],
  [0x8de6, 5, 140, 47],
  [0x8e28, 6, 141, 53],
  [0x8eb6, 7, 141, 99],
  [0x9260, 8, 182, 62],
  [0x956a, 9, 249, 71],
  [0x5f2e, 10, 274, 67],
  [0x6028, 11, 232, 113],
  [0x68d8, 12, 217, 138],
  [0x6cdc, 13, 238, 28],
];
export const PHOTOGRAPHY_AIM = [
  [118, 126],
  [120, 125],
  [178, 112],
];
const thumbnail = [
  [70, 50],
  [142, 49],
  [218, 51],
  [284, 51],
  [72, 109],
  [142, 108],
  [217, 108],
  [286, 108],
  [69, 166],
  [144, 166],
  [219, 164],
  [290, 164],
];

export function preparePhotography(options, previousMemory) {
  const { image, entries, difficulty, variant, seed, money, day, location } =
    options;
  if (![1, 2, 3, 4, 5, 6].includes(variant))
    throw Error(`Unsupported photography destination variant ${variant}`);
  if (
    !(image instanceof Uint8Array) ||
    image.length !== 87664 ||
    entries?.length !== 52 ||
    ![0, 1, 2].includes(difficulty) ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 65535 ||
    !Number.isInteger(money) ||
    money < 0 ||
    money > 0xffffffff ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 30 ||
    !Number.isInteger(location) ||
    location < 1 ||
    location > 34
  )
    throw Error("Invalid photography original resources/campaign contract");
  const bytes = new Uint8Array(65536);
  bytes.set(image.subarray(0x120e0));
  const m = previousMemory ?? new FlightMemory(bytes),
    assets = new Map();
  m.i(0x2229, seed);
  m.b(0x8990, difficulty);
  m.b(0x4e0e, day);
  m.b(0x5b3c, location);
  m.view.setUint32(0x8cc0, money, true);
  m.view.setUint32(0x97a8, 0, true);
  selectPhotographyTarget(m, variant);
  selectPhotographyAnimals(m, variant);
  m.b(0x3c1, 1);
  const load = (at, asset, x = 0, y = 0, frame = 0) => {
    const e = entries[asset];
    if (e?.type !== 2 || e.width % 8)
      throw Error(`Missing photography sprite ${asset}`);
    assets.set(at, asset);
    m.i(at, x);
    m.i(at + 2, y);
    m.i(at + 4, e.width / 8);
    m.i(at + 6, e.height);
    m.i(at + 8, (e.width * e.frames) / 8);
    m.i(at + 10, e.height);
    m.b(at + 18, frame);
  };
  for (const [at, asset, x, y] of foreground) load(at, asset, x, y);
  for (let i = 0; i < 6; i++) {
    const animal = m.i(0x6d30 + i * 2);
    if (i && animal === m.i(0x6d30)) continue;
    if (animal >= 14 && animal <= 29)
      load(PHOTOGRAPHY_ANIMALS[animal - 14], animal);
  }
  load(0x4da0, m.i(0x5f48));
  load(0x4dcc, 46, 117, 112, 1);
  load(0x8d94, 47, 8, 176);
  load(0x5eda, 48, 8, 176);
  load(0x8bf0, 49, 120, 125, 1);
  load(0x5b28, 50, 272, 178);
  initializePhotographyActors(m);
  return { memory: m, assets, entries, image };
}

export function drawPhotographySprite(commands, m, assets, at) {
  const asset = assets.get(at);
  if (asset === undefined)
    throw Error(`Unloaded photography sprite DS:${at.toString(16)}`);
  commands.push({
    op: "sprite",
    asset,
    x: m.i(at),
    y: m.i(at + 2),
    frame: m.b(at + 18),
  });
}
export function photographyHud(commands, m, assets, started) {
  for (const [x, y, x2, y2] of [
    [0, 176, 319, 176],
    [0, 199, 319, 199],
    [0, 176, 0, 199],
    [319, 176, 319, 199],
  ])
    commands.push({ op: "line", x, y, x2, y2, color: 4 });
  drawPhotographySprite(commands, m, assets, 0x8d94);
  if (started) drawPhotographySprite(commands, m, assets, 0x5eda);
  drawPhotographySprite(commands, m, assets, 0x5b28);
  const text = String(m.signedByte(0x5d2a));
  commands.push({
    op: "text",
    text,
    x: 300 - text.length * 8,
    y: 183,
    color: 15,
  });
}

// Main0b49..0edd followed by1046..11b5. Thumbnail positions are original
// bottom/right anchors, not browser layout. Results frame51 overlays the photos.
export function photographyResultsScene(m, assets, photos, image) {
  if (photos.length !== 12) throw Error("Incomplete photography result sheet");
  for (let i = 0; i < 32; i++) {
    const animal = i + 14;
    if ((animal >= 16 && animal <= 19) || (animal >= 32 && animal <= 35))
      continue;
    m.i(0x77fc + i * 6, 44);
    m.i(0x77fe + i * 6, 44);
  }
  const commands = [
      { op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 },
    ],
    target = m.i(0x5f48);
  const draw = (at) => drawPhotographySprite(commands, m, assets, at);
  for (let i = 0; i < 12; i++) {
    const animal = photos[i],
      normal = animal === target ? target - 16 : animal;
    const pose = (id, at) => {
      const extra = id === 17 || id === 18 || id === 33 || id === 34 ? 8 : 0;
      m.i(at, thumbnail[i][0] - m.i(0x77a8 + id * 6) + extra);
      m.i(at + 2, thumbnail[i][1] - m.i(0x77aa + id * 6) + extra);
      m.b(at + 18, 0);
      draw(at);
    };
    if (normal >= 14 && normal <= 29)
      pose(normal, PHOTOGRAPHY_ANIMALS[normal - 14]);
    if (animal === target) {
      const at = 0x4da0,
        extra = target === 33 || target === 34 ? 8 : 0;
      m.i(at, thumbnail[i][0] - m.i(0x77a8 + target * 6) + extra);
      m.i(at + 2, thumbnail[i][1] - m.i(0x77aa + target * 6) + extra);
      m.b(at + 18, target === 30 ? 1 : 0);
      draw(at);
    }
  }
  commands.push({ op: "sprite", asset: 51, frame: 0, x: 0, y: 0 });
  let score = m.view.getUint32(0x97a8, true);
  for (let i = 0; i < 12; i++)
    if (photos[i]) {
      const value = photos[i] === target ? 500 : 50,
        [x, y] = thumbnail[i];
      score = (score + value) >>> 0;
      commands.push({
        op: "text",
        text: executableText(image, photos[i] === target ? 0x1a3f : 0x1a41),
        x: x - 38,
        y: y + 3,
        color: 0,
      });
      commands.push({
        op: "text",
        text: String(value),
        x: x - 30,
        y: y + 3,
        color: 0,
      });
    }
  commands.push({
    op: "text",
    text: executableText(image, 0x1a43),
    x: 144,
    y: 184,
    color: 0,
  });
  commands.push({ op: "text", text: String(score), x: 152, y: 184, color: 0 });
  return commands;
}
