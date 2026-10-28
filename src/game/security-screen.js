import {
  securitySetup,
  securityInput,
  securityCommands,
  securityNoticeCommands,
} from "./security.js";
import { renderFlightPixels } from "./flight-raster.js";
import { endingTransitionPixels } from "./ending-presentation.js";
const BLACK = [{ op: "fill", x: 0, y: 0, width: 320, height: 200, color: 0 }];

// Overlay2:07ad..0ca9 and the first-map blank flip at0d0b. Providers supply
// consumed input and keyboard flushes; the component never reads a browser clock.
export class SecurityScreen {
  constructor({
    image,
    entries,
    seed,
    day,
    money,
    audioEnabled = false,
    pollInput = () => true,
    readInput = null,
    flushInput = () => {},
    initialFrame = BLACK,
  }) {
    if (
      image?.length !== 87664 ||
      entries?.length !== 43 ||
      entries[20]?.width !== 320 ||
      entries[20]?.height !== 200 ||
      entries[40]?.width !== 208 ||
      entries[42]?.data.length !== 2056
    )
      throw Error("Missing original security resources");
    if (
      typeof audioEnabled !== "boolean" ||
      typeof pollInput !== "function" ||
      (readInput !== null && typeof readInput !== "function") ||
      typeof flushInput !== "function"
    )
      throw Error("Invalid security environment provider");
    if (!Number.isInteger(day) || !Number.isInteger(money))
      throw Error("Missing security campaign state");
    // Validate the initial state before starting the generator or calling providers.
    const setup = securitySetup(seed);
    securityCommands(image, setup, { day, money });
    Object.assign(this, {
      image,
      entries,
      seed,
      day,
      money,
      audioEnabled,
      pollInput,
      readInput,
      onFlushInput: flushInput,
    });
    this.initialSeed = seed;
    this.setup = null;
    this.selection = 0;
    this.failures = 0;
    this.tick = 0;
    this.retrace = 0;
    this.presentations = 0;
    this.inputReads = 0;
    this.inputs = [];
    this.events = [];
    this.controls = { fire: false, direction: null };
    this.firePulse = false;
    this.directionPulse = null;
    this.escapePulse = false;
    this.phase = "entry";
    if (!Array.isArray(initialFrame) || initialFrame.length === 0)
      throw Error("Missing security previous display");
    this.frame = initialFrame;
    this.drawing = BLACK;
    this.transition = null;
    this.outcome = null;
    this.iterator = this.run();
    this.resume();
  }
  get ready() {
    return ["challenge", "poll-wait"].includes(this.phase) && !this.outcome;
  }
  setAudioEnabled(value) {
    if (typeof value !== "boolean") throw Error("Invalid security sound flag");
    this.audioEnabled = value;
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "right", "down", "left"].includes(controls.direction)
    )
      throw Error("Invalid security controls");
    this.controls = { ...controls };
  }
  input(event) {
    if (event.type === "fire") this.firePulse = true;
    else if (["up", "right", "down", "left"].includes(event.type))
      this.directionPulse = event.type;
    else if (event.type === "back") this.escapePulse = true;
    else throw Error(`Unsupported security input ${event.type}`);
  }
  sound(id) {
    if (this.audioEnabled) this.events.push({ type: "sound", id });
  }
  commands(highlight = true) {
    return securityCommands(this.image, this.setup, {
      selection: this.selection,
      day: this.day,
      money: this.money,
      highlight,
    });
  }
  notice(kind) {
    this.drawing = [
      ...this.drawing,
      ...securityNoticeCommands(this.image, kind),
    ];
  }
  *flip(commands = null) {
    if (commands) this.drawing = commands;
    yield { clock: "retrace", remaining: 1 };
    [this.frame, this.drawing] = [this.drawing, this.frame];
    this.presentations++;
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
  flushInput() {
    this.firePulse = false;
    this.directionPulse = null;
    this.escapePulse = false;
    this.controls = { fire: false, direction: null };
    this.onFlushInput();
  }
  *poll() {
    while (true) {
      const ready = this.pollInput();
      if (typeof ready !== "boolean")
        throw Error("Invalid security input-poll result");
      if (ready) break;
      yield { clock: "input", remaining: 1 };
    }
    const byte = this.readInput
      ? this.readInput()
      : (this.controls.fire || this.firePulse ? 192 : 0) |
        ({ up: 1, right: 3, down: 5, left: 7 }[
          this.controls.direction ?? this.directionPulse
        ] ?? 0) |
        (this.escapePulse ? 32 : 0);
    const result = securityInput(
      this.selection,
      this.failures,
      this.setup.targetRow,
      byte,
    );
    this.firePulse = false;
    this.directionPulse = null;
    this.escapePulse = false;
    this.inputs.push({
      index: ++this.inputReads,
      byte,
      tick: this.tick,
      retrace: this.retrace,
    });
    return { byte, result };
  }
  *run() {
    yield* this.flip(BLACK);
    this.sound(33);
    this.setup = securitySetup(this.seed);
    this.seed = this.setup.seed;
    this.sound(0);
    this.phase = "reveal";
    yield* this.bands("reveal", this.commands(false));
    this.sound(111);
    yield* this.flip(this.commands(false));
    this.flushInput();
    yield* this.flip(this.commands());
    while (true) {
      this.phase = "challenge";
      const { byte, result } = yield* this.poll();
      this.selection = result.selection;
      if (result.redraw) {
        this.phase = "selection";
        // Helper06d0 reconstructs the back page from the saved clean challenge.
        // This deliberately erases a previous warning before the seven-count wait.
        yield* this.flip(this.commands());
        yield { clock: "driver", remaining: 7 };
      }
      this.flushInput();
      if (result.action === "accept") break;
      if (result.action === "warning") {
        this.phase = "warning";
        yield* this.flip();
        this.notice("warning");
        this.sound(70);
        yield* this.flip();
        yield { clock: "driver", remaining: 35 };
        this.failures = 1;
      } else if (result.action === "alarm") {
        this.phase = "alarm";
        this.notice("clear-warning");
        for (let cycle = 0; cycle < 3; cycle++) {
          this.alarmPhase = cycle * 2;
          yield* this.flip();
          this.notice("red");
          this.sound(70);
          yield* this.flip();
          yield { clock: "driver", remaining: 35 };
          this.alarmPhase = cycle * 2 + 1;
          yield* this.flip();
          this.notice("blank");
          yield* this.flip();
          yield { clock: "driver", remaining: 35 };
        }
        this.failures = 2;
        break;
      }
      this.phase = "poll-wait";
      yield { clock: "driver", remaining: 1 };
    }
    this.phase = "exit";
    yield* this.bands("wipe", BLACK);
    this.sound(33);
    this.flushInput();
    this.outcome = { code: 1, seed: this.seed };
    this.phase = "complete";
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
      throw Error("Invalid security wait");
  }
  advance(clock) {
    if (clock === "driver") this.tick++;
    else if (clock === "retrace") this.retrace++;
    else throw Error("Invalid security clock");
    if (
      !this.wait ||
      (this.wait.clock !== clock &&
        !(clock === "driver" && this.wait.clock === "input"))
    )
      return;
    if (--this.wait.remaining === 0) this.resume();
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
  pixels() {
    const render = (commands) =>
      renderFlightPixels(
        commands,
        this.entries,
        this.entries[42].data,
        "MAIN.ARC",
      );
    return this.transition
      ? endingTransitionPixels(
          this.transition,
          render(this.transition.source),
          render(this.transition.target),
        )
      : render(this.frame);
  }
  snapshot() {
    return {
      phase: this.phase,
      selection: this.selection,
      failures: this.failures,
      seed: this.seed,
      target: this.setup?.target ?? null,
      targetRow: this.setup?.targetRow ?? null,
      tick: this.tick,
      retrace: this.retrace,
      presentations: this.presentations,
      inputReads: this.inputReads,
      lastInputCode: this.inputs.at(-1)?.byte ?? null,
      ready: this.ready,
      alarmPhase: this.alarmPhase ?? null,
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
