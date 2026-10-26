import { s16 } from "./integer.js";
import { EGA } from "../assets.js";
import { renderFlightPixels } from "./flight-raster.js";

// Pointer variables populated by main13d4, in original resource-load order.
// HUD cards come from the prior MAIN archive; life icons are MT.ARC12,
// loaded after JG closes (original filename at DS1acf is "mt.arc").
export const JUNGLE_SPRITES = new Map([
  [0x957e, 0],
  [0x9762, 5],
  [0x5f2c, 6],
  [0x5f90, 17],
  [0x7160, 8],
  [0x546c, 9],
  [0x5b26, 11],
  [0x54ee, 12],
  [0x5468, 13],
  [0x8cc4, 14],
  [0x4d36, 10],
  [0x8c04, 15],
  [0x4dca, 16],
  [0x78e6, 18],
  [0x96da, 19],
  [0x96dc, 20],
  [0x6d9c, 21],
  [0x5adc, 22],
]);

export function jungleSceneResources(entries, mainEntries, mountainEntries) {
  if (
    entries?.length !== 20 ||
    mainEntries?.[42]?.data?.length !== 2056 ||
    mountainEntries?.[12]?.frames !== 3
  )
    throw Error("Missing original jungle scene resources");
  return {
    entries: [
      ...entries,
      mainEntries[25],
      mainEntries[23],
      mountainEntries[12],
    ],
    font: mainEntries[42].data,
  };
}

// The supported320x200 driver uses the low RGB bits and intensity bit4.
// Life setup changes palette slots5/13 together: red,blue,green. Keep this
// palette explicit; the asset viewer and other scenes retain their own palette.
export function junglePalette(m) {
  return Array.from({ length: 16 }, (_, i) => {
    const code = m.b(0x2056 + i);
    return EGA[(code & 7) | ((code & 16) >> 1)];
  });
}
export function renderJunglePixels(commands, resources, palette) {
  if (
    palette?.length !== 16 ||
    palette.some(
      (c) =>
        !Array.isArray(c) ||
        c.length !== 3 ||
        c.some((v) => !Number.isInteger(v) || v < 0 || v > 255),
    )
  )
    throw Error("Missing jungle presentation palette");
  const rgba = Uint8ClampedArray.from(
    renderFlightPixels(commands, resources.entries, resources.font, "JG.ARC"),
  );
  const colors = new Map(
    EGA.map((c, i) => [c[0] * 65536 + c[1] * 256 + c[2], palette[i]]),
  );
  for (let i = 0; i < rgba.length; i += 4) {
    const color = colors.get(rgba[i] * 65536 + rgba[i + 1] * 256 + rgba[i + 2]);
    if (!color) throw Error("Unsupported jungle source color");
    rgba.set(color, i);
  }
  return rgba;
}

// f97:05bf builds a104-pixel repeating strip from frame1 of JG7, after
// drawing it at48,0 and copying source56..159. Restore commands preserve
// original source coordinates without generating or modifying asset files.
const forest = Object.freeze([
  {
    op: "copy",
    asset: 4,
    sourceX: 0,
    sourceY: 0,
    x: 0,
    y: 0,
    width: 320,
    height: 200,
  },
  { op: "sprite", asset: 7, frame: 1, x: 48, y: 0 },
]);
const pointer = (m, at) => m.view.getUint16(at & 65535, true);
const word = (m, at) => m.i(at & 65535);

