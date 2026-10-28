import { EGA } from "../assets.js";

// EGA resource001 stores four color planes followed by an opacity plane.
// Animation frames form a horizontal strip, including its scanline stride.
export function decodeFlightSprite(entry) {
  if (entry.type !== 2 || entry.width % 8)
    throw Error("Unsupported EGA flight sprite layout");
  const width = entry.width * entry.frames,
    stride = width / 8,
    span = stride * entry.height,
    bytes = new Uint8Array(span * 5),
    transparent = entry.data[0] >> 4;
  for (let y = 0; y < entry.height; y++)
    for (let x = 0; x < width; x++) {
      const packed = entry.data[(y * width) / 2 + (x >> 1)],
        color = x & 1 ? packed & 15 : packed >> 4,
        at = y * stride + (x >> 3),
        bit = 128 >> (x & 7);
      for (let plane = 0; plane < 4; plane++)
        if (color & (1 << plane)) bytes[plane * span + at] |= bit;
      if (color !== transparent) bytes[4 * span + at] |= bit;
    }
  return bytes;
}

const cached = new WeakMap();
export function flightFlagAliasPixels(entries) {
  if (cached.has(entries)) return cached.get(entries);
  const flag = entries[58],
    plane = entries[61];
  if (
    flag?.width !== 24 ||
    flag.height !== 24 ||
    flag.frames !== 3 ||
    plane?.width !== 32 ||
    plane.height !== 32 ||
    plane.frames !== 16
  )
    throw Error("Unsupported flight flag allocation layout");
  const first = decodeFlightSprite(flag),
    next = decodeFlightSprite(plane);
  // Natural native captures: 1080 bytes rounded to 1088, then a16-byte MCB.
  // We do not synthesize allocator metadata. No opaque alias pixel consumes it.
  const read = (at) => {
    if (at < first.length) return first[at];
    if (at >= 1104 && at < 1104 + next.length) return next[at - 1104];
    throw Error(`Unsupported flight flag heap read at ${at}`);
  };
  const pixels = new Uint8ClampedArray(24 * 24 * 4);
  // Native035d zero-extends the frame byte; frameff starts765 bytes in.
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      const at = 255 * 3 + y * 9 + (x >> 3),
        bit = 128 >> (x & 7);
      if (!(read(at + 4 * 216) & bit)) continue;
      let color = 0;
      for (let p = 0; p < 4; p++) if (read(at + p * 216) & bit) color |= 1 << p;
      pixels.set([...EGA[color], 255], (y * 24 + x) * 4);
    }
  cached.set(entries, pixels);
  return pixels;
}
