import { executableText } from "./executable.js";
import { nextRandom, u16 } from "./integer.js";
import { renderFlightPixels } from "./flight-raster.js";

const BLACK = [{ op: "fill", color: 0, x: 0, y: 0, width: 320, height: 200 }];
const copy = (asset, x = 0, y = 0, width = 320, height = 200) => ({
  op: "copy",
  asset,
  x,
  y,
  sourceX: x,
  sourceY: y,
  width,
  height,
});
const sprite = (asset, x, y, frame = 0) => ({
  op: "sprite",
  asset,
  x,
  y,
  frame,
});
const ARRIVAL = [
  [-57, 29],
  [-23, 25],
  [36, 30],
  [49, 29],
  [99, 29],
];

// Resident12f5:09e1/0d89/05ba/0168/0338. This component starts at the
// original intro entry, after hardware selection; BIOS seeding is an input.
// The later difficulty-confirmation BIOS reseed belongs to the caller.
export class Opening {
  constructor({
    image,
    entries,
    seed,
    audioEnabled = false,
    pollInput = () => true,
    readInput = null,
    flushInput = () => {},
  }) {
    if (
      image?.length !== 87664 ||
      entries?.length !== 43 ||
      entries[2]?.width !== 320 ||
      entries[3]?.height !== 200 ||
      entries[42]?.data.length !== 2056
    )
      throw Error("Missing original opening resources");
    if (!Number.isInteger(seed) || seed < 0 || seed > 65535)
      throw Error("Invalid opening initial seed");
    for (const id of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
      if (entries[id]?.type !== 2) throw Error(`Missing opening sprite${id}`);
    if (
      typeof audioEnabled !== "boolean" ||
      typeof pollInput !== "function" ||
      (readInput !== null && typeof readInput !== "function") ||
      typeof flushInput !== "function"
    )
      throw Error("Invalid opening environment provider");
    this.image = image;
    this.entries = entries;
    this.font = entries[42].data;
    this.data = new DataView(
      image.buffer,
      image.byteOffset + 0x120e0,
      image.length - 0x120e0,
    );
    this.seed = seed;
    this.rngCalls = 0;
    this.audioEnabled = audioEnabled;
    this.pollInput = pollInput;
    this.readInput = readInput;
    this.onFlushInput = flushInput;
    this.controls = { fire: false, direction: null };
    this.firePulse = false;
    this.events = [];
    this.inputs = [];
    this.boundaries = [];
    this.tick = 0;
    this.retrace = 0;
    this.presentations = 0;
    this.skipRequested = false;
    this.skipEnabled = true;
    this.musicRequested = false;
    this.phase = "entering";
    this.current = BLACK;
    this.display = { kind: "blank" };
    this.pending = null;
    this.outcome = null;
    this.rasterCache = new WeakMap();
    this.started = false;
    this.iterator = this.run();
    // Enter at09fa's first input boundary. The environment can supply initial
    // controls before simulation starts; constructing an object must not consume
    // three neutral reads before the browser has a chance to deliver input.
    this.wait = { clock: "input", remaining: 1 };
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "down", "left", "right"].includes(controls.direction)
    )
      throw Error("Invalid opening controls");
    this.controls = { ...controls };
  }
  input(event) {
    if (event.type !== "fire")
      throw Error(`Unsupported opening input ${event.type}`);
    this.firePulse = true;
  }
  flushInput() {
    this.controls = { fire: false, direction: null };
    this.firePulse = false;
    this.onFlushInput();
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean") throw Error("Invalid opening audio flag");
    this.audioEnabled = enabled;
    // Browser autoplay adaptation: the first enable gesture supplies the initial
    // enabled option late. It never restarts an already requested intro song.
    if (enabled && this.started && !this.outcome) this.startMusic();
  }
  sound(id) {
    if (this.audioEnabled) this.events.push({ type: "sound", id });
  }
  startMusic() {
    if (!this.musicRequested && this.audioEnabled) {
      this.musicRequested = true;
      this.sound(1);
    }
  }
  drainEvents() {
    return this.events.splice(0);
  }
  random() {
    this.seed = nextRandom(this.seed);
    this.rngCalls++;
    return this.seed;
  }
  word(at) {
    return this.data.getUint16(at, true);
  }
  signedWord(at) {
    return this.data.getInt16(at, true);
  }
  *poll() {
    while (true) {
      const ready = this.pollInput();
      if (typeof ready !== "boolean")
        throw Error("Invalid opening input-poll result");
      if (ready) break;
      yield { clock: "input", remaining: 1 };
    }
    const byte = this.readInput
      ? this.readInput()
      : (this.controls.fire || this.firePulse ? 192 : 0) |
        ({ up: 1, right: 3, down: 5, left: 7 }[this.controls.direction] ?? 0);
    if (!Number.isInteger(byte) || byte < 0 || byte > 255)
      throw Error("Invalid opening input byte");
    this.firePulse = false;
    this.inputs.push({
      index: this.inputs.length + 1,
      phase: this.phase,
      byte,
      tick: this.tick,
      retrace: this.retrace,
    });
    if (byte & 192) this.skipRequested = true;
    return byte;
  }
  *delay(count) {
    if (!Number.isInteger(count) || count < 1)
      throw Error("Invalid opening wait");
    yield { clock: "driver", remaining: count };
  }
  *present(commands, display) {
    this.pending = { commands, display };
    yield { clock: "retrace", remaining: 1 };
  }
  boundary(kind, extra = {}) {
    this.boundaries.push({
      kind,
      phase: this.phase,
      seed: this.seed,
      rngCalls: this.rngCalls,
      skip: this.skipRequested,
      tick: this.tick,
      retrace: this.retrace,
      commands: this.current,
      ...extra,
    });
  }
  resume() {
    this.started = true;
    const result = this.iterator.next();
    if (result.done) {
      this.outcome = result.value;
      this.pending = null;
      this.phase = "complete";
      this.skipEnabled = false;
      this.wait = null;
    } else {
      if (
        !["driver", "retrace", "input"].includes(result.value.clock) ||
        !Number.isInteger(result.value.remaining) ||
        result.value.remaining < 1
      )
        throw Error("Unsupported opening wait");
      this.wait = result.value;
    }
  }
  advance(clock) {
    if (clock === "driver") this.tick++;
    else this.retrace++;
    if (
      !this.wait ||
      (this.wait.clock !== clock &&
        !(clock === "driver" && this.wait.clock === "input"))
    )
      return;
    if (--this.wait.remaining > 0) return;
    if (clock === "retrace" && this.pending) {
      this.current = this.pending.commands;
      this.display = this.pending.display;
      this.pending = null;
      this.presentations++;
    }
    this.resume();
  }
  advanceTick() {
    this.advance("driver");
  }
  advanceRetrace() {
    this.advance("retrace");
  }
  advanceBlockedTick() {
    this.tick++;
  }
  advanceBlockedRetrace() {
    this.retrace++;
  }
  pixels() {
    return renderFlightPixels(
      this.current,
      this.entries,
      this.font,
      "MAIN.ARC",
      this.rasterCache,
    );
  }
  textLines(table, first, last) {
    const result = [];
    for (let line = first - 1; line < last; line++) {
      const at = table + line * 6;
      result.push({
        op: "text",
        x: this.signedWord(at),
        y: this.signedWord(at + 2),
        text: executableText(this.image, this.word(at + 4)),
        color: 0,
      });
    }
    return result;
  }
  office() {
    return [
      ...BLACK,
      copy(3),
      sprite(4, 120, 8),
      sprite(5, 32, 48),
      sprite(6, 136, 32),
      sprite(7, 120, 48),
    ];
  }
  speech(kind, first, last, half) {
    const commands = this.office();
    if (kind === "kids") {
      commands.push(
        sprite(8, 216, 32, 2),
        sprite(10, 0, 0),
        sprite(11, 127, 34),
      );
      commands.push(
        this.random() & 0x100 ? sprite(15, 186, 103) : sprite(14, 193, 82),
      );
      commands.push(
        sprite(half === 0 ? 13 : 12, 151, 34),
        ...this.textLines(0xc5a, first, last),
      );
    } else if (kind === "scrooge") {
      commands.push(
        sprite(8, 216, 32, half === 0 ? 3 : 2),
        sprite(11, 127, 34),
        sprite(12, 151, 34),
        sprite(15, 186, 103),
        sprite(16, 128, 0),
        ...this.textLines(0xc00, first, last),
      );
    } else throw Error(`Unsupported opening speaker ${kind}`);
    return commands;
  }
  *talk(kind, first, last, cycles) {
    this.phase = kind;
    for (let cycle = 0; cycle < cycles; cycle++) {
      yield* this.present(this.speech(kind, first, last, 0), {
        kind,
        first,
        last,
        cycle,
        half: 0,
      });
      yield* this.poll();
      if (this.skipRequested) {
        this.sound(0);
        return;
      }
      yield* this.delay(7);
      this.boundary("speech-half", {
        speaker: kind,
        first,
        last,
        cycle,
        half: 0,
      });
      yield* this.poll();
      if (this.skipRequested) {
        this.sound(0);
        return;
      }
      yield* this.present(this.speech(kind, first, last, 1), {
        kind,
        first,
        last,
        cycle,
        half: 1,
      });
      yield* this.poll();
      if (this.skipRequested) {
        this.sound(0);
        return;
      }
      const wait = (this.random() & 2) * 7 + 7;
      yield* this.delay(wait);
      this.boundary("speech-half", {
        speaker: kind,
        first,
        last,
        cycle,
        half: 1,
        wait,
      });
      yield* this.poll();
      if (this.skipRequested) {
        this.sound(0);
        return;
      }
    }
    yield* this.delay(21);
  }
  *story() {
    this.phase = "office-arrival";
    //05ba:0004 assembles an immutable office background on both pages.
    yield* this.poll();
    yield* this.poll();
    yield* this.present([...this.office(), sprite(8, 216, 32)], {
      kind: "office",
    });
    yield* this.poll();
    for (let index = 0; index < 5; index++) {
      const [x, y] = ARRIVAL[index],
        frame = (index + 2) % 4;
      const commands = [
        ...this.office(),
        sprite(8, 216, 32, 1),
        sprite(9, x, y, frame),
      ];
      // The original copies only y20..149 here. All changed arrival sprites
      // lie in that rectangle; the untouched office pixels stay identical.
      this.pending = {
        commands,
        display: { kind: "arrival", index, x, y, frame },
      };
      yield* this.poll();
      if (this.skipRequested) {
        this.sound(0);
        return;
      }
      yield { clock: "retrace", remaining: 1 };
      yield* this.delay(14);
      this.boundary("arrival", { index, x, y, frame });
    }
    yield* this.present(
      [
        ...this.office(),
        sprite(11, 127, 34),
        sprite(15, 186, 103),
        sprite(12, 151, 34),
        sprite(8, 216, 32, 1),
      ],
      { kind: "settled" },
    );
    yield* this.poll();
    if (this.skipRequested) {
      this.sound(0);
      return;
    }
    yield* this.poll();
    yield* this.talk("kids", 1, 5, 8);
    yield* this.talk("kids", 6, 10, 8);
    yield* this.talk("scrooge", 1, 3, 5);
    yield* this.talk("scrooge", 4, 6, 4);
    yield* this.poll();
    if (this.skipRequested) {
      this.sound(0);
      return;
    }
    yield* this.talk("kids", 11, 14, 6);
    yield* this.talk("kids", 15, 19, 6);
    yield* this.talk("kids", 20, 23, 5);
    yield* this.talk("kids", 24, 26, 5);
    yield* this.poll();
    if (this.skipRequested) {
      this.sound(0);
      return;
    }
    yield* this.talk("scrooge", 7, 9, 5);
    yield* this.talk("scrooge", 10, 12, 5);
    yield* this.talk("scrooge", 13, 13, 1);
    yield* this.talk("scrooge", 13, 14, 1);
    yield* this.talk("scrooge", 13, 15, 1);
  }

  *run() {
    for (let guard = 0; guard < 3; guard++) {
      yield* this.poll();
      if (this.skipRequested) {
        this.sound(0);
        return this.result();
      }
    }
    this.startMusic();
    yield* this.present(BLACK, { kind: "blank" });
    this.phase = "title-reveal";
    for (let inset = 80; inset >= 0; inset -= 8) {
      yield* this.present(
        [...BLACK, copy(2, inset, inset, 320 - 2 * inset, 200 - 2 * inset)],
        { kind: "reveal", inset },
      );
      yield* this.poll();
      yield* this.delay(2);
      this.boundary("reveal", { inset });
    }
    yield* this.poll();
    if (this.skipRequested) {
      this.sound(0);
      return this.result();
    }
    this.phase = "title-hold";
    this.flushInput();
    for (let poll = 0; poll < 40; poll++) {
      const byte = yield* this.poll();
      if (byte & 192) break;
      yield* this.delay(7);
    }
    yield* this.poll();
    if (this.skipRequested) {
      this.sound(0);
      return this.result();
    }
    yield* this.story();
    if (this.skipRequested) this.sound(0x24);
    //09e1:0ae3 calls the EGA1:0155 clear after the story. It does not flip
    // another animation frame. The early title-skip branch bypasses this call.
    this.current = BLACK;
    this.display = { kind: "blank" };
    return this.result();
  }
  result() {
    return {
      status: this.skipRequested ? "skipped" : "complete",
      seed: u16(this.seed),
      rngCalls: this.rngCalls,
    };
  }
  snapshot() {
    return {
      phase: this.phase,
      display: this.display,
      skipRequested: this.skipRequested,
      skipEnabled: this.skipEnabled,
      seed: this.seed,
      rngCalls: this.rngCalls,
      tick: this.tick,
      retrace: this.retrace,
      presentations: this.presentations,
      inputs: this.inputs.length,
      outcome: this.outcome,
    };
  }
}
