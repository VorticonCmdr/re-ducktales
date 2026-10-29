import { u32 } from "./integer.js";
import { destinationInput } from "./destination-input.js";
const word = (value) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw Error("Invalid destination driver clock");
  return value;
};

// Explicit waits in overlay2:1757..1ec7 and EGA driver0101/0155/e5.
// This component accepts an already-read byte. The recurring raw mode1 reader
// and CPU time spent drawing its footer are not represented by this interface.
export class DestinationWaits {
  constructor(clock, atomicAvailable = false) {
    if (typeof atomicAvailable !== "boolean")
      throw Error("Invalid destination transport flag");
    this.clock = word(clock);
    this.atomicAvailable = atomicAvailable;
    this.choice = this.visibleChoice = 0;
    this.phase = "wipe";
    this.transition = { kind: "wipe", band: 0 };
    this.retracesRemaining = 5;
    this.driverDeadline = null;
    this.retraces = this.inputs = this.discardedDuringWait = 0;
    this.events = [];
    this.outcome = null;
    this.pendingReturn = null;
    this.lastInputClock = null;
  }
  get ready() {
    return this.phase === "ready";
  }
  get confirming() {
    return ["confirm-flip", "confirm-wait", "complete"].includes(this.phase);
  }
  input(byte, clock) {
    this.clock = word(clock);
    // Validate even inactive calls. There is no permissive unknown-byte path.
    const result = destinationInput(this.choice, byte, this.atomicAvailable);
    if (!this.ready) {
      this.discardedDuringWait++;
      return false;
    }
    this.inputs++;
    this.lastInputClock = this.clock;
    this.choice = result.choice;
    if (result.confirmed) {
      this.pendingReturn = result.returnCode;
      this.flip("confirm-flip");
    } else if (result.changed) {
      this.events.push({ type: "sound", id: 0x24 });
      this.waitDriver("selection-wait", 7);
    } else this.flip("selection-flip");
    return true;
  }
  flip(phase) {
    // 1d35/1d42 set the transport flag while drawing the selector, before flip.
    if (this.choice)
      this.events.push({
        type: "transport",
        aircraft: this.choice === 2 ? "atomic" : "launchpad",
      });
    this.phase = phase;
    this.retracesRemaining = 1;
    this.driverDeadline = null;
  }
  waitDriver(phase, counts) {
    this.phase = phase;
    this.retracesRemaining = 0;
    // Every nonzero wait here is preceded by0dcc(0). The helper's comparison
    // is unsigned32 and its ADD/ADC wraps; a wrapped target can be ready now.
    this.driverDeadline = u32(this.clock + counts);
    this.finishDriverWait();
  }
  finishDriverWait() {
    if (this.driverDeadline === null || this.clock < this.driverDeadline)
      return;
    this.driverDeadline = null;
    if (this.phase === "selection-wait") this.flip("selection-flip");
    else if (this.phase === "settle-wait") this.becomeReady();
    else if (this.phase === "confirm-wait") {
      this.phase = "complete";
      this.outcome = { returnCode: this.pendingReturn, choice: this.choice };
    } else throw Error(`Unsupported destination wait completion ${this.phase}`);
  }
  becomeReady() {
    this.phase = "ready";
    this.events.push({ type: "flush" });
  }
  advanceTick(clock) {
    this.clock = word(clock);
    this.finishDriverWait();
  }
  advanceBlockedTick(clock) {
    // Preserve the application's existing pause adapter: no component wait is
    // consumed while its system overlay owns execution. Native deferred system
    // key polling during this scene remains a separate input integration.
    const next = word(clock);
    if (this.driverDeadline !== null)
      this.driverDeadline = u32(this.driverDeadline + u32(next - this.clock));
    this.clock = next;
  }
  advanceRetrace(clock) {
    this.clock = word(clock);
    this.retraces++;
    if (!this.retracesRemaining || --this.retracesRemaining) return;
    if (this.phase === "wipe" || this.phase === "reveal") {
      if (this.transition.band < 4) {
        this.transition.band++;
        this.retracesRemaining = 5;
      } else if (this.phase === "wipe") {
        this.phase = "reveal";
        this.transition = { kind: "reveal", band: 0 };
        this.retracesRemaining = 5;
      } else {
        this.transition = null;
        this.phase = "entry-flip";
        this.retracesRemaining = 1;
      }
    } else if (this.phase === "entry-flip") this.becomeReady();
    else if (this.phase === "selection-flip") {
      this.visibleChoice = this.choice;
      this.waitDriver("settle-wait", 1);
    } else if (this.phase === "confirm-flip") {
      this.visibleChoice = this.choice;
      this.events.push({ type: "flush" }); // 1df5, before wait0/7 and return.
      this.waitDriver("confirm-wait", 7);
    } else
      throw Error(`Unsupported destination retrace completion ${this.phase}`);
  }
  drainEvents() {
    return this.events.splice(0);
  }
  snapshot() {
    return {
      phase: this.phase,
      ready: this.ready,
      confirming: this.confirming,
      choice: this.choice,
      visibleChoice: this.visibleChoice,
      clock: this.clock,
      driverDeadline: this.driverDeadline,
      retracesRemaining: this.retracesRemaining,
      retraces: this.retraces,
      inputs: this.inputs,
      lastInputClock: this.lastInputClock,
      discardedDuringWait: this.discardedDuringWait,
      transition: this.transition ? { ...this.transition } : null,
      outcome: this.outcome ? { ...this.outcome } : null,
    };
  }
}
