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
import { u16 } from "./integer.js";

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
    // Original SS allocation contents are an explicit conditional-comparison
    // input. Independent runs use the documented zero-filled stack provider.
    this.locals = new MountainLocals(options.stackBytes);
    this.locals.b(-0x24, 1);
    this.locals.b(-0x2c, 0);
    this.memory.b(0x4e0e, options.day);
    this.audioEnabled = options.audioEnabled === true;
    this.events = [];
    this.inputs = [];
    this.controls = { fire: false, direction: null };
    this.tick = 0;
    this.retrace = 0;
    this.frames = 0;
    this.presentations = 0;
    this.phase = "entering";
    this.terrainCache = new Map();
    this.current = null;
    this.outcome = null;
    this.lifeDeadline = 0;
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
        !["driver", "retrace"].includes(result.value.clock) ||
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
    yield { clock: "retrace", remaining: 1 };
  }
  draw(commands, at) {
    const asset = SPRITES.get(at);
    if (asset === undefined)
      throw Error(`Unloaded mountain sprite DS:${at.toString(16)}`);
    const m = this.memory;
    commands.push({
      op: "sprite",
      asset,
      x: m.i(at),
      y: m.i(at + 2),
      frame: m.b(at + 18),
    });
  }
  hud(commands) {
    const m = this.memory;
    commands.push({
      op: "fill",
      color: 0,
      x: 0,
      y: 169,
      width: 320,
      height: 30,
    });
    for (const [x, y, x2, y2] of [
      [0, 168, 319, 168],
      [319, 168, 319, 199],
      [319, 199, 0, 199],
      [0, 199, 0, 168],
    ])
      commands.push({ op: "line", color: 4, x, y, x2, y2 });
    commands.push({ op: "sprite", asset: 17, frame: 0, x: 8, y: 175 });
    commands.push({ op: "sprite", asset: 16, frame: 0, x: 40, y: 172 });
    m.b(0x3732, 2);
    m.i(0x3720, 200);
    m.i(0x3722, 178);
    for (let i = 0; i < m.b(0x4d34); i++) {
      this.draw(commands, 0x3720);
      m.b(0x3732, m.b(0x3732) - 1);
      m.i(0x3720, m.i(0x3720) + 32);
    }
    const money = String(m.view.getUint32(0x8cc0, true));
    commands.push({
      op: "text",
      text: money,
      x: 168 - money.length * 8,
      y: 174,
      color: 15,
    });
    const day = m.signedByte(0x4e0e);
    commands.push({
      op: "text",
      text: String(day),
      x: day < 10 ? 18 : 14,
      y: 182,
      color: 1,
    });
  }
  frame(offset = 0, scrolling = false) {
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
    this.hud(commands);
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
      commands.push({
        op: "line",
        color: 14,
        x: m.i(0x5ae0) + l.i(-0x48),
        y: m.i(0x5c72) + l.i(-0x4a),
        x2: l.i(-0x3c),
        y2: l.i(-0x40),
      });
    }
    if (!scrolling && [4, 5].includes(m.i(0x6882))) {
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
    const m = this.memory,
      scroll = this.locals.b(-0x34);
    const old = m.i(0x3706 + m.b(0x370a) * 2);
    if ([5, 6].includes(old) || m.i(0x4cf2) > 0) {
      m.i(0x4cf2, m.i(0x4cf2) - 1);
      return;
    }
    // Helper282a has one logical effect amid its framebuffer copies.
    for (let row = scroll; row < scroll + 5 && row < 25; row++) {
      const at = u16(m.i(0x5d26) + row * 6);
      if (m.b(at) === 9 && [1, 2].includes(m.b(at + 1)))
        m.b(at + 1, m.b(at + 1) + 1);
    }
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
      for (let i = 0; i < 2; i++) yield* this.present(this.frame());
      this.phase = "playing";
      while (true) {
        const input =
          ({ up: 1, right: 3, down: 5, left: 7 }[this.controls.direction] ??
            0) | (this.controls.fire ? 0x40 : 0);
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
      frames: this.frames,
      presentations: this.presentations,
      outcome: this.outcome,
    };
  }
}
