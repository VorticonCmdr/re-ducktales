import {
  difficultyCommands,
  difficultyInitialCommands,
  difficultyInput,
} from "./difficulty.js";
import { renderFlightPixels } from "./flight-raster.js";
import { endingTransitionPixels } from "./ending-presentation.js";

const BLACK = [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 }];

// Resident12f5:0aeb. External providers own global dialogs and the BIOS word;
// neither wall time nor randomness is obtained inside this component.
export class DifficultyMenu {
  constructor({
    image,
    entries,
    readBiosSeed,
    audioEnabled = false,
    pollInput = () => true,
    readInput = null,
    flushInput = () => {},
  }) {
    if (
      image?.length !== 87664 ||
      entries?.length !== 43 ||
      entries[32]?.width !== 320 ||
      entries[32]?.height !== 200 ||
      entries[42]?.data.length !== 2056
    )
      throw Error("Missing original difficulty resources");
    if (
      typeof readBiosSeed !== "function" ||
      typeof audioEnabled !== "boolean" ||
      typeof pollInput !== "function" ||
      (readInput !== null && typeof readInput !== "function") ||
      typeof flushInput !== "function"
    )
      throw Error("Invalid difficulty environment provider");
    Object.assign(this, {
      image,
      entries,
      readBiosSeed,
      audioEnabled,
      pollInput,
      readInput,
      onFlushInput: flushInput,
    });
    this.selection = 0;
    this.tick = 0;
    this.retrace = 0;
    this.inputReads = 0;
    this.inputs = [];
    this.events = [];
    this.controls = { fire: false, direction: null };
    this.firePulse = false;
    this.directionPulse = null;
    this.phase = "entry";
    this.frame = BLACK;
    this.pending = null;
    this.transition = null;
    this.outcome = null;
    this.biosSeed = null;
    this.iterator = this.run();
    this.resume();
  }
  get ready() {
    return this.phase === "menu" && !this.outcome;
  }
  setAudioEnabled(value) {
    if (typeof value !== "boolean")
      throw Error("Invalid difficulty sound flag");
    this.audioEnabled = value;
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "right", "down", "left"].includes(controls.direction)
    )
      throw Error("Invalid difficulty controls");
    this.controls = { ...controls };
  }
  input(event) {
    if (event.type === "fire") this.firePulse = true;
    else if (["up", "down"].includes(event.type))
      this.directionPulse = event.type;
    else throw Error(`Unsupported difficulty input ${event.type}`);
  }
  sound() {
    if (this.audioEnabled) this.events.push({ type: "sound", id: 36 });
  }
  *bands(kind, target) {
    const source = this.frame;
    for (let band = 0; band < 5; band++) {
      this.transition = { kind, band, source, target };
      yield { clock: "retrace", remaining: 5 };
    }
    this.frame = target;
    this.transition = null;
  }
  *poll() {
    while (true) {
      const ready = this.pollInput();
      if (typeof ready !== "boolean")
        throw Error("Invalid difficulty input-poll result");
      if (ready) break;
      yield { clock: "input", remaining: 1 };
    }
    const byte = this.readInput
      ? this.readInput()
      : (this.controls.fire || this.firePulse ? 192 : 0) |
        ({ up: 1, right: 3, down: 5, left: 7 }[
          this.controls.direction ?? this.directionPulse
        ] ?? 0);
    // Validate before recording or consuming a queued Fire pulse.
    difficultyInput(this.selection, byte);
    this.firePulse = false;
    this.directionPulse = null;
    this.inputs.push({
      index: ++this.inputReads,
      byte,
      tick: this.tick,
      retrace: this.retrace,
    });
    return byte;
  }
  flushInput(release = false) {
    this.firePulse = false;
    this.directionPulse = null;
    if (release) this.controls = { fire: false, direction: null };
    this.onFlushInput(release);
  }
  *run() {
    // Fill drawing page0, flip to black, then fill the other drawing page0.
    yield { clock: "retrace", remaining: 1 };
    this.phase = "reveal";
    yield* this.bands("reveal", difficultyInitialCommands(this.image));
    // Flush queued taps, preserving the external physical-joystick provider.
    this.flushInput();
    this.phase = "menu";
    let byte = 0;
    while (true) {
      const next = difficultyInput(this.selection, byte);
      this.selection = next.selection;
      if (next.action === "quit") {
        this.outcome = { code: 37, selection: this.selection };
        this.phase = "complete";
        return;
      }
      if (next.sound !== null) this.sound();
      if (next.action === "confirm") {
        const biosSeed = this.readBiosSeed();
        if (!Number.isInteger(biosSeed) || biosSeed < 0 || biosSeed > 65535)
          throw Error("Invalid difficulty BIOS seed");
        this.biosSeed = biosSeed;
        this.phase = "exit";
        yield* this.bands("wipe", BLACK);
        this.outcome = { code: 0, selection: this.selection, biosSeed };
        this.phase = "complete";
        return;
      }
      this.pending = difficultyCommands(this.image, this.selection);
      yield { clock: "retrace", remaining: 1 };
      yield { clock: "driver", remaining: 7 };
      byte = yield* this.poll();
    }
  }
  resume() {
    const next = this.iterator.next();
    if (next.done) {
      this.wait = null;
      return;
    }
    const wait = next.value;
    if (
      !["driver", "retrace", "input"].includes(wait.clock) ||
      !Number.isInteger(wait.remaining) ||
      wait.remaining < 1
    )
      throw Error("Invalid difficulty wait");
    this.wait = wait;
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
    if (--this.wait.remaining) return;
    if (clock === "retrace" && this.pending) {
      this.frame = this.pending;
      this.pending = null;
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
    const events = this.events;
    this.events = [];
    return events;
  }
  pixels() {
    const render = (commands) =>
      renderFlightPixels(
        commands,
        this.entries,
        this.entries[42].data,
        "MAIN.ARC",
      );
    if (this.transition)
      return endingTransitionPixels(
        this.transition,
        render(this.transition.source),
        render(this.transition.target),
      );
    return render(this.frame);
  }
  snapshot() {
    return {
      phase: this.phase,
      selection: this.selection,
      tick: this.tick,
      retrace: this.retrace,
      ready: this.ready,
      inputReads: this.inputReads,
      biosSeed: this.biosSeed,
      wait: this.wait ? { ...this.wait } : null,
      outcome: this.outcome ? { ...this.outcome } : null,
      ...(this.transition
        ? {
            transition: {
              kind: this.transition.kind,
              band: this.transition.band,
            },
          }
        : {}),
    };
  }
}
