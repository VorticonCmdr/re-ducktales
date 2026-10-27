import { EGA } from "../assets.js";

// Supported EGA driver008e uses low RGB bits and intensity bit4 from DS2056.
export function readEgaPalette(memory) {
  return Array.from({ length: 16 }, (_, i) => {
    const code = memory.b(0x2056 + i);
    return EGA[(code & 7) | ((code & 16) >> 1)];
  });
}
export function applyEgaPalette(pixels, palette, context = "EGA") {
  if (
    palette?.length !== 16 ||
    palette.some(
      (c) =>
        !Array.isArray(c) ||
        c.length !== 3 ||
        c.some((v) => !Number.isInteger(v) || v < 0 || v > 255),
    )
  )
    throw Error(`Missing ${context} presentation palette`);
  if (pixels.length % 4 !== 0) throw Error(`Invalid ${context} RGBA data`);
  const rgba = Uint8ClampedArray.from(pixels);
  // Pack through byte views instead of assuming host endianness. Whole-word
  // lookup preserves alpha and avoids three channel writes for every pixel.
  const sourceBytes = new Uint8Array(16 * 4),
    targetBytes = new Uint8Array(16 * 4);
  for (let i = 0; i < 16; i++) {
    sourceBytes.set(EGA[i], i * 4);
    targetBytes.set(palette[i], i * 4);
  }
  const sourceWords = new Uint32Array(sourceBytes.buffer),
    targetWords = new Uint32Array(targetBytes.buffer);
  const colors = new Map(
    Array.from(sourceWords, (word, i) => [word | 0, targetWords[i]]),
  );
  const maskBytes = Uint8Array.from([255, 255, 255, 0]),
    rgbMask = new Uint32Array(maskBytes.buffer)[0];
  const words = new Uint32Array(rgba.buffer);
  for (let i = 0; i < words.length; i++) {
    const color = colors.get(words[i] & rgbMask);
    if (color === undefined) throw Error(`Unsupported ${context} source color`);
    words[i] = (words[i] & ~rgbMask) | color;
  }
  return rgba;
}
