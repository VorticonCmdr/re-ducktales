import {
  prepareCave,
  loadCaveSprite,
  caveRandom,
  caveDistance,
  composeCaveRoom,
  drawCaveParty,
  CAVE_SPRITES,
} from "./cave-scene.js";
import { u16 } from "./integer.js";
import { caveEndings } from "./cave-endings.js";
export class Cave {
  constructor(options, previousMemory) {
    this.options = options;
    Object.assign(this, prepareCave(options, previousMemory));
    this.tick = 0;
    this.retrace = 0;
    this.presentations = 0;
    this.phase = "entering";
    this.current = null;
    this.background = [];
    this.buffers = [[], []];
    this.drawIndex = 0;
    this.audioEnabled = options.audioEnabled === true;
    this.audioToken = 0;
    this.audioBusy = false;
    this.controls = { fire: false, direction: null };
    this.events = [];
    this.inputs = [];
    this.progress = 0;
    this.previousEnemy = 0;
    this.idleCount = 0;
    this.poseLatch = 0;
    this.invalidLatch = 0;
    this.outcome = null;
    this.iterator = this.run();
    this.resume();
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "right", "down", "left"].includes(controls.direction)
    )
      throw Error("Invalid cave controls");
    this.controls = { ...controls };
  }
  sound(id) {
    const token = `${this.options.audioScope ?? 0}:${++this.audioToken}`;
    this.activeAudioToken = token;
    this.audioBusy = this.audioEnabled;
    this.events.push({ type: "sound", id, token });
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean") throw Error("Invalid cave audio enable");
    this.audioEnabled = enabled;
    if (!enabled) this.audioBusy = false;
  }
  setAudioStatus(token, busy) {
    if (typeof busy !== "boolean") throw Error("Invalid cave audio status");
    if (token !== this.activeAudioToken) return;
    this.inputs.push({
      tick: this.tick,
      retrace: this.retrace,
      audio: { token, busy },
    });
    this.audioBusy = this.audioEnabled && busy;
  }
  *waitAudio() {
    while (this.audioBusy) yield* this.delay(1);
  }
  drainEvents() {
    return this.events.splice(0);
  }
  resume() {
    const n = this.iterator.next();
    if (n.done) {
      this.outcome = n.value;
      this.wait = null;
      this.phase = "complete";
    } else {
      if (
        !["driver", "retrace"].includes(n.value.clock) ||
        !Number.isInteger(n.value.remaining) ||
        n.value.remaining < 1
      )
        throw Error("Invalid cave wait");
      this.wait = n.value;
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
    this.buffers[this.drawIndex] = commands;
    this.pending = commands;
    yield { clock: "retrace", remaining: 1 };
    this.drawIndex = 1 - this.drawIndex;
  }
  *delay(ticks) {
    yield { clock: "driver", remaining: ticks };
  }
  get room() {
    return this.memory.i(0x4d32);
  }
  get cell() {
    return this.memory.b(0x5a42 + this.room * 2);
  }
  draw(commands, id, frame) {
    const at = CAVE_SPRITES.get(id);
    if (at === undefined) throw Error(`Untranslated cave animation ${id}`);
    if (frame !== undefined) this.memory.b(at + 18, frame);
    commands.push({
      op: "sprite",
      asset: id,
      x: this.memory.i(at),
      y: this.memory.i(at + 2),
      frame: this.memory.b(at + 18),
    });
  }
  scene() {
    this.background = composeCaveRoom(this.memory, this.entries);
    return this.restoreBackground();
  }
  party(commands, options) {
    // Helper20b8 always restores the room buffer before drawing the party.
    return drawCaveParty(this.memory, this.restoreBackground(), options);
  }
  load(id, x, y) {
    const at = loadCaveSprite(this.memory, this.entries, id);
    if (x !== undefined) this.memory.i(at, x);
    if (y !== undefined) this.memory.i(at + 2, y);
  }
  back() {
    return [...this.buffers[this.drawIndex]];
  }
  restoreBackground(region = { x: 0, y: 0, width: 320, height: 200 }) {
    const { x, y, width, height } = region;
    const c =
      x === 0 && y === 0 && width === 320 && height === 200 ? [] : this.back();
    c.push({
      op: "restore",
      source: this.background,
      x,
      y,
      sourceX: x,
      sourceY: y,
      width,
      height,
    });
    this.buffers[this.drawIndex] = c;
    return c;
  }
  updateTorch() {
    const m = this.memory,
      count = m.signedByte(0x8b54),
      limit = m.i(0x54ac);
    if (count === limit >> 1 && m.i(0x4e28) === 14) {
      loadCaveSprite(m, this.entries, 15);
      m.i(0x4e28, 15);
    } else if (count === limit - m.i(0x8b3e) && m.i(0x4e28) === 15) {
      loadCaveSprite(m, this.entries, 16);
      m.i(0x4e28, 16);
    }
  }
  *enter() {
    const m = this.memory;
    this.phase = "entering";
    m.b(0x8b54, m.b(0x8b54) + 1);
    this.updateTorch();
    this.progress = u16(this.progress + 1);
    if (this.cell & 64) m.b(0x546a, 1);
    for (let i = 0; i < 2; i++) {
      const c = this.party(this.scene());
      if (m.signedByte(0x8b54) > 1 && !(this.cell & 80)) this.draw(c, 43);
      yield* this.present(c);
    }
    if (m.signedByte(0x8b54) > 1 && !(this.cell & 80)) {
      yield* this.delay(73);
      m.view.setUint32(
        0x8cc0,
        (m.view.getUint32(0x8cc0, true) + 50) >>> 0,
        true,
      );
      this.sound(0x20);
      for (let i = 0; i < 3; i++) {
        const c = this.party(this.scene());
        if (!i) c.push({ op: "text", text: "$50", x: 132, y: 128, color: 15 });
        yield* this.present(c);
      }
    }
    m.b(0x5a42 + this.room * 2, this.cell | 16);
    m.i(0x8eb2, 0);
    return !!(this.cell & 64);
  }
  moveEnemy() {
    const m = this.memory,
      enemy = m.i(0x6810),
      cell = m.b(0x5a42 + enemy * 2),
      player = this.room;
    if (
      (player - 8 === enemy && cell & 4) ||
      (player - 1 === enemy && cell & 2) ||
      (player + 1 === enemy && cell & 1) ||
      (player + 8 === enemy && cell & 8) ||
      (player - 8 === enemy && cell & 1) ||
      enemy === player
    ) {
      if (player + 1 === enemy || enemy === player) m.i(0x6810, player - 8);
      else if (player + 8 === enemy) m.i(0x6810, player - 1);
      m.b(0x546a, 1);
      return true;
    }
    let choice = this.progress;
    if (m.i(0x4e08) < 7) {
      const dx = (player & 7) - (enemy & 7),
        dy = (player >> 3) - (enemy >> 3);
      if (!dy) {
        if (dx < 0) choice = 0;
        else if (dx > 0) choice = 1;
      } else choice = dy < 0 ? 2 : 3;
    } else choice = caveRandom(m) & 3;
    let next = enemy;
    if (
      choice === 0 &&
      enemy !== 0 &&
      (enemy & 7) !== 0 &&
      this.previousEnemy + 1 !== enemy &&
      (player + 1 !== enemy || cell & 1)
    )
      next = enemy - 1;
    else if (
      choice === 1 &&
      enemy + 1 < 64 &&
      (enemy & 7) !== 7 &&
      this.previousEnemy !== enemy + 1 &&
      (player !== enemy + 1 || cell & 2)
    )
      next = enemy + 1;
    else if (
      choice === 2 &&
      enemy > 7 &&
      this.previousEnemy + 8 !== enemy &&
      (player + 8 !== enemy || cell & 8)
    )
      next = enemy - 8;
    else if (
      choice === 3 &&
      enemy + 8 < 64 &&
      this.previousEnemy !== enemy + 8 &&
      (player !== enemy + 8 || cell & 4)
    )
      next = enemy + 8;
    if (next !== enemy) {
      this.previousEnemy = enemy;
      m.i(0x6810, next);
      this.sound(0x52);
    }
    this.progress = 0;
  }
  *run() {
    const m = this.memory;
    let deadline = 0;
    while (true) {
      if (this.room === m.i(0x97b0))
        return yield* caveEndings.finish.call(this, "treasure");
      if (this.tick < deadline) yield* this.delay(deadline - this.tick);
      deadline = this.tick + 6;
      m.i(0x4e08, caveDistance(m.i(0x97b0), this.room));
      if (m.i(0x8eb2) && (yield* this.enter()))
        return yield* caveEndings.finish.call(this, "pit");
      if (m.signedByte(0x8b54) >= m.i(0x54ac))
        return yield* caveEndings.finish.call(this, "torch-expired");
      this.phase = "exploring";
      const code =
        (this.controls.fire ? 192 : 0) |
        ({ up: 1, right: 3, down: 5, left: 7 }[this.controls.direction] ?? 0);
      this.inputs.push({ tick: this.tick, retrace: this.retrace, code });
      let pose = 0,
        door = null;
      const available = { up: 8, right: 2, down: 4, left: 1 };
      const dir = this.controls.direction;
      if (dir) {
        if (this.cell & available[dir]) {
          pose = { up: 5, right: 4, down: 3, left: 2 }[dir];
          door = { up: 20, right: 21, down: 19, left: 18 }[dir];
          this.invalidLatch = 0;
        } else if (!this.invalidLatch) {
          this.sound(0x46);
          this.invalidLatch = 1;
        }
      }
      let commands = this.party(
        this.scene(),
        door ? { asset: door, pose } : undefined,
      );
      if (!dir) {
        this.invalidLatch = 0;
        const roll = caveRandom(m) & 255;
        if (roll < 231 || this.poseLatch) this.poseLatch = 0;
        else {
          this.draw(commands, 38 + (caveRandom(m) % 5));
          this.poseLatch = 1;
        }
        if (this.idleCount >= 15) {
          m.b(0x8b54, m.b(0x8b54) + 1);
          this.idleCount = 0;
          this.updateTorch();
        }
      }
      const previous = this.progress;
      this.progress = u16(this.progress + 1);
      if (previous > this.enemyInterval && this.moveEnemy())
        return yield* caveEndings.finish.call(this, "captured");
      this.idleCount = this.idleCount > 60000 ? 0 : u16(this.idleCount + 1);
      yield* this.present(commands);
      if (code & 192 && dir && this.cell & available[dir]) {
        this.sound(0x24);
        m.i(0x4d32, this.room + { up: -8, right: 1, down: 8, left: -1 }[dir]);
        m.i(0x8eb2, 1);
        this.progress = u16(this.progress + 1);
      }
    }
  }
  snapshot() {
    const m = this.memory;
    return {
      phase: this.phase,
      room: this.room,
      goal: m.i(0x97b0),
      enemy: m.i(0x6810),
      rooms: Array.from({ length: 64 }, (_, i) => m.i(0x5a42 + i * 2)),
      torch: m.b(0x8b54),
      limit: m.i(0x54ac),
      money: m.view.getUint32(0x8cc0, true),
      seed: u16(m.i(0x2229)),
      tick: this.tick,
      presentations: this.presentations,
      outcome: this.outcome,
    };
  }
}
