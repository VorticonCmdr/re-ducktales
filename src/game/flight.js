import { prepareFlightCourse } from "./flight-setup.js";
import {
  advanceFlightPhysics,
  sampleFlightControls,
} from "./flight-physics.js";
import { advanceFlightScene } from "./flight-scene.js";
import { collideFlight } from "./flight-collisions.js";
import { flightRandom, foregroundFlightObjects } from "./flight-objects.js";
import { u8, u16 } from "./integer.js";

// Overlay 4 main loop. The generator yields actual driver/retrace waits; it
// never reads a browser clock and never advances simulation from rendering.
export class Flight {
  constructor(options, previousMemory) {
    this.pollInput = options.pollInput ?? (() => true);
    this.onFlushInput = options.flushInput ?? (() => {});
    this.course = prepareFlightCourse(options, previousMemory);
    this.memory = this.course.memory;
    this.memory.view.setUint32(0x8cc0, options.money >>> 0, true);
    this.startDay = options.day;
    this.days = options.days;
    this.tick = 0;
    this.retrace = 0;
    this.frames = 0;
    this.presentations = 0;
    this.phase = "flying";
    this.controls = { fire: false, direction: null };
    this.inputLog = [];
    this.events = [];
    this.buffers = [[], []];
    this.drawIndex = 0;
    this.current = null;
    this.pending = null;
    this.outcome = null;
    this.returnFireRequested = false;
    this.iterator = this.run();
    this.resume();
  }
  setControls({ fire = false, direction = null }) {
    if (
      typeof fire !== "boolean" ||
      ![null, "up", "down", "left", "right"].includes(direction)
    )
      throw Error("Invalid flight controls");
    this.controls = { fire, direction };
  }
  sound(id) {
    this.events.push({ type: "sound", id });
  }
  draw(commands, address) {
    const asset = this.course.assets.get(address);
    if (asset === undefined)
      throw Error(`Unloaded flight animation DS:${address.toString(16)}`);
    const m = this.memory;
    commands.push({
      op: "sprite",
      asset,
      x: m.i(address),
      y: m.i(address + 2),
      frame: m.b(address + 18),
    });
  }
  scene(sprite = 0x6f3e) {
    return advanceFlightScene(this.memory, this.course, sprite, (id) =>
      this.sound(id),
    );
  }
  *present(commands) {
    this.buffers[this.drawIndex] = commands;
    this.pending = commands;
    yield { clock: "retrace", remaining: 1 };
  }
  *frame(sprite = 0x6f3e, overlay = () => {}) {
    const commands = this.scene(sprite);
    overlay(commands);
    yield* this.present(commands);
  }
  resume() {
    const next = this.iterator.next();
    if (next.done) {
      this.wait = null;
      this.phase = "complete";
      this.outcome = next.value;
      return;
    }
    if (
      !["driver", "retrace", "input"].includes(next.value.clock) ||
      !Number.isInteger(next.value.remaining) ||
      next.value.remaining < 1
    )
      throw Error("Invalid flight wait");
    this.wait = next.value;
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
      throw Error("Flight resumed outside its input reader");
    this.resume();
  }
  flushInput() {
    this.controls = { fire: false, direction: null };
    this.returnFireRequested = false;
    this.onFlushInput();
  }
  requestFire() {
    if (this.phase === "return-wait") this.returnFireRequested = true;
  }
  advance(clock) {
    if (!this.wait || this.wait.clock !== clock || --this.wait.remaining !== 0)
      return;
    if (clock === "retrace" && this.pending) {
      this.current = this.pending;
      this.pending = null;
      this.drawIndex ^= 1;
      this.presentations++;
    }
    this.resume();
  }
  drainEvents() {
    return this.events.splice(0);
  }
  snapshot() {
    const m = this.memory;
    return {
      phase: this.phase,
      x: m.f(0x6d18),
      y: m.f(0x6d3e),
      speed: m.f(0x0fae),
      heading: m.i(0x974c),
      tile: m.i(0x0fb4),
      tiles: m.i(0x5ce6),
      bounces: m.b(0x0fb9),
      frames: this.frames,
      presentations: this.presentations,
      tick: this.tick,
      day: m.b(0x4e0e),
      seed: u16(m.i(0x2229)),
      outcome: this.outcome,
      ...(this.returnWaitTick !== undefined
        ? { returnWaitTick: this.returnWaitTick }
        : {}),
      ...(this.wait?.clock === "input" ? { waitingForInputPoll: true } : {}),
    };
  }
  *spin() {
    const m = this.memory,
      initial = m.i(0x974c);
    this.phase = "spin";
    this.sound(0x2e);
    let selected = initial,
      selecting = true;
    for (let i = 0; i < 6 || selecting; i++) {
      if (selecting) {
        selected = flightRandom(m) & 15;
        if (selected !== initial) selecting = false;
        if (i >= 6) i = 0;
      }
      m.i(0x974c, m.i(0x974c) + 2);
      if (m.i(0x974c) > 15) m.i(0x974c, 0);
      m.b(0x6f50, m.i(0x974c));
      yield* this.frame();
    }
    m.i(0x974c, selected === 4 ? 5 : selected);
  }
  *boost() {
    const m = this.memory;
    this.phase = "boost";
    m.f(0x0fae, m.f(0x32f6));
    const count = m.b(0x0fb8) === 1 ? 8 : m.b(0x0fb8) === 2 ? 13 : null;
    if (count === null) throw Error(`Unsupported flight boost ${m.b(0x0fb8)}`);
    m.b(0x6f50, m.i(0x974c));
    for (let i = 0; i < count; i++) {
      m.f(0x6d3e, m.f(0x6d3e) - m.f(0x32fa));
      m.i(0x6f40, Math.trunc(m.f(0x6d3e)));
      yield* this.frame();
    }
    m.b(0x0fb8, 0);
  }
  extraForeground(commands, tile) {
    foregroundFlightObjects(
      this.memory,
      tile,
      (at) => this.draw(commands, at),
      (id) => this.sound(id),
    );
  }
  *airship() {
    const m = this.memory;
    this.phase = "airship";
    m.i(0x974c, 0);
    this.sound(0x2f);
    const overlay = (commands, tile, includeLower = true, plane = 0x5f02) => {
      this.draw(commands, 0x929e);
      if (includeLower) this.draw(commands, 0x5e94);
      this.draw(commands, plane);
      this.extraForeground(commands, tile);
    };
    for (let i = 0; i < 6; i++) {
      m.i(0x5f02, m.i(0x5e94) + 18);
      m.i(0x5f04, m.i(0x5e96) + 22);
      yield* this.frame(0x5f02, (c) => overlay(c, m.i(0x0fb4)));
    }
    m.i(0x0fb2, Math.max(0, m.i(0x0fb2) - Math.max(6, flightRandom(m) % 20)));
    m.i(0x0fb4, m.i(0x0fb2));
    m.i(0x5ed6, 0);
    m.i(0x929e, 0);
    m.i(0x5e94, 7);
    m.i(0x5f02, 25);
    let y = -20;
    m.i(0x92a0, y);
    m.i(0x5e96, m.i(0x92a4) - 31);
    m.i(0x5f04, m.i(0x92a4) - 9);
    // 0548..057a prepares both pages without advancing a presentation.
    const initial = this.scene(0x5f02);
    overlay(initial, m.i(0x0fb2));
    this.buffers[this.drawIndex] = initial;
    for (; y < 50; y += 6) {
      m.i(0x92a0, y);
      m.i(0x5e96, y + m.i(0x92a4) - 11);
      m.i(0x5f04, y + m.i(0x92a4) + 11);
      yield* this.frame(0x5f02, (c) => overlay(c, m.i(0x0fb2)));
    }
    for (let i = 0; i < 6; i++)
      yield* this.frame(0x5f02, (c) => overlay(c, m.i(0x0fb2), i < 3));
    m.f(0x6d18, m.i(0x5f02));
    m.f(0x6d3e, m.i(0x5f04));
    this.planeDescriptor();
    for (; y > -52; y -= 6) {
      yield* this.frame(0x6f3e, (c) => overlay(c, m.i(0x0fb2), false, 0x6f3e));
      m.i(0x92a0, y - 6);
    }
    if (m.f(0x0fae) < m.d(0x32fe)) m.f(0x0fae, m.f(0x3306));
    m.b(0x0fb6, 0);
    this.clearSpecialInput();
  }
  clearSpecialInput() {
    const m = this.memory;
    m.b(0x0fb7, 0);
    m.i(0x5466, 0);
    m.i(0x8a9c, 0);
    // Resident19a5 also discards held flags and queued global keys.
    this.flushInput();
  }
  planeDescriptor() {
    const m = this.memory;
    m.b(0x6f50, m.i(0x974c));
    m.i(0x6f3e, Math.trunc(m.f(0x6d18)));
    m.i(0x6f40, Math.trunc(m.f(0x6d3e)));
  }
  vectorMove() {
    const m = this.memory,
      vector = m.i(0x974c) * 8;
    m.f(0x6d18, m.f(0x6d18) + m.f(0x0ee2 + vector) * m.f(0x0fae));
    m.f(0x6d3e, m.f(0x6d3e) - m.f(0x0ee6 + vector) * m.f(0x0fae));
  }
  *tether() {
    const m = this.memory;
    this.phase = "tether";
    let anchor = m.i(0x974c) < 5 || m.i(0x974c) > 11 ? 20 : 5;
    m.i(0x974c, anchor === 20 ? 0 : 8);
    this.planeDescriptor();
    this.sound(0x2c);
    const overlay = (commands) => {
      const x = Math.trunc(m.f(0x6d18)) + anchor,
        y = Math.trunc(m.f(0x6d3e)) + 20;
      commands.push(
        { op: "line", color: 4, x: m.i(0x715a), y: m.i(0x715c), x2: x, y2: y },
        { op: "line", color: 4, x: m.i(0x77c4), y: m.i(0x77da), x2: x, y2: y },
      );
      this.extraForeground(commands, m.i(0x0fb4));
      if (m.i(0x0fb4) - m.i(0x0fb2) < 3)
        this.extraForeground(commands, m.i(0x0fb4) + 1);
    };
    while (m.f(0x0fae) > m.d(0x32ee)) {
      yield* this.frame(0x6f3e, overlay);
      this.vectorMove();
      if (m.f(0x6d18) >= m.d(0x330a) || m.f(0x6d18) <= m.d(0x32ee)) {
        m.f(0x6d18, m.f(0x6d18) >= m.d(0x330a) ? m.f(0x3312) : 0);
        m.f(0x0fae, m.f(0x3316));
        break;
      }
      this.planeDescriptor();
      m.f(0x0fae, m.f(0x0fae) - m.f(0x3316));
    }
    for (let i = 0; i < 3; i++) yield* this.frame(0x6f3e, overlay);
    let target, progress;
    if (m.i(0x974c) === 0) {
      m.i(0x974c, 8);
      target = m.i(0x77c4) - 20;
      progress = Math.trunc(m.f(0x6d18));
      anchor = 20;
    } else {
      m.i(0x974c, 0);
      target = -(m.i(0x77c4) + 32);
      progress = Math.trunc(-m.f(0x6d18));
      anchor = 5;
    }
    m.b(0x6f50, m.i(0x974c));
    this.sound(0x3d);
    while (target < progress) {
      yield* this.frame(0x6f3e, overlay);
      this.vectorMove();
      if (m.f(0x6d18) >= m.d(0x330a) || m.f(0x6d18) <= m.d(0x32ee)) {
        m.f(0x6d18, m.f(0x6d18) >= m.d(0x330a) ? m.f(0x3312) : 0);
        break;
      }
      progress = Math.trunc(progress <= 0 ? -m.f(0x6d18) : m.f(0x6d18));
      this.planeDescriptor();
      m.f(0x0fae, m.f(0x0fae) + m.f(0x3316));
    }
    this.sound(0x30);
    this.clearSpecialInput();
  }
  *crash() {
    const m = this.memory;
    this.phase = "crash";
    this.events.push({ type: "stopAudio" });
    m.i(0x4db4, Math.trunc(m.f(0x6d18) - m.d(0x32fe)));
    m.i(0x4db6, Math.trunc(m.f(0x6d3e) - m.d(0x331a)));
    yield { clock: "driver", remaining: 7 };
    this.sound(0x2b);
    for (let i = 0; i < 25; i++)
      yield* this.frame(0x4d1e, (commands) => {
        m.b(0x4dc6, i % 3);
        if (i < 13) m.b(0x4d30, Math.trunc(i / 3));
        this.draw(commands, 0x4d1e);
        this.draw(commands, 0x4db4);
      });
  }
  *land() {
    const m = this.memory;
    this.phase = "landing";
    m.i(0x5ed6, 0);
    yield* this.frame();
    this.buffers = [this.current.slice(), this.current.slice()];
    this.sound(0x3c);
    const at = 0x79f2 + m.i(0x4f44 + m.i(0x5ce6) * 4) * 14,
      y = m.i(at + 4);
    for (let i = 0; i < 26; i++)
      for (const dy of [-2, 2]) {
        m.i(0x4d7e, y + dy);
        const commands = this.buffers[this.drawIndex].slice();
        this.draw(commands, 0x4d7c);
        yield* this.present(commands);
      }
    m.i(0x4d7e, y);
    yield* this.frame();
    yield { clock: "driver", remaining: 219 };
  }
  *run() {
    const m = this.memory;
    let deadline = 0,
      result;
    while (true) {
      this.phase = "flying";
      if (this.tick < deadline)
        yield { clock: "driver", remaining: deadline - this.tick };
      deadline = this.tick + 6;
      const p = advanceFlightPhysics(m);
      if (p.sound !== null) this.sound(p.sound);
      for (let i = 0; i < p.splashFrames; i++) yield* this.frame(0x7182);
      if (p.sprite === 0x4d1e) {
        yield* this.crash();
        result = "crashed";
        break;
      }
      const frame = u16(this.frames + 1);
      m.i(0x88b0, frame);
      this.frames = Math.min(60000, frame);
      yield* this.frame(p.sprite, (commands) => {
        const bonus = m.b(0x7978);
        if (bonus !== 0 && m.signedByte(0x7978) < 8 && bonus & 1) {
          commands.push({ op: "text", text: "$50", x: 144, y: 80, color: 4 });
          m.b(0x7978, bonus + 1);
          if (m.signedByte(0x7978) > 15) m.b(0x7978, 0);
        }
      });
      const collision = yield* collideFlight(m, {
        sound: (id) => this.sound(id),
        spin: () => this.spin(),
      });
      // Overlay4:02ae calls the global input reader only after collisions.
      yield* this.readInput();
      const code =
        (this.controls.fire ? 192 : 0) |
        ({ up: 1, right: 3, down: 5, left: 7 }[this.controls.direction] ?? 0);
      this.inputLog.push({ tick: this.tick, retrace: this.retrace, code });
      sampleFlightControls(m, {
        fire: !!(code & 192),
        up: (code & 63) === 1,
        down: (code & 63) === 5,
      });
      if (collision !== 0) {
        if (collision === 1) {
          yield* this.land();
          result = "arrived";
        } else if (collision === 2) result = "race-lost";
        else throw Error(`Unsupported flight result ${collision}`);
        break;
      }
      if (m.b(0x0fb8)) yield* this.boost();
      else if (m.b(0x0fb6)) yield* this.airship();
      else if (m.b(0x0fb7)) yield* this.tether();
    }
    return yield* this.finish(result);
  }
  *finish(result) {
    const m = this.memory;
    const adjustment =
      result === "arrived"
        ? this.frames < m.i(0x5ce6) * 5
          ? -1
          : this.frames > m.i(0x5ce6) * 11
            ? 1
            : 0
        : 0;
    m.b(0x4e0e, this.startDay + this.days + adjustment);
    for (let i = 0; i < 2; i++) {
      const commands = this.buffers[this.drawIndex].slice();
      this.draw(commands, 0x5eee);
      commands.push({
        op: "text",
        text: String(Math.min(30, m.signedByte(0x4e0e))),
        x: m.signedByte(0x4e0e) < 10 ? 18 : 14,
        y: 184,
        color: 0,
      });
      yield* this.present(commands);
    }
    this.events.push({ type: "stopAudio" });
    // 0f27 -> resident09f5(20): flush once,then poll before each7-tick wait.
    this.phase = "return-wait";
    this.returnWaitTick = this.tick;
    this.flushInput();
    for (let i = 0; i < 20; i++) {
      yield* this.readInput();
      if (this.controls.fire || this.returnFireRequested) break;
      yield { clock: "driver", remaining: 7 };
    }
    return {
      status: result,
      code: result === "arrived" ? 1 : 0,
      day: m.b(0x4e0e),
      seed: u16(m.i(0x2229)),
      money: m.view.getUint32(0x8cc0, true),
      frames: this.frames,
    };
  }
}
