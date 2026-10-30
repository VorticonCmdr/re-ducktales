import {
  preparePhotography,
  photographyHud,
  drawPhotographySprite,
  PHOTOGRAPHY_AIM,
  photographyResultsScene,
} from "./photography-scene.js";
import { advancePhotographyAnimals } from "./photography-animation.js";
import {
  photographyShutterLimit,
  reactToPhotographyShutter,
  settlePhotographyResults,
  finishPhotographyReturn,
} from "./photography-actors.js";
import { renderFlightPixels } from "./flight-raster.js";
import { u16 } from "./integer.js";
import { DRIVER_HZ, RETRACE_HZ } from "./timing.js";
import { photographyWork } from "./photography-work.js";

export class PhotographyLocals {
  constructor(bytes = new Uint8Array(0x66)) {
    if (!(bytes instanceof Uint8Array) || bytes.length !== 0x66)
      throw Error("Invalid photography stack provider");
    this.bytes = Uint8Array.from(bytes);
    this.view = new DataView(this.bytes.buffer);
  }
  i(at, value) {
    if (value === undefined) return this.view.getInt16(0x66 + at, true);
    this.view.setInt16(0x66 + at, value, true);
    return this.i(at);
  }
  b(at, value) {
    if (value === undefined) return this.view.getUint8(0x66 + at);
    this.view.setUint8(0x66 + at, value);
    return this.b(at);
  }
}

