import { nextRandom, s16, u16, u32 } from "./integer.js";
import { FlightMemory } from "./flight-physics.js";

export const BANK_SPRITES = new Map([
  [0x3684, 0],
  [0x3590, 1],
  [0x36ac, 2],
  [0x3698, 3],
  [0x35a4, 4],
  [0x3668, 6],
  [0x3630, 7],
  [0x35b8, 8],
  [0x35cc, 9],
  [0x35e0, 10],
  [0x35f4, 11],
  [0x3608, 12],
  [0x361c, 13],
  [0x3644, 14],
]);
const black = [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 }];
const background = [
  {
    op: "copy",
    asset: 5,
    sourceX: 0,
    sourceY: 0,
    x: 0,
    y: 0,
    width: 320,
    height: 200,
  },
];
const signed = (n) => n | 0;
// Overlay3:05fd..06a6: signed long division, signed long clamp, then AX only.
export function bankPileTier(balance) {
  const quotient = Math.trunc(signed(balance) / 10000);
  return u32(balance) === 0 ? -1 : s16(quotient > 4 ? 4 : quotient);
}
export function bankScaleTarget(rivalTier, playerTier) {
  const difference = s16(rivalTier - playerTier);
  return difference < -2
    ? 0
    : difference < 0
      ? 1
      : difference === 0
        ? 2
        : difference < 3
          ? 3
          : 4;
}

