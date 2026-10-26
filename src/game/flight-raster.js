import { EGA, imagePixels } from "../assets.js";

// Pure presentation. No game memory, input, time or RNG is consumed here.
export function renderFlightPixels(commands, entries, font) {
  const result = new Uint8ClampedArray(320 * 200 * 4);
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= 320 || y >= 200) return;
    result.set([...EGA[color], 255], (y * 320 + x) * 4);
  };
  for (const c of commands) {
    if (c.op === "fill") {
      if (!EGA[c.color]) throw Error(`Invalid flight color ${c.color}`);
      for (let y = Math.max(0, c.y); y < Math.min(200, c.y + c.height); y++)
        for (let x = Math.max(0, c.x); x < Math.min(320, c.x + c.width); x++)
          put(x, y, c.color);
    } else if (c.op === "text") {
      if (!font || font.length !== 2056)
        throw Error("Missing original flight font");
      for (let i = 0; i < c.text.length; i++) {
        const glyph = c.text.charCodeAt(i);
        if (glyph > 255) throw Error("Unsupported flight text glyph");
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++)
            if (font[8 + glyph * 8 + y] & (128 >> x))
              put(c.x + i * 8 + x, c.y + y, c.color);
      }
    } else if (c.op === "copy" || c.op === "sprite") {
      const entry = entries[c.asset];
      if (!entry || ![1, 2].includes(entry.type))
        throw Error(`Missing flight image ${c.asset}`);
      const sprite = c.op === "sprite";
      if (
        sprite &&
        (!Number.isInteger(c.frame) || c.frame < 0 || c.frame >= entry.frames)
      )
        throw Error(
          `Unsupported flight animation frame ${c.frame} for PLANE.ARC resource ${c.asset}`,
        );
      const pixels = imagePixels(
        entry,
        sprite ? c.frame : 0,
        sprite ? entry.data[0] >> 4 : -1,
      );
      const sx = sprite ? 0 : c.sourceX,
        sy = sprite ? 0 : c.sourceY;
      const width = sprite ? entry.width : c.width,
        height = sprite ? entry.height : c.height;
      if (
        sx < 0 ||
        sy < 0 ||
        sx + width > entry.width ||
        sy + height > entry.height
      )
        throw Error(`Invalid flight image crop ${c.asset}`);
      for (let y = Math.max(0, -c.y); y < Math.min(height, 200 - c.y); y++) {
        for (let x = Math.max(0, -c.x); x < Math.min(width, 320 - c.x); x++) {
          const from = ((sy + y) * entry.width + sx + x) * 4;
          if (pixels[from + 3])
            result.set(
              pixels.subarray(from, from + 4),
              ((c.y + y) * 320 + c.x + x) * 4,
            );
        }
      }
    } else throw Error(`Unsupported flight drawing operation ${c.op}`);
  }
  return result;
}