// Reconstruct the full scene from a presentation-boundary state. This is pure
// rendering: page histories, dirty counters, tuple advancement and collisions
// must be handled separately by the simulation. Incremental page-copy parity
// is not established by this full-redraw compositor.
// Projectile hit frames need commands retained before original09c0 clears the
// active flag; an arbitrary post-collision snapshot loses that drawn projectile.
export function composeJungleFullScene(m) {
  const commands = [],
    scroll = m.i(0x5ed2);
  if (scroll < 0) throw Error(`Unsupported jungle camera position ${scroll}`);
  const assets = new Map(
    [...JUNGLE_SPRITES].map(([at, asset]) => [pointer(m, at), asset]),
  );
  const sprite = (resource, x, y, frame = m.b(resource + 18)) => {
    const asset = assets.get(resource);
    if (asset === undefined)
      throw Error(`Unloaded jungle scene sprite DS:${resource.toString(16)}`);
    commands.push({ op: "sprite", asset, frame, x: s16(x), y: s16(y) });
  };
  const descriptor = (at) =>
    sprite(pointer(m, at), m.i(pointer(m, at)), m.i(pointer(m, at) + 2));
  const object = (at) => {
    const list = pointer(m, at + 16);
    if (list === 0)
      throw Error(`Missing jungle animation list DS:${at.toString(16)}`);
    sprite(
      pointer(m, list),
      s16(m.i(at) + word(m, list + 10) - scroll),
      s16(m.i(at + 2) + word(m, list + 12)),
      m.b(list + 2),
    );
  };
  // f97:04ab rounds each source copy width upward to a whole byte.
  commands.push({ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 });
  for (let x = 0, offset = (scroll + 48) % 104; x < 320; offset = 0) {
    const width = Math.ceil(Math.min(320 - x, 104 - offset) / 8) * 8;
    commands.push({
      op: "restore",
      source: forest,
      sourceX: 56 + offset,
      sourceY: 0,
      width,
      height: 176,
      x,
      y: 0,
    });
    x += width;
  }
  const firstColumn = Math.max(0, Math.trunc(s16(scroll - 12) / 53));
  for (let col = firstColumn + 6; col >= firstColumn; col--)
    for (let row = 2; row >= 0; row--) {
      const id = word(m, 0x95ea + col * 8 + row * 2),
        at = id * 50;
      if (id && word(m, at + 0x6048) === 0)
        sprite(
          pointer(m, 0x7160),
          s16(word(m, at + 0x606a) - scroll),
          word(m, at + 0x606c),
          m.b(at + 0x6046),
        );
    }
  for (let col = firstColumn + 6; col >= firstColumn; col--)
    for (let row = 2; row >= 0; row--) {
      const id = word(m, 0x95ea + col * 8 + row * 2);
      if (id && word(m, 0x8c30 + id * 2) > 0 && word(m, 0x604a + id * 50) === 0)
        sprite(pointer(m, 0x96da), col * 53 - scroll + 16, row * 32 + 35);
    }
  const firstSection = Math.trunc(scroll / 104),
    lastSection = firstSection + (m.i(0x8e0e) !== 0 ? 4 : 3);
  const sections = [];
  for (let section = firstSection; section < lastSection; section++) {
    const at = 0x6a26 + section * 14;
    sections.push({
      platform: m.i(at),
      bird: m.i(at + 2),
      vine: m.i(at + 4),
      vine2: m.i(at + 6),
      snake: m.i(at + 8),
      monkey: m.i(at + 10),
      transport: m.i(at + 12),
    });
  }
  // Snakes normally belong to the restored background (f97:04ab).
  if (m.i(0x6882) !== 45)
    for (
      let section = firstSection;
      section <= Math.trunc((scroll + 320) / 104);
      section++
    ) {
      const snake = word(m, 0x6a2e + section * 14);
      if (snake) object(0x703e + snake * 38);
    }
  // Main0375..03b5: moving-platform and monkey bodies precede the fish.
  for (const { platform, monkey } of sections) {
    if (platform) object(0x6052 + platform * 50);
    if (monkey && m.i(0x58f6 + monkey * 62) !== 14)
      object(0x58ce + monkey * 62);
  }
  const fishCount = m.i(0x882c),
    bucket = Math.trunc(scroll / 128);
  if (fishCount < 1 || fishCount > 16)
    throw Error("Invalid jungle scene fish count");
  for (let i = 0; i < 4; i++) {
    const id = (bucket + m.i(0x778c) + i) % fishCount,
      at = 0x514a + id * 32;
    if (m.i(at + 4) !== 1 || m.i(at + 12) >= m.i(at + 14)) continue;
    const type = m.i(at + 6),
      resource = type === 17 ? 0x4dca : type === 18 ? 0x4d36 : null;
    if (resource === null)
      throw Error(`Unsupported jungle scene fish type ${type}`);
    sprite(
      pointer(m, resource),
      (bucket + i) * 128 + m.i(0x6950) - 128 - scroll,
      m.i(at + 2),
      m.b(at + 12),
    );
  }
  // Main03c5..046f. Preserve section order and the original nested vine2 gate.
  for (const { bird, monkey, vine, vine2, snake, transport } of sections) {
    if (bird) object(0x397e + bird * 38);
    if (monkey && m.i(0x58f8 + monkey * 62)) {
      const at = monkey * 62,
        x = s16(m.i(at + 0x58fc) - scroll),
        y = m.i(at + 0x58fe);
      if (x > 0 && y < 154) sprite(pointer(m, 0x8cc4), x, y, 0);
    }
    if (vine)
      for (const id of [vine, vine2].filter(Boolean)) {
        const at = id * 34;
        commands.push({
          op: "line",
          x: s16(word(m, at + 0x5d4c) - scroll),
          y: word(m, at + 0x5d4e),
          x2: s16(word(m, at + 0x5d52) - scroll),
          y2: word(m, at + 0x5d54),
          color: m.b(at + 0x5d5e),
        });
      }
    if (snake && m.i(0x6882) === 45) object(0x703e + snake * 38);
    if (transport)
      sprite(
        pointer(m, 0x8c04),
        s16(word(m, transport * 10 + 0x7772) - scroll),
        word(m, transport * 10 + 0x7774),
      );
  }
  if (m.i(0x6882) !== 45) descriptor(0x797a);
  if (m.i(0x71f4)) object(0x71d4);
  commands.push({ op: "fill", x: 0, y: 176, width: 320, height: 24, color: 0 });
  for (const [x, y, x2, y2] of [
    [319, 176, 319, 199],
    [319, 199, 0, 199],
    [0, 199, 0, 176],
  ])
    commands.push({ op: "line", color: 6, x, y, x2, y2 });
  descriptor(0x96dc);
  descriptor(0x6d9c);
  for (let i = 0; i <= 3 - m.i(0x5cfc); i++)
    sprite(pointer(m, 0x5adc), 216 + i * 32, 186, 2 - i);
  const money = String(m.view.getUint32(0x8cc0, true)),
    day = m.signedByte(0x4e0e);
  commands.push({
    op: "text",
    text: money,
    x: 175 - money.length * 8,
    y: 180,
    color: 14,
  });
  commands.push({
    op: "text",
    text: String(day),
    x: day < 10 ? 18 : 14,
    y: 185,
    color: 0,
  });
  commands.push({ op: "line", color: 6, x: 0, y: 176, x2: 319, y2: 176 });
  return commands;
}
