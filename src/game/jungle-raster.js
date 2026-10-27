import { EGA } from "../assets.js";
import { renderFlightPixels } from "./flight-raster.js";
import { JUNGLE_SPRITES } from "./jungle-scene.js";

const colors = new Map(
  EGA.map((c, i) => [c[0] * 65536 + c[1] * 256 + c[2], i]),
);
const surface = (stride, height, planeSize = stride * height) => ({
  stride,
  height,
  planeSize,
  bytes: new Uint8Array(planeSize * 4),
  known: new Uint8Array(planeSize * 4),
});
function pixel(target, x, y, color) {
  const address = y * target.stride + (x >> 3),
    mask = 128 >> (x & 7);
  for (let p = 0; p < 4; p++) {
    const at = p * target.planeSize + address;
    target.bytes[at] =
      (target.bytes[at] & ~mask) | (color & (1 << p) ? mask : 0);
    target.known[at] |= mask;
  }
}
function overlay(target, rgba) {
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 320; x++) {
      const at = (y * 320 + x) * 4;
      if (!rgba[at + 3]) continue;
      const color = colors.get(
        rgba[at] * 65536 + rgba[at + 1] * 256 + rgba[at + 2],
      );
      if (color === undefined)
        throw Error("Unsupported jungle raster source color");
      pixel(target, x, y, color);
    }
}

// Bounded planar storage for the supported EGA driver. Original1:01ef copies
// width>>3 bytes at sourceX>>3,destX>>3; it clips only the destination bottom.
// Keep planes contiguous for RAM surfaces: right overscan can cross scanlines.
export class JungleRaster {
  constructor(resources) {
    this.resources = resources;
    this.pages = [surface(40, 200, 8192), surface(40, 200, 8192)];
    this.background = surface(40, 200);
    this.forest = surface(16, 176);
    this.pending = [];
    const image = renderFlightPixels(
      [
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
      ],
      resources.entries,
      resources.font,
      "JG.ARC",
    );
    for (let y = 0; y < 176; y++)
      for (let x = 0; x < 104; x++) {
        const at = (y * 320 + x + 56) * 4;
        pixel(
          this.forest,
          x,
          y,
          colors.get(image[at] * 65536 + image[at + 1] * 256 + image[at + 2]),
        );
      }
  }
  flush() {
    if (!this.pending.length) return;
    overlay(
      this.active,
      renderFlightPixels(
        this.pending,
        this.resources.entries,
        this.resources.font,
        "JG.ARC",
      ),
    );
    this.pending = [];
  }
  begin(m, color, effects = {}) {
    if (this.frameOpen) throw Error("Unfinished jungle raster frame");
    const pointer = (at) => m.view.getUint16(at, true),
      handle = pointer(0x2038);
    const segment = pointer(handle + 6);
    if (segment !== 0xa000 && segment !== 0xa200)
      throw Error(`Unsupported jungle video page ${segment.toString(16)}`);
    this.activePage = segment === 0xa000 ? 0 : 1;
    this.active = this.pages[this.activePage];
    this.frameOpen = true;
    const surfaces = new Map([
      [handle, this.active],
      [pointer(0x203a), this.background],
      [pointer(0x7118), this.forest],
    ]);
    const assets = new Map(
      [...JUNGLE_SPRITES].map(([at, asset]) => [pointer(at), asset]),
    );
    return {
      ...effects,
      color,
      draw: (resource) => {
        const asset = assets.get(resource);
        if (asset === undefined)
          throw Error(
            `Unloaded jungle raster resource ${resource.toString(16)}`,
          );
        this.pending.push({
          op: "sprite",
          asset,
          frame: m.b(resource + 18),
          x: m.i(resource),
          y: m.i(resource + 2),
        });
      },
      line: (command) => this.pending.push({ op: "line", ...command }),
      text: (command) => this.pending.push({ op: "text", ...command }),
      copy: (command) => {
        this.flush();
        const from = surfaces.get(command.from),
          to = surfaces.get(command.to);
        if (!from || !to) throw Error("Unsupported jungle copy surface");
        this.copy(from, to, command);
      },
    };
  }
  copy(from, to, { sourceX, sourceY, x, y, width, height }) {
    if (
      ![sourceX, sourceY, x, y, width, height].every(Number.isInteger) ||
      [sourceX, sourceY, x, y, width, height].some((v) => v < 0)
    )
      throw Error("Unsupported jungle framebuffer copy rectangle");
    const bytes = width >>> 3,
      rows = Math.min(height, 200 - y);
    if (rows <= 0) return;
    if (from === to)
      throw Error("Unsupported overlapping jungle framebuffer copy");
    for (let p = 0; p < 4; p++)
      for (let row = 0; row < rows; row++) {
        const src =
          p * from.planeSize + (sourceY + row) * from.stride + (sourceX >>> 3);
        const dest = p * to.planeSize + (y + row) * to.stride + (x >>> 3);
        if (src + bytes > from.bytes.length || dest + bytes > to.bytes.length)
          throw Error(
            "Jungle framebuffer copy reads outside allocated storage",
          );
        for (let i = src; i < src + bytes; i++)
          if (from.known[i] !== 255)
            throw Error("Uninitialized jungle framebuffer copy source");
        to.bytes.set(from.bytes.subarray(src, src + bytes), dest);
        to.known.fill(255, dest, dest + bytes);
      }
  }
  finish({ copyToOtherPage = false } = {}) {
    if (!this.frameOpen) throw Error("Missing jungle raster frame");
    this.flush();
    if (copyToOtherPage) {
      this.pages[this.activePage ^ 1].bytes.set(this.active.bytes);
      this.pages[this.activePage ^ 1].known.set(this.active.known);
    }
    this.frameOpen = false;
  }
  pixels(palette = EGA, page = this.activePage) {
    if (this.frameOpen) throw Error("Unfinished jungle raster frame");
    if (!this.pages[page] || palette?.length !== 16)
      throw Error("Invalid jungle raster page/palette");
    const source = this.pages[page],
      rgba = new Uint8ClampedArray(320 * 200 * 4);
    for (let y = 0; y < 200; y++)
      for (let x = 0; x < 320; x++) {
        const at = y * 40 + (x >> 3),
          mask = 128 >> (x & 7);
        let color = 0;
        for (let p = 0; p < 4; p++) {
          if (!(source.known[p * 8192 + at] & mask))
            throw Error("Uninitialized jungle framebuffer pixel");
          if (source.bytes[p * 8192 + at] & mask) color |= 1 << p;
        }
        rgba.set([...palette[color], 255], (y * 320 + x) * 4);
      }
    return rgba;
  }
}
