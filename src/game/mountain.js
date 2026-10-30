import {
  prepareMountain,
  composeMountainViewport,
  setMountainLifePalette,
} from "./mountain-scene.js";
import {
  MountainLocals,
  advanceMountainAction,
  updateMountainPosition,
} from "./mountain-actions.js";
import { advanceMountainHazards } from "./mountain-hazards.js";
import { u16, s16 } from "./integer.js";
import { egaSpriteWork, normalCoreGraphicsMilliseconds } from "./ega-work.js";
import { ORIGINAL_GRAPHICS_TIMING } from "./timing.js";
import { eraseMountainSource } from "./mountain-erase.js";
import { egaSignedCopyWork } from "./ega-copy-work.js";
import { drawMountainHudSource, mountainMoneyCall } from "./mountain-hud.js";
import { egaLinePrimitiveWork } from "./ega-line-work.js";
import {
  originalHudNumberWork,
  formatOriginalHudNumber,
} from "./hud-number-work.js";

const emptyCopyWork = () => ({
  instructions: 0,
  portWrites: 0,
  repeatOpcodes: 0,
  repeatIterations: 0,
  calls: 0,
});

const SPRITES = new Map([
  [0x36f2, 1],
  [0x5c48, 2],
  [0x5ce8, 3],
  [0x3720, 12],
  ...[5, 6, 7, 8, 9, 10, 11, 13, 14, 15].map((id, i) => [0x5804 + i * 20, id]),
  [0x36d6, 16],
  [0x370c, 17],
]);

