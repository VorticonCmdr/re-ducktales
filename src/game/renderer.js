import { executableText } from "./executable.js";
import { imagePixels, EGA } from "../assets.js";
export class Renderer {
  constructor(canvas, resources) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.resources = resources;
    this.cache = new Map();
    if (!this.ctx) throw Error("Canvas 2D is unavailable");
    this.font = resources.archives.get("MAIN.ARC")[42].data;
  }
  image(archive, index, frame = 0, transparent = -1) {
    if (transparent === -2)
      transparent = this.resources.archives.get(archive)[index].data[0] >> 4;
    const key = `${archive}:${index}:${frame}:${transparent}`;
    if (!this.cache.has(key)) {
      const entry = this.resources.archives.get(archive)?.[index];
      if (!entry) throw Error(`Missing asset ${key}`);
      const surface = document.createElement("canvas");
      surface.width = entry.width;
      surface.height = entry.height;
      let pixels;
      if (archive === "MBIN.ARC" && index === 10 && frame >= 7 && frame < 14) {
        // Overlay 9 passes 7–13 to a seven-frame strip. The EGA driver does
        // unchecked linear frame addressing, advancing one scanline.
        pixels = new Uint8ClampedArray(entry.width * entry.height * 4);
        for (let y = 0; y < entry.height; y++)
          for (let x = 0; x < entry.width; x++) {
            const at =
              ((y * entry.frames + frame) * entry.width) / 2 + (x >> 1);
            if (at >= entry.data.length) continue;
            const color = x % 2 ? entry.data[at] & 15 : entry.data[at] >> 4;
            pixels.set(
              [...EGA[color], color === transparent ? 0 : 255],
              (y * entry.width + x) * 4,
            );
          }
      } else pixels = imagePixels(entry, frame, transparent);
      surface
        .getContext("2d")
        .putImageData(new ImageData(pixels, entry.width, entry.height), 0, 0);
      this.cache.set(key, surface);
    }
    return this.cache.get(key);
  }
  draw(archive, index, frame, x, y, transparent = -1) {
    this.ctx.drawImage(this.image(archive, index, frame, transparent), x, y);
  }
  text(text, x, y, color = "#fff") {
    this.ctx.fillStyle = color;
    for (const char of text) {
      const glyph = char.charCodeAt(0);
      if (glyph > 255) throw Error(`Unsupported font character ${char}`);
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
          if (this.font[8 + glyph * 8 + row] & (128 >> col))
            this.ctx.fillRect(x + col, y + row, 1, 1);
      x += 8;
    }
  }
  render(game) {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, 320, 200);
    if (game.scene === "title") {
      this.draw("MAIN.ARC", 2, 0, 0, 0);
      return;
    }
    if (game.scene === "difficulty") {
      this.draw("MAIN.ARC", 32, 0, 0, 0);
      this.text("CHOOSE DIFFICULTY:", 168, 60);
      ["Easy Money", "Standard Wages", "Hard Earned Cash"].forEach((s, i) =>
        this.text(
          `${game.difficulty === i ? ">" : " "}${s}`,
          160,
          80 + i * 20,
          game.difficulty === i ? "#ff5555" : "#fff",
        ),
      );
      return;
    }
    if (game.scene === "office") {
      this.draw("MAIN.ARC", 3, 0, 0, 0);
      for (const [asset, x, y] of [
        [8, 216, 32],
        [4, 120, 8],
        [5, 33, 48],
        [6, 136, 32],
        [7, 120, 48],
      ])
        this.draw("MAIN.ARC", asset, 0, x, y, -2);
      return;
    }
    if (game.scene === "map") {
      const c = game.campaign,
        selected = c.locations[c.selected];
      this.draw("MAIN.ARC", c.location === 35 ? 20 : 21, 0, 0, 0);
      if (!c.info) {
        this.draw("MAIN.ARC", 22, 0, 24, 20);
        for (const l of c.locations) {
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(l.x - 1, l.y - 1, 5, 5);
          this.ctx.fillStyle = "#0000aa";
          this.ctx.fillRect(l.x, l.y, 3, 3);
        }
        this.draw("MAIN.ARC", 24, 0, 22, 115, -2);
        if (c.selected !== 35) {
          this.ctx.fillStyle = "#ffff55";
          this.ctx.fillRect(selected.x - 1, selected.y - 1, 5, 5);
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(selected.x, selected.y, 3, 3);
        }
      } else {
        selected.description.forEach((line, i) =>
          this.text(line, 32, 22 + i * 8),
        );
        this.text(
          `TRAVEL TIME: ${c.snapshot().travelDays} day${c.snapshot().travelDays === 1 ? "" : "s"}`,
          32,
          30 + selected.description.length * 8,
        );
        this.draw("MAIN.ARC", 26, 0, 192, 170, -2);
        this.draw("MAIN.ARC", 27, 0, 248, 174, -2);
        this.ctx.strokeStyle = "#fff";
        this.ctx.strokeRect(
          c.choice === 0 ? 191 : 247,
          c.choice === 0 ? 169 : 173,
          c.choice === 0 ? 53 : 34,
          c.choice === 0 ? 28 : 19,
        );
      }
      const title = c.selected === 35 ? "OFFICE" : selected.name;
      this.text(title, 160 - title.length * 4, 6, c.info ? "#0000aa" : "#fff");
      this.draw("MAIN.ARC", 25, 0, 8, 175, -2);
      this.draw("MAIN.ARC", 23, 0, 40, 172, -2);
      this.text(String(c.day), c.day < 10 ? 18 : 14, 182, "#0000aa");
      this.text(String(game.money), 176 - String(game.money).length * 8, 175);
      if (!c.info)
        this.draw("MAIN.ARC", 28, 0, c.cursor.x - 8, c.cursor.y - 8, -2);
      return;
    }
    if (game.scene === "departure") {
      this.draw("MAIN.ARC", 30, 0, 0, 0);
      game.departure.speechOffsets.forEach((offset, i) =>
        this.text(
          executableText(this.resources.executable, offset),
          168,
          60 + i * 16,
        ),
      );
      return;
    }
    if (game.scene === "money-bin") {
      this.draw("MBIN.ARC", 0, 0, 0, 0);
      for (const s of game.bin.current.sprites)
        this.draw("MBIN.ARC", s.asset, s.frame, s.x, s.y, -2);
      return;
    }
    throw Error(`Unsupported scene ${game.scene}`);
  }
}