// Hand translation of physical overlay3 (logical INT3f6), original3318 bytes.
// Pages are immutable drawing-command lists. They are simulation outputs; no
// pixels, browser clock or audio completion feeds this routine.
export class BankScene {
  constructor({
    entries,
    image,
    banked,
    rivalBanked,
    seed,
    audioEnabled = false,
    pollInput = () => true,
    flushInput = () => {},
    memory,
  }) {
    if (
      entries?.length !== 15 ||
      entries[5].type !== 1 ||
      entries[5].width !== 320 ||
      entries[5].height !== 200
    )
      throw Error("Missing supported MAC.ARC bank resources");
    if (!Number.isInteger(seed) || seed < 0 || seed > 65535)
      throw Error("Invalid bank RNG seed");
    const bytes = new Uint8Array(65536);
    if (image) {
      if (image.length !== 87664) throw Error("Invalid bank executable image");
      bytes.set(image.subarray(0x120e0));
    }
    this.memory = memory ?? new FlightMemory(bytes);
    const m = this.memory;
    for (const [at, asset] of BANK_SPRITES) {
      const e = entries[asset];
      if (e.type !== 2 || e.width % 8)
        throw Error(`Invalid bank sprite ${asset}`);
      for (const [offset, value] of [
        [0, 0],
        [2, 0],
        [4, e.width / 8],
        [6, e.height],
        [8, (e.width * e.frames) / 8],
        [10, e.height],
      ])
        m.i(at + offset, value);
      m.b(at + 18, 0);
    }
    m.view.setUint32(0x5ae2, banked, true);
    m.view.setUint32(0x54f2, rivalBanked, true);
    if (
      ![banked, rivalBanked].every(
        (n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff,
      )
    )
      throw Error("Invalid banked amount");
    this.banked = u32(banked);
    this.rivalBanked = u32(rivalBanked);
    this.seed = u16(seed);
    this.randomDraws = 0;
    this.rivalTier = bankPileTier(rivalBanked);
    this.playerTier = bankPileTier(banked);
    this.target = bankScaleTarget(this.rivalTier, this.playerTier);
    this.scaleLimit =
      this.rivalTier === -1 && this.playerTier === -1 ? 0 : this.target + 14;
    this.pose = 2;
    this.phase = "wipe";
    this.complete = false;
    this.pages = [black, black];
    this.visiblePage = 0;
    this.drawingPage = 1;
    this.background = background;
    this.transition = null;
    this.transitionToken = 0;
    this.controls = { fire: false, direction: null };
    this.fireRequested = false;
    this.audioEnabled = false;
    this.setAudioEnabled(audioEnabled);
    this.pollInput = pollInput;
    this.onFlushInput = flushInput;
    this.events = [];
    this.tick = 0;
    this.retrace = 0;
    this.inputReads = 0;
    this.balanceStep = 0;
    this.idleFrame = 0;
    this.idleSide = 0;
    this.iterator = this.run();
    this.resume();
  }
  get frame() {
    return this.pages[this.visiblePage];
  }
  get ready() {
    return this.phase === "idle" || this.phase === "outro";
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean") throw Error("Invalid bank audio setting");
    this.audioEnabled = enabled;
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "down", "left", "right"].includes(controls.direction)
    )
      throw Error("Invalid bank controls");
    this.controls = { ...controls };
  }
  input(event) {
    if (event.type === "fire" && !this.complete) this.fireRequested = true;
  }
  flushInput(release = false) {
    this.fireRequested = false;
    if (release) this.controls = { fire: false, direction: null };
    this.onFlushInput(release);
  }
  sound(id) {
    if (this.audioEnabled) this.events.push({ type: "sound", id });
  }
  drainEvents() {
    return this.events.splice(0);
  }
  random() {
    this.seed = nextRandom(this.seed);
    this.randomDraws++;
    this.memory.i(0x2229, this.seed);
    return this.seed;
  }
  command(command) {
    this.pages[this.drawingPage] = [...this.pages[this.drawingPage], command];
  }
  draw(at) {
    const asset = BANK_SPRITES.get(at);
    if (asset === undefined)
      throw Error(`Unsupported bank sprite descriptor ${at.toString(16)}`);
    const m = this.memory;
    this.command({
      op: "sprite",
      asset,
      x: m.i(at),
      y: m.i(at + 2),
      frame: m.b(at + 18),
    });
  }
  text(text, x, y, color = 15, opaque = false) {
    if (opaque)
      this.command({
        op: "fill",
        x,
        y,
        width: text.length * 8,
        height: 8,
        color,
      });
    this.command({ op: "text", text, x, y, color });
  }
  *flip() {
    this.visiblePage = this.drawingPage;
    this.drawingPage ^= 1;
    yield { clock: "retrace", remaining: 1 };
  }
  *bands(kind, initial = false) {
    const token = ++this.transitionToken;
    const source = initial ? null : this.frame,
      target = kind === "wipe" ? black : this.pages[this.drawingPage];
    for (let band = 0; band < 5; band++) {
      this.transition = { kind, band, token, source, target };
      yield { clock: "retrace", remaining: 5 };
    }
    this.pages[this.visiblePage] = target;
    this.transition = null;
  }
  *readInput() {
    const ready = this.pollInput();
    if (typeof ready !== "boolean")
      throw Error("Invalid bank global input provider");
    if (!ready) yield { clock: "input", remaining: 1 };
    this.inputReads++;
    const fire = this.fireRequested || this.controls.fire;
    this.fireRequested = false;
    return fire;
  }
  *dialogue(count) {
    this.flushInput();
    for (let i = 0; i < count; i++) {
      if (yield* this.readInput()) return;
      yield { clock: "driver", remaining: 7 };
    }
  }
  drawScale(pose) {
    const m = this.memory;
    const [asset, leftX, leftY, rightX, rightY, character] =
      [
        [0, 8, 44, 208, 116, 1],
        [1, 0, 62, 208, 97, 1],
        [2, 0, 79, 212, 79, 2],
        [4, 0, 97, 208, 62, 3],
        [3, 8, 116, 208, 44, 3],
      ][pose] ?? [];
    if (asset === undefined) throw Error(`Unsupported bank scale pose ${pose}`);
    const at = [...BANK_SPRITES].find(([, a]) => a === asset)[0];
    this.draw(at);
    for (const [side, x, y, tier] of [
      [0, leftX, leftY, this.rivalTier],
      [1, rightX, rightY, this.playerTier],
    ]) {
      m.i(0x3668, x);
      m.i(0x366a, y);
      for (let level = 0; level <= tier; level++) {
        const pile = u16(0x35cc + level * 20);
        if (!BANK_SPRITES.has(pile))
          throw Error(
            `Unsupported original bank pile alias ${pile.toString(16)}`,
          );
        let px = s16((112 - s16(m.i(pile + 4) << 3)) >> 1) + x,
          py = y - m.i(pile + 6);
        if (level === 1) py -= 14;
        else if (level === 3) {
          px -= 8;
          py -= 13;
        } else if (level === 4) py -= 27;
        m.i(pile, px);
        m.i(pile + 2, py);
        this.draw(pile);
        m.i(side === 0 ? 0x36c4 : 0x36c0, px);
        m.i(side === 0 ? 0x36c6 : 0x36c2, py);
      }
      this.draw(0x3668);
    }
    m.b(0x3642, character);
    m.b(0x35ca, character);
  }
  *numbers() {
    let rival = signed(this.rivalBanked),
      player = signed(this.banked),
      a = "",
      b = "";
    this.phase = "numbers";
    do {
      if (rival > 0 || a === "")
        a = String.fromCharCode(((rival % 10) + 48) & 255) + a;
      if (player > 0 || b === "")
        b = String.fromCharCode(((player % 10) + 48) & 255) + b;
      this.text(a, 186 - a.length * 8, 191);
      this.text(b, 186 - b.length * 8, 179);
      this.balanceStep++;
      yield* this.flip();
      yield { clock: "driver", remaining: 14 };
      rival = Math.trunc(rival / 10);
      player = Math.trunc(player / 10);
    } while (rival > 0 || player > 0);
    this.text(a, 186 - a.length * 8, 191);
    this.text(b, 186 - b.length * 8, 179);
    yield* this.flip();
  }
  *idle() {
    const m = this.memory;
    this.phase = "idle";
    this.flushInput();
    const rivalAt = u16(0x35cc + this.rivalTier * 20),
      playerAt = u16(0x35cc + this.playerTier * 20);
    while (true) {
      if (yield* this.readInput()) {
        this.sound(36);
        this.flushInput();
        return;
      }
      if (this.idleFrame > 4) {
        this.idleSide = 0;
        this.idleFrame = 0;
      }
      // The RNG call precedes the frame test even during an active sparkle.
      const roll = this.random();
      if (roll % 100 < 51 && this.idleFrame === 0) {
        this.pages[this.drawingPage] = this.background;
        yield* this.flip();
        yield { clock: "driver", remaining: 73 };
        continue;
      }
      if (this.idleFrame === 0) {
        this.pages[this.drawingPage] = this.background;
        yield* this.flip();
        this.pages[this.drawingPage] = this.background;
        yield* this.flip();
        const choose = this.random();
        let at;
        if ((choose & 1) !== 0 && this.rivalTier >= 0) {
          this.idleSide = 1;
          at = rivalAt;
        } else if (this.playerTier >= 0) {
          this.idleSide = 2;
          at = playerAt;
        }
        if (at !== undefined) {
          const height = u16(m.i(at + 6));
          // The player-side random width is hard-coded <<3; preserve it.
          const width = u16(m.i(at + 4) << 3);
          if (!height || !width)
            throw Error("Original bank sparkle divides by zero");
          this.sparkleY = this.random() % height;
          this.sparkleX =
            s16(this.sparkleY) < m.i(at + 6) >> 1
              ? s16(width) >> 1
              : this.random() % width;
          if (s16(this.sparkleY) < m.i(at + 6) >> 1)
            this.sparkleX = s16(this.sparkleX - 5);
          if (s16(this.sparkleX) < 14) this.sparkleX = 14;
          else if (s16(this.sparkleX) > s16(width - 16))
            this.sparkleX = s16(width - 16);
        }
      }
      if (
        (this.idleSide === 1 && this.rivalTier >= 0) ||
        (this.idleSide === 2 && this.playerTier >= 0)
      ) {
        const left = this.idleSide === 1;
        const x = Math.max(0, s16(this.sparkleX + m.i(left ? 0x36c4 : 0x36c0))),
          y = s16(this.sparkleY + m.i(left ? 0x36c6 : 0x36c2));
        m.i(0x3644, x);
        m.i(0x3646, y);
        m.b(0x3656, this.idleFrame++);
        this.command({
          op: "restore",
          source: this.background,
          sourceX: x & 0xfff8,
          sourceY: y,
          x: x & 0xfff8,
          y,
          width: 32,
          height: 18,
        });
        this.draw(0x3644);
      }
      yield* this.flip();
      yield { clock: "driver", remaining: 7 };
    }
  }
  *run() {
    const m = this.memory;
    yield* this.bands("wipe", true);
    this.pages[this.drawingPage] = black;
    this.sound(0);
    this.flushInput();
    for (const [at, x, y] of [
      [0x3684, 40, 79],
      [0x3590, 40, 98],
      [0x36ac, 40, 116],
      [0x3698, 48, 79],
      [0x35a4, 40, 98],
      [0x3630, 2, 201 - m.i(0x3636)],
      [0x35b8, 238, 203 - m.i(0x35be)],
    ]) {
      m.i(at, x);
      m.i(at + 2, y);
    }
    this.phase = "scales";
    const limit = this.scaleLimit;
    let increment = 1,
      low = 0,
      high = 4,
      contract = true,
      repeat = true;
    for (let step = 0; step <= limit; step++) {
      this.pages[this.drawingPage] = this.background;
      this.drawScale(this.pose);
      this.draw(0x3630);
      this.draw(0x35b8);
      this.text("$$$$$$$$$$", 106, 179);
      this.text("$$$$$$$$$$", 106, 191);
      if (step === 0 && this.transitionToken === 1) yield* this.bands("reveal");
      else yield* this.flip();
      if (step < limit) {
        if (
          Math.trunc((this.target + 14) / 3) < step &&
          this.target > 0 &&
          this.target < 4 &&
          this.pose > 0 &&
          this.pose < 4 &&
          contract
        ) {
          contract = false;
          low = 1;
          high = 3;
        }
        this.pose += increment;
        if (this.pose > high) {
          this.pose = high - 1;
          increment = -1;
          this.sound(67);
        } else if (this.pose < low) {
          this.pose = low + 1;
          increment = 1;
          this.sound(68);
        }
      } else if (step === limit && repeat) {
        step = limit - 1;
        repeat = false;
      }
    }
    for (let page = 0; page < 2; page++) {
      this.text("          ", 106, 179, 4, true);
      this.text("          ", 106, 191, 4, true);
      yield* this.flip();
    }
    yield* this.numbers();
    this.phase = "characters";
    m.b(0x35ca, this.pose);
    m.b(0x3642, this.pose);
    this.draw(0x35b8);
    this.draw(0x3630);
    yield* this.flip();
    if (m.b(0x3642) === 4)
      for (let i = 0; i < 7; i++) {
        m.b(0x3642, 4);
        m.b(0x35ca, 5);
        this.draw(0x35b8);
        this.draw(0x3630);
        yield* this.flip();
        m.b(0x3642, 5);
        m.b(0x35ca, 5);
        this.draw(0x35b8);
        this.draw(0x3630);
        yield* this.flip();
      }
    this.background = this.pages[this.drawingPage];
    yield* this.flip();
    yield* this.idle();
    this.phase = "outro";
    yield* this.dialogue(40);
    // Main1076..107e clears the drawing page and flips after the bank returns.
    this.phase = "return";
    this.pages[this.drawingPage] = black;
    yield* this.flip();
    this.phase = "complete";
    this.complete = true;
  }
  resume() {
    const next = this.iterator.next();
    if (next.done) {
      this.wait = null;
      return;
    }
    const w = next.value;
    if (
      !["driver", "retrace", "input"].includes(w.clock) ||
      !Number.isInteger(w.remaining) ||
      w.remaining < 1
    )
      throw Error("Invalid bank wait");
    this.wait = w;
  }
  advance(clock) {
    if (this.wait?.clock === clock && --this.wait.remaining === 0)
      this.resume();
  }
  advanceTick(controls) {
    if (controls) this.setControls(controls);
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
  resumeInputPoll() {
    if (this.wait?.clock !== "input")
      throw Error("Bank resumed outside its input reader");
    this.resume();
  }
  snapshot() {
    return {
      phase: this.phase,
      banked: this.banked,
      rivalBanked: this.rivalBanked,
      seed: this.seed,
      randomDraws: this.randomDraws,
      pose: this.pose,
      target: this.target,
      scaleLimit: this.scaleLimit,
      rivalTier: this.rivalTier,
      playerTier: this.playerTier,
      balanceStep: this.balanceStep,
      idleFrame: this.idleFrame,
      idleSide: this.idleSide,
      inputReads: this.inputReads,
      remaining: this.wait?.clock === "driver" ? this.wait.remaining : 0,
      ready: this.ready,
      complete: this.complete,
      ...(this.transition
        ? {
            transition: {
              kind: this.transition.kind,
              band: this.transition.band,
              token: this.transition.token,
            },
          }
        : {}),
      ...(this.wait?.clock === "input" ? { waitingForInputPoll: true } : {}),
    };
  }
}
