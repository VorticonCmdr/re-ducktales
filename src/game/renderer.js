import { executableText } from "./executable.js";
import { imagePixels, EGA } from "../assets.js";
import { renderFlightPixels } from "./flight-raster.js";
import {
  renderMountainPixels,
  createMountainRasterCache,
} from "./mountain-scene.js";
import { investmentPrice } from "./investments.js";
import { systemOverlayLayout } from "./system-controls.js";
import { endingTransitionPixels } from "./ending-presentation.js";
import { destinationCommands } from "./destination-presentation.js";
export class Renderer {
  constructor(canvas, resources) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.resources = resources;
    this.cache = new Map();
    this.mountainRasterCache = createMountainRasterCache();
    this.destinationCache = null;
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
  text(text, x, y, color = "#fff", linear = false) {
    this.ctx.fillStyle = color;
    for (const char of text) {
      const glyph = char.charCodeAt(0);
      if (glyph > 255) throw Error(`Unsupported font character ${char}`);
      for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
          if (this.font[8 + glyph * 8 + row] & (128 >> col)) {
            const pixelX = x + col;
            // The original EGA address advances into the next scanline when
            // a raw out-of-table report name extends beyond320 pixels.
            this.ctx.fillRect(
              linear ? ((pixelX % 320) + 320) % 320 : pixelX,
              y + row + (linear ? Math.floor(pixelX / 320) : 0),
              1,
              1,
            );
          }
      x += 8;
    }
  }
  renderInvestments(game) {
    const screen = game.investments,
      m = screen.memory;
    const original = (at) => executableText(this.resources.executable, at);
    const textAt = (at, x, y, color = "#fff") =>
      this.text(original(at), x, y, color);
    const number = (n, right, y, color = "#fff") =>
      this.text(String(n), right - String(n).length * 8, y, color);
    if (screen.phase === "broker") {
      this.draw("MAIN.ARC", 32, 0, 0, 0);
      [0x1c39, 0x1c47, 0x1c55, 0x1c64].forEach((at, i) =>
        textAt(at, 176, 60 + i * 16),
      );
      return;
    }
    this.draw("MAIN.ARC", 20, 0, 0, 0);
    this.draw("MAIN.ARC", 25, 0, 8, 175, -2);
    this.text(
      String(game.campaign.day),
      game.campaign.day < 10 ? 18 : 14,
      182,
      "#0000aa",
    );
    this.draw("MAIN.ARC", 23, 0, 40, 172, -2);
    number(game.money, 175, 175);
    if (screen.phase === "portfolio") {
      textAt(0x1c82, 100, 8, "#0000aa");
      textAt(0x1c92, 40, 22);
      textAt(0x1c9f, 196, 22);
      textAt(0x1ca5, 244, 22);
      for (let row = 0; row < 6; row++) {
        const company = (screen.top + row) & 15,
          y = 40 + row * 20;
        if (company === screen.selected) {
          this.ctx.fillStyle = "#aa0000";
          this.ctx.fillRect(32, y, 256, 8);
        }
        if (company === 15) textAt(0x1ccd, 32, y, "#00aa00");
        else {
          this.text(screen.resources.companies[company].name, 32, y);
          number(investmentPrice(m, company), 248, y);
          number(m.i(0x92d4 + company * 46), 280, y);
        }
      }
      return;
    }
    const at = 0x92b2 + screen.company * 46;
    if (screen.phase === "news") {
      textAt(0x1ec7, 96, 8);
      this.text(original(0x1ed8) + m.i(at + 40), 56, 22, "#ffff55");
      const positive = screen.newsStatus === 1 || screen.newsStatus === 3;
      screen.resources.companies[screen.company].lines
        .slice(positive ? 8 : 10, positive ? 10 : 12)
        .forEach((line, i) => this.text(line, 32, 35 + i * 10));
      if (screen.newsStatus < 3)
        this.text(
          original(positive ? 0x1e45 : 0x1e57) + m.i(at + 44) + "%",
          80,
          100,
          "#ffff55",
        );
      else {
        textAt(positive ? 0x1e6b : 0x1e99, 48, 100, "#ffff55");
        this.text(
          original(positive ? 0x1e87 : 0x1eb5) + m.i(at + 42),
          56,
          110,
          "#ffff55",
        );
      }
      return;
    }
    if (screen.phase !== "company")
      throw Error(`Unsupported investment presentation ${screen.phase}`);
    const name = screen.resources.companies[screen.company].name;
    this.text(name, 160 - name.length * 4, 8, "#ff5555");
    this.ctx.fillStyle = "#0000aa";
    for (const y of [23, 100, 127]) this.ctx.fillRect(32, y, 256, 8);
    textAt(0x1ce9, 32, 23);
    screen.resources.companies[screen.company].lines
      .slice(2, 8)
      .forEach((line, i) => this.text(line, 32, 35 + i * 10));
    textAt(0x1d0a, 32, 100);
    this.text(
      String(game.money) + ".00",
      104 - String(game.money).length * 4,
      113,
      "#ffff55",
    );
    this.text(String.fromCharCode(65 + m.i(at + 38)), 224, 113);
    textAt(0x1d2e, 32, 127);
    this.text(investmentPrice(m, screen.company) + ".00", 88, 140);
    this.text(String(m.i(at + 34)), 224, 140, "#ffff55");
    if (screen.message)
      textAt(
        [0, 0x1d53, 0x1db6, 0x1d95, 0x1dd7, 0x1df8, 0x1e19][screen.message],
        32,
        150,
        "#ffff55",
      );
    this.draw("INVART.ARC", 0, 0, 192, 175, -2);
    this.draw("INVART.ARC", screen.message === 3 ? 2 : 1, 0, 224, 175, -2);
    this.draw("INVART.ARC", screen.message === 2 ? 4 : 3, 0, 256, 175, -2);
    this.ctx.strokeStyle = "#ff5555";
    this.ctx.strokeRect(192 + screen.button * 32, 174, 25, 20);
  }
  render(game) {
    this.renderScene(game);
    if (!game.systemOverlay || game.systemOverlay.phase === "resuming") return;
    const { box, fill, rows } = systemOverlayLayout(game.systemOverlay.kind);
    this.ctx.fillStyle = "#0000aa";
    this.ctx.fillRect(fill.x, fill.y, fill.width, fill.height);
    for (const row of rows)
      this.text(
        executableText(this.resources.executable, row.at),
        row.x,
        row.y,
      );
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(box.x, box.y, box.width, 1);
    this.ctx.fillRect(box.x, box.y + box.height - 1, box.width, 1);
    this.ctx.fillRect(box.x, box.y, 1, box.height);
    this.ctx.fillRect(box.x + box.width - 1, box.y, 1, box.height);
  }
  endingFrame(e) {
    const key = `ending:${e.phase}:${e.asset}:${e.choice}:${e.credit}:${!!e.clearFooter}`;
    if (!this.cache.has(key)) {
      const surface = document.createElement("canvas");
      surface.width = 320;
      surface.height = 200;
      const previous = this.ctx;
      this.ctx = surface.getContext("2d", { alpha: false });
      try {
        if (e.phase === "blank") {
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, 320, 200);
        } else if (e.asset !== null) {
          this.draw("MAIN.ARC", e.asset, 0, 0, 0);
          if (e.phase === "credits" && (e.credit >= 0 || e.clearFooter)) {
            this.ctx.fillStyle = "#0000aa";
            this.ctx.fillRect(0, 192, 320, 8);
            if (e.credit >= 0)
              this.text(
                executableText(
                  this.resources.executable,
                  0x79e + e.credit * 26,
                ),
                64,
                192,
              );
          }
        } else if (e.phase === "replay") {
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, 320, 200);
          this.text(executableText(this.resources.executable, 0xa42), 112, 70);
          this.text(
            executableText(
              this.resources.executable,
              e.choice === 0 ? 0xa4e : 0xa56,
            ),
            e.choice === 0 ? 136 : 144,
            100,
            e.choice === 0 ? "#ff5555" : "#fff",
          );
          this.text(
            executableText(
              this.resources.executable,
              e.choice === 0 ? 0xa53 : 0xa5a,
            ),
            e.choice === 0 ? 144 : 136,
            120,
            e.choice === 0 ? "#fff" : "#ff5555",
          );
        } else throw Error(`Unsupported ending presentation ${e.phase}`);
      } finally {
        this.ctx = previous;
      }
      this.cache.set(key, {
        surface,
        pixels: surface.getContext("2d").getImageData(0, 0, 320, 200).data,
      });
    }
    return this.cache.get(key);
  }
  renderScene(game) {
    if (game.scene === "office" && game.officeMenu) {
      if (this.officeMenuSource !== game.officeMenu) {
        this.officeMenuSource = game.officeMenu;
        // Presentation history supplies only the old visible page to the wipe.
        // It never feeds input, clocks, RNG or simulation state.
        this.officeMenuIncoming = this.ctx.getImageData(0, 0, 320, 200).data;
      }
      this.ctx.putImageData(
        new ImageData(
          game.officeMenu.pixels(this.officeMenuIncoming),
          320,
          200,
        ),
        0,
        0,
      );
      return;
    }
    if (game.scene === "bank") {
      const b = game.bank;
      const entries = this.resources.archives.get("MAC.ARC");
      this.bankRasterCache ??= new WeakMap();
      const render = (commands) =>
        renderFlightPixels(
          commands,
          entries,
          this.font,
          "MAC.ARC",
          this.bankRasterCache,
        );
      let pixels;
      if (b.transition) {
        const t = b.transition;
        let source;
        if (t.source) source = render(t.source);
        else {
          if (
            this.bankTransitionGame !== b ||
            this.bankTransitionToken !== t.token
          ) {
            this.bankTransitionGame = b;
            this.bankTransitionToken = t.token;
            this.bankTransitionSource = this.ctx.getImageData(
              0,
              0,
              320,
              200,
            ).data;
          }
          source = this.bankTransitionSource;
        }
        pixels = endingTransitionPixels(t, source, render(t.target));
      } else pixels = render(b.frame);
      this.ctx.putImageData(new ImageData(pixels, 320, 200), 0, 0);
      return;
    }
    if (game.scene === "ending") {
      const e = game.ending;
      if (e.transition) {
        const t = e.transition;
        let source;
        if (t.source) source = this.endingFrame(t.source).pixels;
        else {
          if (
            this.endingTransitionGame !== e ||
            this.endingTransitionToken !== t.token
          ) {
            this.endingTransitionGame = e;
            this.endingTransitionToken = t.token;
            this.endingTransitionSource = this.ctx.getImageData(
              0,
              0,
              320,
              200,
            ).data;
          }
          source = this.endingTransitionSource;
        }
        const target = this.endingFrame(t.target).pixels;
        const pixels = endingTransitionPixels(t, source, target);
        this.ctx.putImageData(new ImageData(pixels, 320, 200), 0, 0);
      } else
        this.ctx.drawImage(
          this.endingFrame(e.visible ?? e.describe()).surface,
          0,
          0,
        );
      return;
    }
    if (game.scene === "investments") {
      this.renderInvestments(game);
      return;
    }
    if (game.scene === "photography") {
      const p = game.photography;
      if (p.current) {
        let pixels = p.current;
        if (p.presentationMode === "overlay") {
          if (
            this.photographyWipeGame !== p ||
            this.photographyWipeToken !== p.wipeToken
          ) {
            this.photographyWipeGame = p;
            this.photographyWipeToken = p.wipeToken;
            this.photographyWipeSource = this.ctx.getImageData(
              0,
              0,
              320,
              200,
            ).data;
          }
          const composite = Uint8ClampedArray.from(this.photographyWipeSource);
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 3]) composite.set(pixels.subarray(i, i + 4), i);
          pixels = composite;
        }
        this.ctx.putImageData(new ImageData(pixels, 320, 200), 0, 0);
      }
      return;
    }
    if (game.scene === "jungle") {
      if (game.jungle.current) {
        let pixels = game.jungle.current;
        if (game.jungle.presentationMode === "overlay") {
          if (
            this.jungleWipeGame !== game.jungle ||
            this.jungleWipeToken !== game.jungle.wipeToken
          ) {
            this.jungleWipeGame = game.jungle;
            this.jungleWipeToken = game.jungle.wipeToken;
            this.jungleWipeSource = this.ctx.getImageData(0, 0, 320, 200).data;
          }
          const composite = Uint8ClampedArray.from(this.jungleWipeSource);
          for (let i = 0; i < pixels.length; i += 4)
            if (pixels[i + 3]) composite.set(pixels.subarray(i, i + 4), i);
          pixels = composite;
        }
        this.ctx.putImageData(new ImageData(pixels, 320, 200), 0, 0);
      }
      return;
    }
    if (game.scene === "mountain") {
      if (game.mountain.current)
        this.ctx.putImageData(
          new ImageData(
            renderMountainPixels(
              game.mountain.current,
              game.mountain.entries,
              this.font,
              game.mountain.memory,
              this.mountainRasterCache,
            ),
            320,
            200,
          ),
          0,
          0,
        );
      return;
    }
    if (game.scene === "cave") {
      if (game.cave.current)
        this.ctx.putImageData(
          new ImageData(
            renderFlightPixels(
              game.cave.current,
              this.resources.archives.get("EXP.ARC"),
              this.font,
              "EXP.ARC",
            ),
            320,
            200,
          ),
          0,
          0,
        );
      return;
    }
    if (game.scene === "flight") {
      if (game.flight.current)
        this.ctx.putImageData(
          new ImageData(
            renderFlightPixels(
              game.flight.current,
              this.resources.archives.get("PLANE.ARC"),
              this.font,
            ),
            320,
            200,
          ),
          0,
          0,
        );
      return;
    }
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, 320, 200);
    if (game.scene === "title") {
      if (game.opening)
        this.ctx.putImageData(
          new ImageData(game.opening.pixels(), 320, 200),
          0,
          0,
        );
      else this.draw("MAIN.ARC", 2, 0, 0, 0);
      return;
    }
    if (game.scene === "difficulty") {
      if (game.difficultyMenu) {
        this.ctx.putImageData(
          new ImageData(game.difficultyMenu.pixels(), 320, 200),
          0,
          0,
        );
        return;
      }
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
    if (game.scene === "security") {
      this.ctx.putImageData(
        new ImageData(game.security.pixels(), 320, 200),
        0,
        0,
      );
      return;
    }
    if (game.scene === "office-departure") {
      const pixels = renderFlightPixels(
        game.officeDeparture.frame,
        this.resources.archives.get("MAIN.ARC"),
        this.font,
        "MAIN.ARC",
      );
      this.ctx.putImageData(new ImageData(pixels, 320, 200), 0, 0);
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
      if (c.info) {
        const waits = c.destinationWaits;
        if (!waits) throw Error("Missing destination presentation timing");
        if (this.destinationSource !== waits) {
          this.destinationSource = waits;
          this.destinationIncoming = this.ctx.getImageData(0, 0, 320, 200).data;
        }
        const key = JSON.stringify([
          c.selected,
          c.day,
          game.money,
          waits.visibleChoice,
          c.atomicAvailable,
          selected.playerCollected,
          selected.rivalCollected,
          c.snapshot().travelDays,
        ]);
        if (this.destinationCache?.key !== key) {
          const commands = destinationCommands({
            image: this.resources.executable,
            location: selected,
            treasure: game.loot?.[selected.treasure - 1],
            bank: c.selected === 0,
            collected: selected.playerCollected || selected.rivalCollected,
            days: c.snapshot().travelDays,
            day: c.day,
            money: game.money,
            choice: waits.visibleChoice,
            atomicAvailable: c.atomicAvailable,
          });
          this.destinationCache = {
            key,
            pixels: renderFlightPixels(
              commands,
              this.resources.archives.get("MAIN.ARC"),
              this.font,
              "MAIN.ARC",
            ),
          };
        }
        const pixels = waits.transition
          ? endingTransitionPixels(
              waits.transition,
              this.destinationIncoming,
              this.destinationCache.pixels,
            )
          : this.destinationCache.pixels;
        this.ctx.putImageData(new ImageData(pixels, 320, 200), 0, 0);
        return;
      }
      this.draw("MAIN.ARC", c.location === 35 ? 20 : 21, 0, 0, 0);
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
      const title = c.selected === 35 ? "OFFICE" : selected.name;
      this.text(title, 160 - title.length * 4, 6, "#fff");
      this.draw("MAIN.ARC", 25, 0, 8, 175, -2);
      this.draw("MAIN.ARC", 23, 0, 40, 172, -2);
      this.text(String(c.day), c.day < 10 ? 18 : 14, 182, "#0000aa");
      this.text(String(game.money), 176 - String(game.money).length * 8, 175);
      this.draw("MAIN.ARC", 28, 0, c.cursor.x - 8, c.cursor.y - 8, -2);
      return;
    }
    if (game.scene === "atomic-transport") {
      if (game.atomicTransport.phase !== "report") return;
      this.draw("MAIN.ARC", 41, 0, 0, 0);
      [0x147, 0x159, 0x166, 0x174].forEach((at, i) =>
        this.text(
          executableText(this.resources.executable, at),
          168,
          60 + i * 16,
        ),
      );
      const name = game.campaign.locations[game.atomicTransport.target].name;
      this.text(name, 232 - name.length * 4, 124);
      this.text(
        executableText(this.resources.executable, 0x184),
        232 + name.length * 4,
        124,
      );
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
    if (game.scene === "visit-notice") {
      this.draw("MAIN.ARC", game.visitNotice.portrait, 0, 0, 0);
      for (const { at, x, y } of game.visitNotice.rows)
        this.text(executableText(this.resources.executable, at), x, y);
      return;
    }
    if (game.scene === "expedition-briefing") {
      this.draw("MAIN.ARC", 31, 0, 0, 0);
      this.text(
        executableText(this.resources.executable, 0x582),
        24,
        12,
        "#000",
      );
      this.text(
        executableText(this.resources.executable, game.briefing.chapter),
        24,
        24,
        "#000",
      );
      game.briefing.lines.forEach((line, i) =>
        this.text(line, 20, 40 + i * 12, "#0000aa"),
      );
      return;
    }
    if (["rival-claim", "rival-report"].includes(game.scene)) {
      this.draw("MAIN.ARC", 33, 0, 0, 0);
      const report =
        game.scene === "rival-report" ? game.rivalReport : game.claim;
      const offsets = report.variant ? [0x52c, 0x538] : [0x541, 0x552];
      offsets.forEach((at, i) =>
        this.text(
          executableText(this.resources.executable, at),
          168,
          60 + i * 16,
        ),
      );
      this.text(executableText(this.resources.executable, 0x562), 168, 100);
      this.text(executableText(this.resources.executable, 0x571), 168, 116);
      const name =
        report.name ??
        game.campaign.locations[
          game.scene === "rival-report" ? report.target : game.departure.target
        ].name;
      const linear = game.scene === "rival-report" && report.target === 35;
      this.text(name, 224 - name.length * 4, 132, "#fff", linear);
      this.text(
        executableText(this.resources.executable, 0x57f),
        224 + name.length * 4,
        132,
        "#fff",
        linear,
      );
      return;
    }
    if (game.scene === "expedition-result") {
      const r = game.expeditionResult;
      if (r.phase === "failure") {
        this.draw("MAIN.ARC", 34, 0, 0, 0);
        this.text(executableText(this.resources.executable, 0x1820), 176, 60);
        this.text(executableText(this.resources.executable, 0x1832), 188, 76);
      } else if (r.phase === "award") {
        this.draw("MAIN.ARC", 35, 0, 0, 0);
        [0x2c5, 0x2d6, 0x2e8, 0x2f9].forEach((at, i) =>
          this.text(
            executableText(this.resources.executable, at),
            168,
            60 + i * 16,
          ),
        );
        this.text(executableText(this.resources.executable, 0x306), 208, 128);
        this.text(String(r.value), 216, 128);
      } else if (r.phase === "atomic") {
        this.draw("MAIN.ARC", 41, 0, 0, 0);
        [
          0x308, 0x315, 0x320, 0x32d, 0x33b, 0x350, 0x35c, 0x36d, 0x37b, 0x388,
          0x398,
        ].forEach((at, i) =>
          this.text(
            executableText(this.resources.executable, at),
            160,
            [16, 32, 48, 64, 80, 96, 112, 128, 146, 162, 180][i],
          ),
        );
      } else throw Error(`Unsupported expedition report ${r.phase}`);
      return;
    }
    if (game.scene === "crash-repairs") {
      const repair = game.repairs.phase === "repair";
      this.draw("MAIN.ARC", repair ? 41 : 32, 0, 0, 0);
      const offsets = repair
        ? [0x1f5, 0x208, 0x219, 0x227]
        : [
            0x232,
            0x244,
            0x256,
            ...(game.repairs.loss ? [0x285, 0x295] : [0x268, 0x278]),
            0x29c,
            0x2a8,
          ];
      offsets.forEach((at, i) =>
        this.text(
          executableText(this.resources.executable, at),
          168,
          (repair ? 60 : 44) + i * 16,
        ),
      );
      if (!repair && game.repairs.loss)
        this.text(String(game.repairs.loss), 216, 108);
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
