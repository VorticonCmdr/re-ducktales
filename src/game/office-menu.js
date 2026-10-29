import {
  officeCommands,
  officeInput,
  officeSelectionCommands,
} from "./office.js";
import { renderFlightPixels } from "./flight-raster.js";
import { endingTransitionPixels } from "./ending-presentation.js";

const BLACK = [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 }];
const directions = { up: 1, right: 3, down: 5, left: 7 };
const keyDirections = { 0x48: 1, 0x4b: 7, 0x4d: 3, 0x50: 5 };
const keySet = new Set([0x1c, 0x39, 0x48, 0x4b, 0x4d, 0x50]);

// Overlay2:02e4..0482. Input and clocks are supplied by the caller; the visible
// page used by the entry wipe is an explicit renderer argument, never game state.
export class OfficeMenu {
  constructor({
    image,
    entries,
    audioEnabled = false,
    pollInput = () => true,
    readInput = null,
    flushInput = () => {},
  }) {
    if (
      image?.length !== 87664 ||
      entries?.length !== 43 ||
      entries[42]?.data.length !== 2056
    )
      throw Error("Missing original office menu resources");
    if (
      typeof audioEnabled !== "boolean" ||
      typeof pollInput !== "function" ||
      (readInput !== null && typeof readInput !== "function") ||
      typeof flushInput !== "function"
    )
      throw Error("Invalid office menu providers");
    Object.assign(this, {
      image,
      entries,
      audioEnabled,
      pollInput,
      readInput,
      onFlushInput: flushInput,
    });
    this.tick = this.retrace = this.presentations = this.inputReads = 0;
    this.events = [];
    this.controls = { fire: false, direction: null };
    this.firePulse = false;
    this.directionPulse = null;
    this.keyboardFlags = null;
    this.keyboardHeld = new Set();
    this.selection = null;
    this.lastInput = null;
    this.frame = BLACK;
    this.pending = this.transition = this.outcome = null;
    this.phase = "entry";
    this.iterator = this.run();
    this.resume();
  }
  get ready() {
    return this.phase === "menu" && !this.outcome;
  }
  setControls(c) {
    if (
      typeof c.fire !== "boolean" ||
      (c.direction !== null && !Object.hasOwn(directions, c.direction))
    )
      throw Error("Invalid office controls");
    if (c.officeKeys !== undefined) {
      if (
        !Array.isArray(c.officeKeys) ||
        c.officeKeys.some((k) => !keySet.has(k)) ||
        new Set(c.officeKeys).size !== c.officeKeys.length
      )
        throw Error("Invalid office keyboard flags");
      if (this.keyboardFlags === null) {
        this.keyboardFlags = new Map();
        // Preserve an already-held joystick/key provider at the entry boundary
        // until the browser supplies its first explicit keyboard state.
        if (this.controls.fire && !c.fire) this.firePulse = true;
        if (this.controls.direction && !c.direction)
          this.directionPulse = this.controls.direction;
      }
      const held = new Set(c.officeKeys);
      for (const k of this.keyboardHeld)
        if (!held.has(k) && this.keyboardFlags.has(k))
          this.keyboardFlags.set(k, 0x40);
      for (const k of held) this.keyboardFlags.set(k, 0x80);
      this.keyboardHeld = held;
    }
    this.controls = { ...c };
  }
  setAudioEnabled(value) {
    if (typeof value !== "boolean") throw Error("Invalid office audio flag");
    this.audioEnabled = value;
  }
  input(event) {
    if (event.physicalKey && this.keyboardFlags !== null) return;
    const target = { "money-bin": "up", map: "right", investments: "left" }[
      event.type
    ];
    if (target) {
      this.firePulse = true;
      this.directionPulse = target;
    } else if (event.type === "fire") {
      this.firePulse = true;
      if (event.direction) this.directionPulse = event.direction;
    } else if (Object.hasOwn(directions, event.type))
      this.directionPulse = event.type;
    else throw Error(`Unsupported office menu input ${event.type}`);
  }
  flushInput(release = false) {
    this.firePulse = false;
    this.directionPulse = null;
    this.keyboardFlags?.clear();
    this.keyboardHeld.clear();
    if (release) this.controls = { fire: false, direction: null };
    this.onFlushInput(release);
  }
  *bands(kind) {
    for (let band = 0; band < 5; band++) {
      this.transition = { kind, band };
      yield { clock: "retrace", remaining: 5 };
    }
    this.transition = null;
    this.frame = kind === "wipe" ? BLACK : officeCommands();
  }
  *poll() {
    while (true) {
      const ready = this.pollInput();
      if (typeof ready !== "boolean") throw Error("Invalid office poll result");
      if (ready) break;
      yield { clock: "input", remaining: 1 };
    }
    let keyboardDirection = null,
      keyboardFire = false;
    if (this.keyboardFlags !== null) {
      for (const [key, flag] of [...this.keyboardFlags].sort(
        (a, b) => a[0] - b[0],
      )) {
        if (key === 0x1c || key === 0x39) keyboardFire = true;
        else keyboardDirection = keyDirections[key];
        if (flag === 0x40) this.keyboardFlags.delete(key);
      }
    }
    const byte = this.readInput
      ? this.readInput()
      : ((this.keyboardFlags === null ? this.controls.fire : keyboardFire) ||
        this.firePulse
          ? 192
          : 0) |
        (keyboardDirection ??
          directions[
            (this.keyboardFlags === null ? this.controls.direction : null) ??
              this.directionPulse
          ] ??
          0);
    officeInput(byte);
    this.firePulse = false;
    this.directionPulse = null;
    this.inputReads++;
    this.lastInput = byte;
    return byte;
  }
  *run() {
    if (this.audioEnabled) this.events.push({ type: "sound", id: 0 });
    this.phase = "wipe";
    yield* this.bands("wipe");
    if (this.audioEnabled) this.events.push({ type: "sound", id: 6 });
    this.phase = "reveal";
    yield* this.bands("reveal");
    // There is no19a5 flush here: keys from the reveal reach the first poll.
    this.phase = "menu";
    while (true) {
      const byte = yield* this.poll(),
        result = officeInput(byte);
      this.selection = result.selection;
      this.pending = officeSelectionCommands(this.image, byte);
      yield { clock: "retrace", remaining: 1 };
      yield { clock: "driver", remaining: 1 };
      if (result.action) {
        this.outcome = { action: result.action };
        this.phase = "complete";
        return;
      }
    }
  }
  resume() {
    const next = this.iterator.next();
    this.wait = next.done ? null : next.value;
    if (
      this.wait &&
      (!["driver", "retrace", "input"].includes(this.wait.clock) ||
        !Number.isInteger(this.wait.remaining) ||
        this.wait.remaining < 1)
    )
      throw Error("Invalid office menu wait");
  }
  advance(clock) {
    if (clock === "driver") this.tick++;
    else if (clock === "retrace") this.retrace++;
    else throw Error("Invalid office menu clock");
    if (
      !this.wait ||
      (this.wait.clock !== clock &&
        !(clock === "driver" && this.wait.clock === "input"))
    )
      return;
    if (--this.wait.remaining) return;
    if (clock === "retrace" && this.pending) {
      this.frame = this.pending;
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
  drainEvents() {
    return this.events.splice(0);
  }
  pixels(incoming) {
    const render = (commands) =>
      renderFlightPixels(
        commands,
        this.entries,
        this.entries[42].data,
        "MAIN.ARC",
      );
    if (!this.transition) return render(this.frame);
    return endingTransitionPixels(
      this.transition,
      this.transition.kind === "wipe" ? incoming : render(BLACK),
      render(officeCommands()),
    );
  }
  snapshot() {
    return {
      phase: this.phase,
      ready: this.ready,
      selection: this.selection,
      tick: this.tick,
      retrace: this.retrace,
      presentations: this.presentations,
      inputReads: this.inputReads,
      lastInput: this.lastInput,
      ...(this.keyboardFlags !== null
        ? { keyboardFlags: [...this.keyboardFlags].sort((a, b) => a[0] - b[0]) }
        : {}),
      wait: this.wait ? { ...this.wait } : null,
      outcome: this.outcome,
      ...(this.transition ? { transition: { ...this.transition } } : {}),
    };
  }
}