export class Photography {
  constructor(options, previousMemory) {
    Object.assign(this, preparePhotography(options, previousMemory));
    if (options.mainEntries?.[42]?.data?.length !== 2056)
      throw Error("Missing photography original font");
    this.font = options.mainEntries[42].data;
    this.locals = new PhotographyLocals(options.stackBytes);
    const l = this.locals,
      m = this.memory;
    for (const at of [-0x3c, -0x38, -0x50, -0x58]) l.i(at, 0);
    for (const at of [-0x54, -0x3e, -0x56, -0x34]) l.b(at, 0);
    for (let i = 0; i < 12; i++) l.b(-0x64 + i, 0);
    for (let i = 0; i < 3; i++) {
      l.i(-0x4a + i * 4, PHOTOGRAPHY_AIM[i][0]);
      l.i(-0x48 + i * 4, PHOTOGRAPHY_AIM[i][1]);
    }
    l.i(-0x4c, 32);
    l.b(-2, [50, 40, 30][options.difficulty]);
    this.photos = l.bytes.subarray(2, 14);
    this.controls = { fire: false, direction: null };
    this.pollInput = options.pollInput ?? (() => true);
    this.onFlushInput = options.flushInput ?? (() => {});
    this.readInput = options.readInput ?? (() => this.joystick());
    this.readDialogueFire =
      options.readDialogueFire ?? (() => this.controls.fire);
    this.dialogueInputs = [];
    this.events = [];
    this.inputs = [];
    this.tick = 0;
    this.retrace = 0;
    this.clock =
      options.clock ??
      (() =>
        Math.max(
          (this.tick * 1000) / DRIVER_HZ,
          (this.retrace * 1000) / RETRACE_HZ,
        ));
    if (typeof this.clock !== "function")
      throw Error("Invalid photography clock");
    this.lastClock = -Infinity;
    this.drawingWork = null;
    this.drawingCalls = 0;
    this.drawingMilliseconds = 0;
    this.frames = 0;
    this.presentations = 0;
    this.current = null;
    this.pending = null;
    this.outcome = null;
    this.phase = "entering";
    this.presentationMode = "replace";
    this.wipeToken = 0;
    this.setAudioEnabled(options.audioEnabled === true);
    m.view.setUint32(0x2225, 0, true);
    this.sound(0);
    this.iterator = this.run();
    this.resume();
  }
  setClock(clock) {
    if (typeof clock !== "function") throw Error("Invalid photography clock");
    const before = this.now(),
      after = clock();
    if (
      !Number.isFinite(after) ||
      after < 0 ||
      (this.wait?.clock === "graphics" && before !== after)
    )
      throw Error("Cannot rebase active photography graphics clock");
    this.clock = clock;
    this.lastClock = after;
  }
  now() {
    const value = this.clock();
    if (!Number.isFinite(value) || value < 0 || value < this.lastClock)
      throw Error("Invalid or backwards photography simulation clock");
    this.lastClock = value;
    return value;
  }
  advanceGraphics() {
    if (this.wait?.clock !== "graphics")
      throw Error("Photography graphics resumed outside drawing work");
    this.advance("graphics");
  }
  *waitForDrawing(kind, commands) {
    const work = photographyWork(this.entries, commands);
    if (work.milliseconds <= 0)
      throw Error("Missing photography source drawing work");
    this.drawingWork = { kind, ...work };
    this.drawingCalls++;
    yield {
      clock: "graphics",
      remaining: 1,
      until: this.now() + work.milliseconds,
    };
    this.drawingMilliseconds += work.milliseconds;
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "right", "down", "left"].includes(controls.direction)
    )
      throw Error("Invalid photography controls");
    this.controls = { ...controls };
  }
  joystick() {
    return (
      ({ up: 1, right: 3, down: 5, left: 7 }[this.controls.direction] ?? 0) |
      (this.controls.fire ? 64 : 0)
    );
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid photography audio setting");
    this.audioEnabled = enabled;
    this.memory.b(0x3be, enabled ? 1 : 0);
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
        !["driver", "retrace", "input", "graphics"].includes(
          result.value.clock,
        ) ||
        !Number.isInteger(result.value.remaining) ||
        result.value.remaining < 1
      )
        throw Error("Invalid photography clock wait");
      if (
        result.value.clock === "graphics" &&
        !Number.isFinite(result.value.until)
      )
        throw Error("Invalid photography graphics deadline");
      this.wait = result.value;
    }
  }
  advanceTick() {
    this.tick++;
    this.memory.view.setUint32(0x2225, this.tick >>> 0, true);
    this.advance("driver");
  }
  advanceBlockedTick() {
    this.tick++;
    this.memory.view.setUint32(0x2225, this.tick >>> 0, true);
  }
  advanceBlockedRetrace() {
    this.retrace++;
  }
  *pollSystemInput() {
    const ready = this.pollInput();
    if (typeof ready !== "boolean")
      throw Error("Invalid photography global input provider");
    if (!ready) yield { clock: "input", remaining: 1 };
  }
  resumeInputPoll() {
    if (this.wait?.clock !== "input")
      throw Error("Photography resumed outside its input reader");
    this.resume();
  }
  flushInput(releaseControls = true) {
    this.memory.bytes.fill(0, 0x276c, 0x27ec);
    if (releaseControls) this.controls = { fire: false, direction: null };
    this.onFlushInput(releaseControls);
  }
  advanceRetrace() {
    this.retrace++;
    this.advance("retrace");
  }
  advance(clock) {
    if (this.wait?.clock === "graphics") {
      if (this.now() < this.wait.until) return;
      this.wait = null;
      this.resume();
      if (clock === "graphics") return;
    }
    if (!this.wait || this.wait.clock !== clock || --this.wait.remaining)
      return;
    if (this.pending) {
      this.current = this.pending;
      this.pending = null;
      this.presentationMode = "replace";
      this.presentations++;
    }
    this.resume();
  }
  pixels(commands) {
    return renderFlightPixels(commands, this.entries, this.font, "PS.ARC");
  }
  *present(commands) {
    this.pending = this.pixels(commands);
    yield { clock: "retrace", remaining: 1 };
  }
  *wipe() {
    this.wipeToken++;
    // An immediately preceding page flip can complete in this same clock
    // event. Preserve that page here instead of asking the DOM renderer for
    // an older display. Only the initial incoming campaign screen is external.
    const base =
      this.current &&
      this.current.every((value, i) => i % 4 !== 3 || value === 255)
        ? Uint8ClampedArray.from(this.current)
        : null;
    for (let band = 0; band < 5; band++) {
      const pixels = base
        ? Uint8ClampedArray.from(base)
        : new Uint8ClampedArray(320 * 200 * 4);
      for (let y = 0; y < 200; y++)
        if (y % 5 <= band)
          for (let x = 0; x < 320; x++)
            pixels.set([0, 0, 0, 255], (y * 320 + x) * 4);
      this.current = pixels;
      this.presentationMode = base ? "replace" : "overlay";
      this.presentations++;
      yield { clock: "retrace", remaining: 5 };
    }
  }
  *reveal(commands) {
    const pixels = this.pixels(commands);
    yield* this.wipe();
    for (let band = 0; band < 5; band++) {
      const partial = new Uint8ClampedArray(pixels.length);
      for (let y = 0; y < 200; y++)
        for (let x = 0; x < 320; x++) {
          const at = (y * 320 + x) * 4;
          if (y % 5 <= band) partial.set(pixels.subarray(at, at + 4), at);
          else partial[at + 3] = 255;
        }
      this.current = partial;
      this.presentationMode = "replace";
      this.presentations++;
      yield { clock: "retrace", remaining: 5 };
    }
  }
  backgroundFrame() {
    const m = this.memory,
      l = this.locals,
      commands = [
        { op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 },
        {
          op: "copy",
          asset: 0,
          sourceX: 0,
          sourceY: 0,
          x: 0,
          y: 0,
          width: 320,
          height: 176,
        },
      ];
    photographyHud(commands, m, this.assets, l.b(-0x3e));
    return commands;
  }
  drawActors(commands, aim = true) {
    const m = this.memory;
    const draw = (at) => drawPhotographySprite(commands, m, this.assets, at);
    advancePhotographyAnimals(m, { draw, sound: (id) => this.sound(id) });
    draw(0x4dcc);
    if (aim) {
      const column = m.b(0x4dde);
      if (column > 2) throw Error("Invalid photography camera column");
      m.b(0x8c02, column);
      m.i(0x8bf0, PHOTOGRAPHY_AIM[column][0]);
      m.i(0x8bf2, PHOTOGRAPHY_AIM[column][1]);
      draw(0x8bf0);
    }
    return commands;
  }
  // Pure command composition remains available for conditional raster checks.
  // Production follows the separate source drawing boundaries below.
  frame(aim = true) {
    return this.drawActors(this.backgroundFrame(), aim);
  }
  *prepareFrame() {
    const commands = this.backgroundFrame();
    yield* this.waitForDrawing("background", commands.slice(1));
    return commands;
  }
  *animateFrame(commands, aim = true) {
    const first = commands.length;
    this.drawActors(commands, aim);
    yield* this.waitForDrawing("actors", commands.slice(first));
    return commands;
  }
  *drawFrame(aim = true) {
    return yield* this.animateFrame(yield* this.prepareFrame(), aim);
  }
  *footer() {
    const m = this.memory,
      deadline = m.view.getUint32(0x27f8, true);
    if (this.tick >>> 0 < deadline)
      yield { clock: "driver", remaining: deadline - (this.tick >>> 0) };
    m.view.setUint32(0x27f8, (this.tick + 7) >>> 0, true);
  }
  *run() {
    const m = this.memory,
      l = this.locals;
    yield* this.wipe();
    yield* this.reveal(yield* this.drawFrame());
    this.flushInput(false); // Main0798, after the complete opening reveal.
    m.view.setUint32(0x27f8, 0, true);
    m.view.setUint32(0x27fc, 7, true);
    m.b(0x2066, 0);
    this.phase = "playing";
    while (!l.i(-0x38)) {
      yield* this.footer();
      l.i(-0x52, 0);
      yield* this.pollSystemInput(); // Main07d2, before sampling the joystick.
      let input = this.readInput();
      if (!Number.isInteger(input) || input < 0 || input > 255)
        throw Error("Invalid photography joystick provider");
      this.inputs.push(input);
      this.frames++;
      l.i(-0x52, input);
      this.flushInput(false); // Main07da retains the sampled AX in its local.
      // Main07df..0803 draws even when the following shutter branch exits
      // without presenting. Its elapsed work precedes sound/film decisions.
      const commands = yield* this.prepareFrame();
      const record = 0x896c + m.b(0x4dde) * 12;
      if (!m.b(record)) l.b(-0x54, 0);
      if (!l.b(-0x54) && input & 192) {
        input = 0;
        l.i(-0x52, 0);
        this.sound(0x6a);
        m.b(0x5d2a, m.b(0x5d2a) - 1);
        if (m.signedByte(0x5d2a) < 0) break;
        if (m.b(record + 4) < photographyShutterLimit(m, record)) {
          reactToPhotographyShutter(m, record);
          l.b(-0x64 + l.i(-0x50), m.b(record + 2));
          const photo = l.b(-0x64 + l.i(-0x50));
          if ((photo << 24) >> 24 === m.i(0x5f48)) this.sound(0x6c);
          else if (l.b(-0x64 + l.i(-0x4c))) this.sound(0x6b);
          l.b(-0x54, 1);
        }
        l.i(-0x50, l.i(-0x50) + 1);
        m.b(0x2066, 7);
        l.i(-0x3a, m.b(record));
        for (l.i(-0x4c, 0); l.i(-0x4c) < 4; l.i(-0x4c, l.i(-0x4c) + 1))
          yield* this.present(yield* this.drawFrame(false));
        m.b(0x2066, 0);
        continue;
      }
      const direction = input & 63;
      l.b(-0x66, direction);
      const column = [7, 8].includes(direction)
        ? 0
        : [2, 3].includes(direction)
          ? 2
          : direction === 1
            ? 1
            : null;
      if (column !== null) {
        l.i(-0x52, 0);
        if (m.b(0x4dde) !== column) this.sound(0x6d);
        m.b(0x4dde, column);
      }
      yield* this.present(yield* this.animateFrame(commands));
      const old = l.i(-0x58);
      l.i(-0x58, old + 1);
      if ((l.b(-2) << 24) >> 24 < old) {
        l.i(-0x58, 0);
        if (l.b(-0x3e)) m.b(0x5eec, m.b(0x5eec) + 1);
        else l.b(-0x3e, 1);
      }
      if (m.signedByte(0x5d2a) <= 0 || m.b(0x5eec) > 10) l.i(-0x38, 1);
    }
    this.phase = "results";
    const commands = photographyResultsScene(
      m,
      this.assets,
      this.photos,
      this.image,
    );
    yield* this.wipe();
    const success = settlePhotographyResults(m, this.photos);
    l.i(-0x3c, success);
    yield* this.reveal(commands);
    this.flushInput(false); // Main11b9 and shared11c4:0a05.
    for (let poll = 0; poll < 40; poll++) {
      // Shared09f5 enters its input reader before each neutral seven-tick wait.
      yield* this.pollSystemInput();
      const fire = this.readDialogueFire();
      if (typeof fire !== "boolean")
        throw Error("Invalid photography dialogue input provider");
      this.dialogueInputs.push(fire);
      if (fire) break;
      this.memory.view.setUint32(0x2221, this.tick >>> 0, true);
      yield { clock: "driver", remaining: 7 };
      this.memory.view.setUint32(0x2221, this.tick >>> 0, true);
    }
    m.b(0x2066, 0);
    finishPhotographyReturn(m, success);
    return {
      code: success,
      money: m.view.getUint32(0x8cc0, true),
      score: m.view.getUint32(0x97a8, true),
      day: m.b(0x4e0e),
      seed: u16(m.i(0x2229)),
    };
  }
  snapshot() {
    const m = this.memory;
    return {
      phase: this.phase,
      drawingWork: this.drawingWork,
      drawingCalls: this.drawingCalls,
      drawingMilliseconds: this.drawingMilliseconds,
      tick: this.tick,
      retrace: this.retrace,
      frames: this.frames,
      presentations: this.presentations,
      column: m.b(0x4dde),
      film: m.signedByte(0x5d2a),
      timer: m.b(0x5eec),
      timerCounter: this.locals.i(-0x58),
      started: this.locals.b(-0x3e),
      target: m.i(0x5f48),
      seed: u16(m.i(0x2229)),
      photos: [...this.photos],
      photoCount: this.locals.i(-0x50),
      dialoguePolls: this.dialogueInputs.length,
      animals: Array.from({ length: 3 }, (_, i) => {
        const at = 0x896c + i * 12;
        return {
          place: m.b(at),
          animal: m.i(at + 2),
          frame: m.b(at + 4),
          phase: m.b(at + 5),
          countdown: m.b(at + 6),
        };
      }),
      score: m.view.getUint32(0x97a8, true),
      outcome: this.outcome,
      wait: this.wait ? { ...this.wait } : null,
    };
  }
}
