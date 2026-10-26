import { EGA, imagePixels } from "../assets.js";

// Pure presentation. No game memory, input, time or RNG is consumed here.
export function renderFlightPixels(
  commands,
  entries,
  font,
  archive = "PLANE.ARC",
  cache = new WeakMap(),
) {
  if (cache.has(commands)) return cache.get(commands);
  const result = new Uint8ClampedArray(320 * 200 * 4);
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= 320 || y >= 200) return;
    result.set([...EGA[color], 255], (y * 320 + x) * 4);
  };
  for (const c of commands) {
    if (c.op === "restore") {
      if (
        !Array.isArray(c.source) ||
        ![c.x, c.y, c.sourceX, c.sourceY, c.width, c.height].every(
          Number.isInteger,
        ) ||
        c.sourceX < 0 ||
        c.sourceY < 0 ||
        c.width < 0 ||
        c.height < 0 ||
        c.sourceX + c.width > 320 ||
        c.sourceY + c.height > 200
      )
        throw Error("Invalid framebuffer copy");
      const source = renderFlightPixels(
        c.source,
        entries,
        font,
        archive,
        cache,
      );
      for (let y = Math.max(0, -c.y); y < Math.min(c.height, 200 - c.y); y++)
        for (let x = Math.max(0, -c.x); x < Math.min(c.width, 320 - c.x); x++) {
          const from = ((c.sourceY + y) * 320 + c.sourceX + x) * 4;
          result.set(
            source.subarray(from, from + 4),
            ((c.y + y) * 320 + c.x + x) * 4,
          );
        }
    } else if (c.op === "fill") {
      if (!EGA[c.color]) throw Error(`Invalid flight color ${c.color}`);
      for (let y = Math.max(0, c.y); y < Math.min(200, c.y + c.height); y++)
        for (let x = Math.max(0, c.x); x < Math.min(320, c.x + c.width); x++)
          put(x, y, c.color);
    } else if (c.op === "line") {
      // Resident 140e:00b0 dispatches axis lines to inclusive routines.
      // EGA 0589 uses major-axis count for diagonals, excluding the endpoint,
      // and advances the minor axis only for an error strictly above zero.
      if (!EGA[c.color] || ![c.x, c.y, c.x2, c.y2].every(Number.isInteger))
        throw Error("Invalid flight line");
      const dx = Math.abs(c.x2 - c.x),
        dy = Math.abs(c.y2 - c.y);
      const sx = Math.sign(c.x2 - c.x),
        sy = Math.sign(c.y2 - c.y);
      const horizontal = dx >= dy,
        major = Math.max(dx, dy),
        minor = Math.min(dx, dy);
      let x = c.x,
        y = c.y,
        error = 2 * minor - major;
      const count = major + (dx === 0 || dy === 0 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        put(x, y, c.color);
        if (error > 0) {
          if (horizontal) y += sy;
          else x += sx;
          error -= 2 * major;
        }
        error += 2 * minor;
        if (horizontal) x += sx;
        else y += sy;
      }
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
      // EGA driver 035d clips scanlines/columns before dereferencing pixels.
      // An offscreen flag may pass frame ff; it has no pixel or mask reads.
      if (
        sprite &&
        (c.x >= 320 ||
          c.y >= 200 ||
          c.x + entry.width <= 0 ||
          c.y + entry.height <= 0)
      )
        continue;
      if (
        sprite &&
        (!Number.isInteger(c.frame) || c.frame < 0 || c.frame >= entry.frames)
      )
        throw Error(
          `Unsupported flight animation frame ${c.frame} for ${archive} resource ${c.asset}`,
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
  cache.set(commands, result);
  return result;
}