export class Mountain {
  constructor(options, previousMemory) {
    this.graphicsTiming = options.graphicsTiming ?? ORIGINAL_GRAPHICS_TIMING;
    if (
      !Number.isInteger(this.graphicsTiming.cyclesPerMillisecond) ||
      this.graphicsTiming.cyclesPerMillisecond < 1 ||
      !Number.isFinite(this.graphicsTiming.retraceHz) ||
      this.graphicsTiming.retraceHz <= 0
    )
      throw Error("Invalid mountain graphics timing provider");
    this.pollInput = options.pollInput ?? (() => true);
    this.onFlushInput = options.flushInput ?? (() => {});
    this.controls = { fire: false, direction: null };
    this.readInputByte =
      options.readInput ??
      (() =>
        (({ up: 1, right: 3, down: 5, left: 7 })[this.controls.direction] ??
          0) | (this.controls.fire ? 0x40 : 0));
    if (typeof this.readInputByte !== "function")
      throw Error("Invalid mountain input-byte provider");

    this.flushInput(); // Original entry0014,before synchronous resource loading.
    Object.assign(this, prepareMountain(options, previousMemory));
    if (!Number.isInteger(options.day) || options.day < 1 || options.day > 30)
      throw Error("Invalid mountain campaign day");
    if (
      options.mainEntries?.[23]?.type !== 2 ||
      options.mainEntries?.[25]?.type !== 2
    )
      throw Error("Missing mountain MAIN HUD resources");
    this.entries = [
      ...options.entries,
      options.mainEntries[23],
      options.mainEntries[25],
    ];
    const font = options.mainEntries[42]?.data;
    if (font?.length !== 2056 || font[2] !== 8 || font[4] !== 8)
      throw Error("Unsupported mountain HUD font");
    // Original SS allocation contents are an explicit conditional-comparison
    // input. Independent runs use the documented zero-filled stack provider.
    this.locals = new MountainLocals(options.stackBytes);
    this.locals.b(-0x24, 1);
    this.locals.b(-0x2c, 0);
    this.memory.b(0x4e0e, options.day);
    this.audioEnabled = options.audioEnabled === true;
    this.events = [];
    this.pendingCopyWork = emptyCopyWork();
    this.inputs = [];
    this.tick = 0;
    this.retrace = 0;
    this.frames = 0;
    this.presentations = 0;
    this.phase = "entering";
    this.terrainCache = new Map();
    this.current = null;
    this.outcome = null;
    this.lifeDeadline = 0;
    this.flushInput(); // Post-load016a,before the first life deadline.
    this.iterator = this.run();
    this.resume();
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "right", "down", "left"].includes(controls.direction)
    )
      throw Error("Invalid mountain controls");
    this.controls = { ...controls };
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid mountain audio enable");
    this.audioEnabled = enabled;
  }
  sound(id) {
    if (this.audioEnabled) this.events.push({ type: "sound", id });
  }
  drainEvents() {
    return this.events.splice(0);
  }
  resume() {
    const result = this.iterator.next();
    if (result.done) {
      this.outcome = result.value;
      this.phase = "complete";
      this.wait = null;
    } else {
      if (
        !["driver", "retrace", "input"].includes(result.value.clock) ||
        !Number.isInteger(result.value.remaining) ||
        result.value.remaining < 1
      )
        throw Error("Invalid mountain wait");
      this.wait = result.value;
    }
  }
  advanceTick() {
    this.tick++;
    this.advance("driver");
  }
  advanceRetrace() {
    this.retrace++;
    this.advance("retrace");
  }
  advanceBlockedTick() {
    this.tick++;
  }
  advanceBlockedRetrace() {
    this.retrace++;
  }
  *readInput() {
    if (!this.pollInput()) yield { clock: "input", remaining: 1 };
  }
  resumeInputPoll() {
    if (this.wait?.clock !== "input")
      throw Error("Mountain resumed outside its input reader");
    this.resume();
  }
  flushInput() {
    this.memory?.bytes.fill(0, 0x276c, 0x27ec);
    this.controls = { fire: false, direction: null };
    this.onFlushInput();
  }
  advance(clock) {
    if (!this.wait || this.wait.clock !== clock || --this.wait.remaining)
      return;
    if (this.pending) {
      this.current = this.pending;
      this.pending = null;
      this.presentations++;
    }
    this.resume();
  }
  *present(commands) {
    this.pending = commands;
    // The original starts the next update after its EGA retrace wait. Charge
    // source sprite opcodes before that wait, rather than one host redraw.
    // Erase copies use original source calls, including signed coordinates.
    // Composition copies,resident dispatch/color and caller CPU remain gaps.
    const work = {
      instructions:
        this.spriteWork.instructions +
        this.copyWork.instructions +
        this.hudWork.instructions,
      portWrites:
        this.spriteWork.portWrites +
        this.copyWork.portWrites +
        this.hudWork.portWrites,
      repeatOpcodes: this.copyWork.repeatOpcodes,
      repeatIterations: this.copyWork.repeatIterations,
    };
    const milliseconds = work.instructions
      ? normalCoreGraphicsMilliseconds(
          work,
          this.graphicsTiming.cyclesPerMillisecond,
        )
      : 0;
    const retraces = Math.max(
      1,
      Math.ceil((milliseconds * this.graphicsTiming.retraceHz) / 1000),
    );
    const spriteMilliseconds = this.spriteWork.instructions
      ? normalCoreGraphicsMilliseconds(
          this.spriteWork,
          this.graphicsTiming.cyclesPerMillisecond,
        )
      : 0;
    this.lastSpriteWork = {
      ...this.spriteWork,
      milliseconds: spriteMilliseconds,
      retraces: Math.max(
        1,
        Math.ceil((spriteMilliseconds * this.graphicsTiming.retraceHz) / 1000),
      ),
    };
    this.lastDrawingWork = {
      ...work,
      spriteCalls: this.spriteWork.calls,
      copyCalls: this.copyWork.calls,
      copyInstructions: this.copyWork.instructions,
      copyPortWrites: this.copyWork.portWrites,
      hudInstructions: this.hudWork.instructions,
      hudPortWrites: this.hudWork.portWrites,
      lineCalls: this.hudWork.lines,
      numberCalls: this.hudWork.numbers,
      milliseconds,
      retraces,
    };
    yield { clock: "retrace", remaining: retraces };
  }
  chargeSprite(asset, frame, x, y) {
    const work = egaSpriteWork(this.entries[asset], frame, x, y);
    this.spriteWork.instructions += work.instructions;
    this.spriteWork.portWrites += work.portWrites;
    this.spriteWork.calls++;
  }
  draw(commands, at, account = true) {
    const asset = SPRITES.get(at);
    if (asset === undefined)
      throw Error(`Unloaded mountain sprite DS:${at.toString(16)}`);
    const m = this.memory;
    if (account) this.chargeSprite(asset, m.b(at + 18), m.i(at), m.i(at + 2));
    commands.push({
      op: "sprite",
      asset,
      x: m.i(at),
      y: m.i(at + 2),
      frame: m.b(at + 18),
    });
  }
  hud(commands, account = true) {
    drawMountainHudSource(this.memory, {
      line: (c) => {
        if (account) this.chargeLine(c);
        commands.push({ op: "line", ...c });
      },
      draw: (at) => this.draw(commands, at, account),
      number: (c) => this.number(commands, c, account),
    });
  }
  chargeLine(c) {
    const cost = egaLinePrimitiveWork(c, this.memory.b(0x2046));
    this.hudWork.instructions += cost.instructions;
    this.hudWork.portWrites += cost.portWrites;
    this.hudWork.lines++;
  }
  number(commands, c, account = true) {
    const m = this.memory;
    const formatted = formatOriginalHudNumber(c);
    if (account) {
      if (m.b(0x2046) !== 0) throw Error("Unsupported mountain HUD scale");
      const video = m.view.getUint16(0x2038, true);
      const cost = originalHudNumberWork({
        ...c,
        surfaceOffset: m.view.getUint16(video + 4, true),
        backPage: m.b(0x2052) !== 0,
      });
      this.hudWork.instructions += cost.instructions;
      this.hudWork.portWrites += cost.portWrites;
      this.hudWork.numbers++;
    }
    commands.push({
      op: "text",
      text: formatted.text,
      x: formatted.x,
      y: c.y,
      color: c.color,
    });
  }
  frame(offset = 0, scrolling = false, opening = false) {
    this.spriteWork = { instructions: 0, portWrites: 0, calls: 0 };
    this.copyWork = this.pendingCopyWork;
    this.pendingCopyWork = emptyCopyWork();
    this.hudWork = { instructions: 0, portWrites: 0, lines: 0, numbers: 0 };
    const m = this.memory,
      l = this.locals;
    const key = `${l.b(-0x34)}:${offset}`;
    if (!this.terrainCache.has(key))
      this.terrainCache.set(
        key,
        composeMountainViewport(m, l.b(-0x34), offset),
      );
    const commands = [
      { op: "fill", color: 0, x: 0, y: 0, width: 320, height: 200 },
      ...this.terrainCache.get(key),
    ];
    // Reconstructing an unchanged HUD for Canvas is not an original draw call.
    // Opening pages call1744; ordinary frames draw just the cash footer1331.
    this.hud(commands, opening);
    if (!opening && !scrolling) {
      this.chargeSprite(16, 0, 40, 172);
      this.number([], mountainMoneyCall(m));
    }
    advanceMountainHazards(
      m,
      l.b(-0x34),
      offset,
      (at) => this.draw(commands, at),
      (id) => this.sound(id),
      () => this.hud(commands),
    );
    const at = m.i(0x6df0);
    m.i(at, m.i(0x5ae0));
    m.i(at + 2, m.i(0x5c72));
    m.b(at + 18, m.i(0x6d3c));
    if (m.i(0x6882) !== 10) this.draw(commands, at);
    if (m.b(0x6ed4)) {
      l.i(-0x3c, Math.max(0, Math.min(310, l.i(-0x3c))));
      l.i(-0x40, Math.max(0, Math.min(190, l.i(-0x40))));
      const line = {
        op: "line",
        color: 14,
        x: s16(m.i(0x5ae0) + l.i(-0x48)),
        y: s16(m.i(0x5c72) + l.i(-0x4a)),
        x2: l.i(-0x3c),
        y2: l.i(-0x40),
      };
      this.chargeLine(line);
      commands.push(line);
    }
    if (!scrolling && [4, 5].includes(m.i(0x6882))) {
      this.chargeSprite(4, l.b(-0x2e), l.i(-0x3c), l.i(-0x40) - 3);
      commands.push({
        op: "sprite",
        asset: 4,
        frame: l.b(-0x2e),
        x: l.i(-0x3c),
        y: l.i(-0x40) - 3,
      });
      if (l.i(-0x40) - 3 > 160) this.hud(commands);
    }
    if (scrolling) this.hud(commands);
    return commands;
  }
  remember() {
    const m = this.memory,
      index = m.b(0x370a);
    if (index > 1) throw Error("Invalid mountain page index");
    for (const [at, value] of [
      [0x36ea, m.i(0x5ae0)],
      [0x36ee, m.i(0x5c72)],
      [0x3734, m.i(0x6d3c)],
      [0x3706, m.i(0x6882)],
    ])
      m.i(at + index * 2, value);
    m.b(0x370a, index ^ 1);
  }
  eraseEffects() {
    eraseMountainSource(this.memory, this.locals.b(-0x34), (c) =>
      this.chargeCopy(c),
    );
  }
  chargeCopy(c) {
    const work = egaSignedCopyWork({
      width: c.width,
      height: c.height,
      sourceX: c.sourceX,
      sourceY: c.sourceY,
      destinationX: c.x,
      destinationY: c.y,
      sourceStrideBytes: 40,
      destinationStrideBytes: 40,
      sourceVideo: false,
      destinationVideo: true,
    });
    for (const k of [
      "instructions",
      "portWrites",
      "repeatOpcodes",
      "repeatIterations",
    ])
      this.pendingCopyWork[k] += work[k];
    this.pendingCopyWork.calls++;
  }
  resetLife() {
    const m = this.memory,
      l = this.locals;
    let column = 1;
    while (m.b(u16(m.i(0x57ee) + column)) === 0x46) column++;
    m.i(0x5c70, 0);
    m.i(0x6df0, 0x5c48);
    m.i(0x54f6, column);
    m.i(0x5ae0, column << 4);
    m.i(0x5c72, 131);
    m.i(0x6d3c, 20);
    m.i(0x6882, 0);
    for (let i = 0; i < 2; i++)
      for (const [at, value] of [
        [0x36ea, column << 4],
        [0x36ee, 131],
        [0x3734, 20],
        [0x3706, 0],
      ])
        m.i(at + i * 2, value);
    m.b(0x5c5a, 20);
    m.i(0x3d12, 0);
    l.b(-0x32, 0);
    m.b(0x6ed4, 0);
    l.i(-0x50, 0);
    l.b(-0x34, 0);
    for (let row = 0; row < 25; row++) {
      const at = u16(m.i(0x5d26) + row * 6);
      if ([4, 6].includes(m.b(at))) m.b(at + 1, 0);
    }
    m.b(0x17db, 0);
    m.b(0x17e1, 0);
    setMountainLifePalette(m);
    this.flushInput(); //0278 precedes both opening page presentations.
  }
  *scroll() {
    const m = this.memory,
      l = this.locals,
      first = l.b(-0x34),
      row = u16(m.i(0x5c70));
    const delta =
      row > first + 2
        ? 1
        : row <= first && first !== 0 && ![6, 7, 8].includes(m.i(0x6882))
          ? -1
          : 0;
    if (!delta) return false;
    for (let offset = 10; offset <= 40; offset += 10) {
      m.i(0x5c72, m.i(0x5c72) + 10 * delta);
      l.i(-0x40, l.i(-0x40) + 10 * delta);
      const commands = this.frame(offset * delta, true);
      this.remember();
      yield* this.present(commands);
    }
    l.b(-0x34, first + delta);
    return true;
  }
  *run() {
    const m = this.memory,
      l = this.locals;
    this.sound(0x21);
    while (m.b(0x4d34) !== 0 && !l.b(-0x2c)) {
      this.phase = "entering";
      if (this.tick < this.lifeDeadline)
        yield { clock: "driver", remaining: this.lifeDeadline - this.tick };
      this.lifeDeadline = this.tick + 4;
      m.view.setUint32(0x27f8, this.lifeDeadline, true);
      m.view.setUint32(0x27fc, 4, true);
      this.resetLife();
      for (let i = 0; i < 2; i++)
        yield* this.present(this.frame(0, false, true));
      this.phase = "playing";
      while (true) {
        l.b(-0x28, 0);
        l.b(-0x1e, 0);
        yield* this.readInput(); //0317,after rendering and before action logic.
        const input = this.readInputByte();
        if (!Number.isInteger(input) || input < 0 || input > 255)
          throw Error("Invalid mountain input-byte provider");
        this.inputs.push({ tick: this.tick, retrace: this.retrace, input });
        advanceMountainAction(m, l, input, (id) => this.sound(id));
        this.frames++;
        if (l.b(-0x28)) break;
        updateMountainPosition(m, l, (id) => this.sound(id));
        const scrolled = yield* this.scroll();
        if (!scrolled) this.eraseEffects();
        if (m.i(0x5c70) === 24 && m.i(0x6882) === 0) {
          l.b(-0x2c, 1);
          l.b(-0x28, 1);
        }
        const commands = this.frame();
        this.remember();
        yield* this.present(commands);
        if (l.b(-0x28)) break;
      }
      this.sound(0);
      l.i(-0x38, l.b(-0x2c));
    }
    this.events.push({ type: "stopAudio" });
    return {
      code: l.i(-0x38),
      money: m.view.getUint32(0x8cc0, true),
      seed: u16(m.i(0x2229)),
    };
  }
  snapshot() {
    const m = this.memory,
      l = this.locals;
    return {
      phase: this.phase,
      x: m.i(0x5ae0),
      y: m.i(0x5c72),
      row: m.i(0x5c70),
      column: m.i(0x54f6),
      scroll: l.b(-0x34),
      action: m.i(0x6882),
      frame: m.i(0x6d3c),
      facing: m.i(0x3d12),
      lives: m.b(0x4d34),
      hook: { x: l.i(-0x3c), y: l.i(-0x40), angle: l.b(-0x2e) },
      money: m.view.getUint32(0x8cc0, true),
      seed: u16(m.i(0x2229)),
      tick: this.tick,
      ...(this.wait?.clock === "input" ? { waitingForInputPoll: true } : {}),
      frames: this.frames,
      presentations: this.presentations,
      spriteWork: this.lastSpriteWork,
      drawingWork: this.lastDrawingWork,
      outcome: this.outcome,
    };
  }
}
