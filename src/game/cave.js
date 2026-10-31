import {
  prepareCave,
  loadCaveSprite,
  caveRandom,
  caveDistance,
  caveTrapNearby,
  composeCaveRoom,
  drawCaveParty,
  CAVE_SPRITES,
} from "./cave-scene.js";
import { u16 } from "./integer.js";
import { DRIVER_HZ, RETRACE_HZ } from "./timing.js";
import { caveSpriteWork } from "./cave-work.js";
import {
  caveRoomCompositionWork,
  caveInitialMinimapWork,
  caveRuntimePartyWork,
} from "./cave-runtime-work.js";
import { caveEndings } from "./cave-endings.js";
import { caveTransition } from "./cave-transitions.js";
import { graphicsLoadWork } from "./graphics-load-work.js";
// Overlay6:09a9..0a81 and0d62/0ec8/0f5a/0fef mask five bits and
// group the diagonal on each cardinal's clockwise side with that cardinal.
export function caveDirectionFromByte(byte) {
  if (!Number.isInteger(byte) || byte < 0 || byte > 255)
    throw Error("Invalid cave input-byte provider");
  return (
    {
      1: "up",
      2: "up",
      3: "right",
      4: "right",
      5: "down",
      6: "down",
      7: "left",
      8: "left",
    }[byte & 31] ?? null
  );
}
export class Cave {
  constructor(options, previousMemory) {
    this.options = options;
    this.pollInput = options.pollInput ?? (() => true);
    this.onFlushInput = options.flushInput ?? (() => {});
    Object.assign(this, prepareCave(options, previousMemory));
    this.tick = 0;
    this.retrace = 0;
    this.clock =
      options.clock ??
      (() =>
        Math.max(
          (this.tick * 1000) / DRIVER_HZ,
          (this.retrace * 1000) / RETRACE_HZ,
        ));
    if (typeof this.clock !== "function") throw Error("Invalid cave clock");
    this.lastClock = -Infinity;
    this.lastPartyWork = null;
    this.lastDrawingWork = null;
    this.lastLoadingWork = null;
    this.lastRoomWork = null;
    this.initialDrawingWork = null;
    this.presentations = 0;
    this.phase = "entering";
    this.current = null;
    this.presentationMode = "replace";
    this.wipeToken = 0;
    this.background = [];
    this.buffers = [[], []];
    this.drawIndex = 0;
    this.audioEnabled = options.audioEnabled === true;
    this.audioToken = 0;
    this.audioBusy = false;
    this.hasAudioDevice = options.hasAudioDevice ?? (() => this.audioToken > 0);
    if (typeof this.hasAudioDevice !== "function")
      throw Error("Invalid cave audio-device provider");
    this.controls = { fire: false, direction: null };
    this.readInputByte =
      options.readInput ??
      (() =>
        (({ up: 1, right: 3, down: 5, left: 7 })[this.controls.direction] ??
          0) | (this.controls.fire ? 192 : 0));
    if (typeof this.readInputByte !== "function")
      throw Error("Invalid cave input-byte provider");

    this.events = [];
    this.inputs = [];
    this.progress = 0;
    this.previousEnemy = 0;
    this.idleCount = 0;
    this.poseLatch = 0;
    this.invalidLatch = 0;
    this.enteredFrom = null;
    this.outcome = null;
    this.flushInput();
    this.iterator = this.run();
    this.resume();
  }
  setClock(clock) {
    if (typeof clock !== "function") throw Error("Invalid cave clock");
    const before = this.now(),
      after = clock();
    if (
      !Number.isFinite(after) ||
      after < 0 ||
      (this.wait?.clock === "graphics" && before !== after)
    )
      throw Error("Cannot rebase active cave graphics clock");
    this.clock = clock;
    this.lastClock = after;
  }
  now() {
    const value = this.clock();
    if (!Number.isFinite(value) || value < 0 || value < this.lastClock)
      throw Error("Invalid or backwards cave simulation clock");
    this.lastClock = value;
    return value;
  }
  advanceGraphics() {
    if (this.wait?.clock !== "graphics")
      throw Error("Cave graphics resumed outside drawing work");
    this.advance("graphics");
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
    if (!this.audioEnabled) return;
    const token = `${this.options.audioScope ?? 0}:${++this.audioToken}`;
    this.activeAudioToken = token;
    this.audioBusy = null;
    this.events.push({ type: "sound", id, token });
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean") throw Error("Invalid cave audio enable");
    this.audioEnabled = enabled;
  }
  setAudioStatus(token, busy) {
    if (typeof busy !== "boolean") throw Error("Invalid cave audio status");
    if (token !== this.activeAudioToken) return;
    this.inputs.push({
      tick: this.tick,
      retrace: this.retrace,
      audio: { token, busy },
    });
    this.audioBusy = busy;
  }
  *waitAudio() {
    // 125f/16a7/188c query the global driver, even when sound is disabled.
    const present = this.hasAudioDevice();
    if (typeof present !== "boolean")
      throw Error("Invalid cave audio-device result");
    if (!present) return; // An unused provider is initialized idle.
    const token = `${this.options.audioScope ?? 0}:${++this.audioToken}`;
    this.activeAudioToken = token;
    this.audioBusy = null;
    this.events.push({ type: "audio-query", token });
    while (this.audioBusy !== false) yield { clock: "audio", remaining: 1 };
  }
  resumeAudioStatus() {
    if (this.wait?.clock !== "audio" || this.audioBusy !== false)
      throw Error("Cave audio resumed without an idle status");
    this.resume();
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
        !["driver", "retrace", "input", "graphics", "audio"].includes(
          n.value.clock,
        ) ||
        !Number.isInteger(n.value.remaining) ||
        n.value.remaining < 1
      )
        throw Error("Invalid cave wait");
      if (n.value.clock === "graphics" && !Number.isFinite(n.value.until))
        throw Error("Invalid cave graphics deadline");
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
      throw Error("Cave resumed outside its input reader");
    this.resume();
  }
  flushInput() {
    this.memory?.bytes.fill(0, 0x276c, 0x27ec);
    this.controls = { fire: false, direction: null };
    this.onFlushInput();
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
      this.presentationMode = "replace";
      this.pending = null;
      this.presentations++;
    }
    this.resume();
  }
  *present(commands, { striped = false } = {}) {
    this.presentationMode = "replace";
    this.buffers[this.drawIndex] = commands;
    if (striped) {
      // EGA0101 copies the draw page into the visible page in five groups
      // of rows, with five retraces per group. It does not swap page roles.
      if (!this.current)
        throw Error("Cave reveal requires a visible source page");
      const source = this.current;
      for (let band = 0; band < 5; band++) {
        const rows = [];
        for (let y = 0; y < 200; y++)
          if (y % 5 <= band)
            rows.push({
              op: "restore",
              source: commands,
              x: 0,
              y,
              sourceX: 0,
              sourceY: y,
              width: 320,
              height: 1,
            });
        this.current = [...source, ...rows];
        this.buffers[1 - this.drawIndex] = this.current;
        this.presentationTransition = { kind: "reveal", band };
        this.presentations++;
        yield { clock: "retrace", remaining: 5 };
      }
      this.current = commands;
      this.buffers[1 - this.drawIndex] = commands;
      this.presentationTransition = null;
      return;
    }
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
  *draw(commands, id, frame) {
    const at = CAVE_SPRITES.get(id);
    if (at === undefined) throw Error(`Untranslated cave animation ${id}`);
    if (frame !== undefined) this.memory.b(at + 18, frame);
    const command = {
      op: "sprite",
      asset: id,
      x: this.memory.i(at),
      y: this.memory.i(at + 2),
      frame: this.memory.b(at + 18),
    };
    commands.push(command);
    const work = caveSpriteWork(this.entries, command);
    this.lastDrawingWork = { kind: "sprite", ...work };
    yield {
      clock: "graphics",
      remaining: 1,
      until: this.now() + work.milliseconds,
    };
  }
  *scene(audible = false) {
    this.background = composeCaveRoom(this.memory, this.entries);
    // 26bb loads pit/distance/trap sprites on each actual composition.
    // The command plan itself consumes no RNG or external input.
    for (const command of this.background)
      if (command.op === "sprite" && [1, 2, 7, 8, 9].includes(command.asset))
        yield* this.loadWork(command.asset);
    const work = caveRoomCompositionWork(this.entries, this.background);
    this.lastRoomWork = work;
    this.lastDrawingWork = { kind: "room", ...work };
    const end = this.now() + work.milliseconds;
    if (audible) {
      // 26bb emits the cue after overlays, before video->cache copying.
      const before = caveRoomCompositionWork(this.entries, this.background, {
        cacheResult: false,
      });
      yield {
        clock: "graphics",
        remaining: 1,
        until: this.now() + before.milliseconds,
      };
      const distance = this.memory.i(0x4e08);
      this.sound(
        caveTrapNearby(this.memory, this.room)
          ? 0x4d
          : distance < 2
            ? 0x51
            : distance < 4
              ? 0x50
              : distance < 6
                ? 0x4f
                : 0x4e,
      );
    }
    yield {
      clock: "graphics",
      remaining: 1,
      until: end,
    };
    return this.restoreBackground();
  }
  *party(commands, options) {
    // Helper20b8 restores the room before its new sprites. The nested room
    // command list reconstructs cached pixels and is not another source draw.
    const page = this.restoreBackground(),
      first = page.length;
    drawCaveParty(this.memory, page, options);
    const work = caveRuntimePartyWork(
      this.memory,
      this.entries,
      page.slice(first),
      options,
    );
    this.lastPartyWork = work;
    this.lastDrawingWork = { kind: "party", ...work };
    yield {
      clock: "graphics",
      remaining: 1,
      until: this.now() + work.milliseconds,
    };
    return page;
  }
  *loadWork(id) {
    const work = graphicsLoadWork(this.entries[id]);
    this.lastLoadingWork = work;
    this.lastDrawingWork = { kind: "load", ...work };
    yield { clock: "graphics", remaining: 1, until: this.now() + work.milliseconds };
  }
  *load(id, x, y) {
    const at = loadCaveSprite(this.memory, this.entries, id);
    // Resident175c initializes the descriptor before streaming the payload;
    // caller coordinates are assigned only after the load returns.
    yield* this.loadWork(id);
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
  *updateTorch() {
    const m = this.memory,
      count = m.signedByte(0x8b54),
      limit = m.i(0x54ac);
    if (count === limit >> 1 && m.i(0x4e28) === 14) {
      yield* this.load(15);
      m.i(0x4e28, 15);
    } else if (count === limit - m.i(0x8b3e) && m.i(0x4e28) === 15) {
      yield* this.load(16);
      m.i(0x4e28, 16);
    }
  }
  *wipe() {
    // EGA0155: black rows band,band+5,...,band+195; five retraces/band.
    // Transparent rows preserve the incoming screen in the renderer only.
    this.wipeToken++;
    for (let band = 0; band < 5; band++) {
      this.current = [];
      for (let y = 0; y < 200; y++)
        if (y % 5 <= band)
          this.current.push({ op: "fill", x: 0, y, width: 320, height: 1, color: 0 });
      this.presentationMode = "overlay";
      this.presentationTransition = { kind: "wipe", band };
      this.buffers[1 - this.drawIndex] = this.current;
      this.presentations++;
      yield { clock: "retrace", remaining: 5 };
    }
    this.presentationTransition = null;
  }
  *enter() {
    const m = this.memory;
    this.phase = "entering";
    m.b(0x8b54, m.b(0x8b54) + 1);
    yield* this.updateTorch();
    this.progress = u16(this.progress + 1);
    if (this.cell & 64) m.b(0x546a, 1);
    yield* this.wipe(); // Overlay057e, before background loading/composition.
    yield* this.loadWork(0); // Main0595, picture mode into the room RAM surface.
    for (let i = 0; i < 2; i++) {
      let c = yield* this.scene(i === 0);
      if (!this.enteredFrom || m.b(0x5d2b)) c = yield* this.party(c);
      if (m.signedByte(0x8b54) > 1 && !(this.cell & 80))
        yield* this.draw(c, 43);
      yield* this.present(c, { striped: i === 1 }); // 05e9 flip;0638 reveal.
    }
    m.i(0x8eb2, 0);
    if (!m.b(0x5d2b)) {
      if (this.enteredFrom)
        yield* caveTransition.call(this, "entry", this.enteredFrom);
      for (let i = 0; i < 2; i++)
        yield* this.present(yield* this.party(this.back()));
    } else if (m.signedByte(0x8b54) > 1 && !(this.cell & 80)) {
      yield* this.delay(73);
      m.view.setUint32(
        0x8cc0,
        (m.view.getUint32(0x8cc0, true) + 50) >>> 0,
        true,
      );
      this.sound(0x20);
      for (let i = 0; i < 3; i++) {
        const c = yield* this.party(yield* this.scene());
        if (!i) c.push({ op: "text", text: "$50", x: 132, y: 128, color: 15 });
        yield* this.present(c);
      }
    }
    m.b(0x5a42 + this.room * 2, this.cell | 16);
    if (
      !(this.cell & 64) &&
      m.signedByte(0x8b54) < m.i(0x54ac) &&
      !m.b(0x5d2b)
    ) {
      for (const [bit, asset] of [
        [1, 18],
        [4, 19],
        [8, 20],
        [2, 21],
      ])
        if (this.cell & bit) {
          yield* this.load(asset);
          yield* this.present(yield* this.party(this.back()));
          m.b(0x54aa, m.b(0x54aa) | 1);
        }
    }
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
    const work = caveInitialMinimapWork(m, this.entries);
    this.initialDrawingWork = work;
    this.lastDrawingWork = { kind: "initial-minimap", ...work };
    yield {
      clock: "graphics",
      remaining: 1,
      until: this.now() + work.milliseconds,
    };
    yield* this.wipe(); // Overlay0491; the first room also executes057e.
    this.sound(0);
    let deadline = 0;
    while (true) {
      if (this.room === m.i(0x97b0))
        return yield* caveEndings.finish.call(this, "treasure");
      if (this.tick < deadline) yield* this.delay(deadline - this.tick);
      deadline = this.tick + 6;
      m.i(0x4e08, caveDistance(m.i(0x97b0), this.room));
      const entered = !!m.i(0x8eb2);
      if (entered && (yield* this.enter()))
        return yield* caveEndings.finish.call(this, "pit");
      if (m.signedByte(0x8b54) >= m.i(0x54ac))
        return yield* caveEndings.finish.call(this, "torch-expired");
      // Overlay6:0997 flushes only after a safe,non-expired room entry.
      if (entered) this.flushInput();
      this.phase = "exploring";
      // 09a1 reads input after entry/animation,then returns at09a6.
      yield* this.readInput();
      const code = this.readInputByte();
      const dir = caveDirectionFromByte(code);
      this.inputs.push({ tick: this.tick, retrace: this.retrace, code });
      let pose = 0,
        door = null;
      const available = { up: 8, right: 2, down: 4, left: 1 };
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
      let commands = yield* this.party(
        // Main09cf/0a0e/0a90 call20b8 directly. That helper restores
        // the cached room;26bb composition belongs to room-entry paths.
        this.back(),
        door ? { asset: door, pose } : undefined,
      );
      if (!dir) {
        this.invalidLatch = 0;
        const roll = caveRandom(m) & 255;
        if (roll < 231 || this.poseLatch) this.poseLatch = 0;
        else {
          yield* this.draw(commands, 38 + (caveRandom(m) % 5));
          this.poseLatch = 1;
        }
        if (this.idleCount >= 15) {
          m.b(0x8b54, m.b(0x8b54) + 1);
          this.idleCount = 0;
          yield* this.updateTorch();
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
        // Original right branch0f96/0f9a commits the new room/entry flag
        // before loading or animating the exit (call1074). Other directions
        // have the same ordering. The torch advances on the next loop entry.
        m.i(0x4d32, this.room + { up: -8, right: 1, down: 8, left: -1 }[dir]);
        this.enteredFrom = dir;
        m.i(0x8eb2, 1);
        this.progress = u16(this.progress + 1);
        this.phase = "entering";
        if (!m.b(0x5d2b)) {
          m.b(0x54aa, 0);
          yield* caveTransition.call(this, "exit", dir);
        }
      }
    }
  }
  snapshot() {
    const m = this.memory;
    return {
      phase: this.phase,
      partyWork: this.lastPartyWork,
      drawingWork: this.lastDrawingWork,
      loadingWork: this.lastLoadingWork,
      roomWork: this.lastRoomWork,
      initialDrawingWork: this.initialDrawingWork,
      ...(this.presentationTransition
        ? { presentationTransition: { ...this.presentationTransition } }
        : {}),
      ...(this.wait?.clock === "input" ? { waitingForInputPoll: true } : {}),
      ...(this.wait?.clock === "audio"
        ? { waitingForAudio: true, audioBusy: this.audioBusy }
        : {}),
      room: this.room,
      goal: m.i(0x97b0),
      enemy: m.i(0x6810),
      rooms: Array.from({ length: 64 }, (_, i) => m.i(0x5a42 + i * 2)),
      torch: m.b(0x8b54),
      limit: m.i(0x54ac),
      money: m.view.getUint32(0x8cc0, true),
      seed: u16(m.i(0x2229)),
      inputReads: this.inputs.filter((event) => Object.hasOwn(event, "code"))
        .length,
      tick: this.tick,
      presentations: this.presentations,
      outcome: this.outcome,
    };
  }
}
