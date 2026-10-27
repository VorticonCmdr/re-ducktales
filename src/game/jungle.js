import {
  prepareJungle,
  resetJungleLoader,
  initializeJungleEntry,
} from "./jungle-state.js";
import { sampleJungleControls } from "./jungle-controls.js";
import { collideJungleGround } from "./jungle-collision.js";
import { advanceJungleCamera, advanceJungleHazards } from "./jungle-hazards.js";
import {
  updateJungleRider,
  advanceJungleMotion,
  jungleVinePoint,
} from "./jungle-motion.js";
import {
  initializeJungleLife,
  initializeJungleMonkeys,
  initializeJunglePlatforms,
  initializeJungleFish,
  initializeJungleBonus,
} from "./jungle-initialization.js";
import {
  presentJungleFrame,
  invalidateJungleActor,
} from "./jungle-presentation.js";
import { JungleRaster } from "./jungle-raster.js";
import { junglePalette } from "./jungle-scene.js";
import { u16 } from "./integer.js";

export class Jungle {
  constructor(options, previousMemory) {
    Object.assign(this, prepareJungle(options, previousMemory));
    this.raster = new JungleRaster(this.resources);
    this.controls = { direction: null, fire: false };
    this.events = [];
    this.inputs = [];
    this.tick = 0;
    this.retrace = 0;
    this.logicalTick = 0;
    this.frames = 0;
    this.presentations = 0;
    this.audioEnabled = options.audioEnabled === true;
    this.memory.b(0x3be, this.audioEnabled ? 1 : 0);
    this.memory.view.setUint32(0x2221, 0, true);
    this.memory.view.setUint32(0x2225, 0, true);
    this.color = 0;
    this.current = null;
    this.presentationMode = "replace";
    this.wipeToken = 0;
    this.pending = null;
    this.outcome = null;
    this.effects = {
      sound: (id) => this.sound(id),
      wait: (ticks) => this.driverWait(ticks),
      vinePoint: (id) => jungleVinePoint(this.memory, id),
      flushInput: () => {},
    };
    initializeJungleEntry(this.memory, this.effects);
    this.iterator = this.run();
    this.resume();
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "right", "down", "left"].includes(controls.direction)
    )
      throw Error("Invalid jungle controls");
    this.controls = { ...controls };
  }
  setAudioEnabled(value) {
    if (typeof value !== "boolean") throw Error("Invalid jungle audio enable");
    this.audioEnabled = value;
    this.memory.b(0x3be, value ? 1 : 0);
  }
  sound(id) {
    if (this.audioEnabled)
      this.events.push({ type: "sound", id, due: this.logicalTick });
  }
  drainEvents() {
    const ready = this.events.filter((e) => e.due <= this.tick);
    this.events = this.events.filter((e) => e.due > this.tick);
    return ready.map(({ due, ...event }) => event);
  }
  // A deterministic logical driver provider. Synchronous translated segments
  // finish at their logical completion time; publication,next input and audio
  // are held until the independent driver clock catches up. No state rollback,
  // expected-output injection or browser-clock read occurs inside a segment.
  driverWait(ticks) {
    if (!Number.isInteger(ticks) || ticks < 0 || ticks > 65535)
      throw Error("Invalid jungle driver wait");
    const m = this.memory,
      current = this.logicalTick >>> 0;
    const target = (m.view.getUint32(0x2221, true) + ticks) >>> 0;
    if (ticks && current < target) this.logicalTick += target - current;
    const consumed = this.logicalTick >>> 0;
    m.view.setUint32(0x2225, consumed, true);
    m.view.setUint32(0x2221, consumed, true);
  }
  *settle() {
    if (this.logicalTick > this.tick)
      yield { clock: "driver", remaining: this.logicalTick - this.tick };
  }
  resume() {
    this.logicalTick = Math.max(this.logicalTick, this.tick);
    this.memory.view.setUint32(0x2225, this.logicalTick >>> 0, true);
    const result = this.iterator.next();
    if (result.done) {
      this.outcome = result.value;
      this.phase = "complete";
      this.wait = null;
      return;
    }
    if (
      !["driver", "retrace"].includes(result.value.clock) ||
      !Number.isInteger(result.value.remaining) ||
      result.value.remaining < 1
    )
      throw Error("Invalid jungle clock wait");
    this.wait = result.value;
  }
  advanceTick() {
    this.tick++;
    this.memory.view.setUint32(
      0x2225,
      Math.max(this.tick, this.logicalTick) >>> 0,
      true,
    );
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
      this.presentationMode = "replace";
      this.pending = null;
      this.presentations++;
    }
    this.resume();
  }
  *wipe() {
    // EGA0155 writes rows band,band+5,...,band+195,then waits five retraces.
    // Alpha0 is an explicit preserve-previous-screen rendering operation;
    // the renderer owns that incoming screen and cannot feed it into logic.
    this.wipeToken++;
    for (let band = 0; band < 5; band++) {
      const pixels = new Uint8ClampedArray(320 * 200 * 4);
      for (let y = 0; y < 200; y++)
        if (y % 5 <= band)
          for (let x = 0; x < 320; x++) pixels[(y * 320 + x) * 4 + 3] = 255;
      this.current = pixels;
      this.presentationMode = "overlay";
      this.presentations++;
      yield { clock: "retrace", remaining: 5 };
    }
  }
  *frame(first) {
    const effects = this.raster.begin(this.memory, this.color, this.effects);
    presentJungleFrame(this.memory, effects);
    this.color = effects.color;
    this.raster.finish({ copyToOtherPage: first });
    yield* this.settle();
    const pixels = this.raster.pixels(junglePalette(this.memory));
    if (first) {
      yield* this.wipe();
      // EGA0101 copies the same five row bands,with five retraces per band.
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
    } else {
      this.pending = pixels;
      const handle = this.memory.view.getUint16(0x2038, true);
      this.memory.i(handle + 6, this.memory.i(handle + 6) ^ 0x200);
      yield { clock: "retrace", remaining: 1 };
    }
  }
  *run() {
    const m = this.memory;
    this.phase = "entering";
    yield* this.wipe();
    let first = true;
    while (m.i(0x1aac) === 0) {
      this.phase = "playing";
      if (m.i(0x78e8) === 0) invalidateJungleActor(m);
      m.i(0x8b56, 0);
      const input =
        ({ up: 1, right: 3, down: 5, left: 7 }[this.controls.direction] ?? 0) |
        (this.controls.fire ? 64 : 0);
      this.inputs.push({ tick: this.tick, retrace: this.retrace, input });
      sampleJungleControls(m, input, this.effects);
      collideJungleGround(m, this.effects);
      this.frames++;
      if (m.i(0x1aac) !== 0) break;
      if (m.i(0x6882) === 7) {
        this.phase = "life-lost";
        this.sound(0);
        this.driverWait(0);
        this.driverWait(73);
        yield* this.settle();
        yield* this.wipe();
        if (m.i(0x5cfc) >= 3) break;
        first = true;
        m.i(0x3d10, m.i(0x3d10) % 320);
        resetJungleLoader(m);
        initializeJungleLife(m, false, this.effects);
        initializeJungleMonkeys(m, this.effects);
        initializeJunglePlatforms(m, false, this.effects);
        initializeJungleFish(m);
        initializeJungleBonus(m);
        this.driverWait(0);
        this.driverWait(146);
        yield* this.settle();
        m.i(0x88ac, 0);
        this.phase = "playing";
      }
      advanceJungleCamera(m);
      if (m.i(0x8e0e) !== 0) m.i(0x78e8, 3);
      advanceJungleHazards(m, this.effects);
      updateJungleRider(m, this.effects);
      advanceJungleMotion(m, this.effects);
      yield* this.frame(first);
      first = false;
      // Resident098e:01d8 uses an unsigned DX:AX deadline,then a fresh read.
      const interval = m.view.getUint32(0x27fc, true);
      if (interval) {
        const deadline = m.view.getUint32(0x27f8, true),
          now = this.logicalTick >>> 0;
        if (now < deadline) {
          this.logicalTick += deadline - now;
          yield* this.settle();
        }
        m.view.setUint32(0x27f8, (this.logicalTick + interval) >>> 0, true);
      }
    }
    yield* this.wipe();
    this.sound(0);
    return {
      code: m.i(0x1aac),
      money: m.view.getUint32(0x8cc0, true),
      seed: u16(m.i(0x2229)),
    };
  }
  snapshot() {
    const m = this.memory;
    return {
      phase: this.phase,
      x: m.i(0x5f46),
      y: m.i(0x6858),
      column: m.i(0x544c),
      row: m.i(0x5462),
      action: m.i(0x6882),
      frame: m.i(0x88ae),
      facing: m.i(0x3d12),
      lives: this.outcome?.code === 0 ? 0 : 4 - m.i(0x5cfc),
      scroll: m.i(0x5ed2),
      money: m.view.getUint32(0x8cc0, true),
      seed: u16(m.i(0x2229)),
      tick: this.tick,
      retrace: this.retrace,
      frames: this.frames,
      presentations: this.presentations,
      outcome: this.outcome,
    };
  }
}
