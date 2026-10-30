import { DestinationWaits } from "./destination-waits.js";
import { destinationFooterWork } from "./destination-work.js";

// Actual recurring caller around the ordinary reader. DestinationWaits remains
// the already-read-byte contract for conditional component fixtures.
export class DestinationLoop extends DestinationWaits {
  constructor(
    clock,
    atomicAvailable,
    { entries, clock: elapsed, readInput, pollInput, flushInput },
  ) {
    super(clock, atomicAvailable);
    for (const fn of [elapsed, readInput, pollInput, flushInput])
      if (typeof fn !== "function")
        throw Error("Missing destination environment provider");
    this.elapsed = elapsed;
    this.readInputByte = readInput;
    this.pollInput = pollInput;
    this.flushInput = flushInput;
    this.footer = destinationFooterWork(entries, atomicAvailable);
    this.wait = null;
    this.footerPasses = this.completedCalls = 0;
    this.workMilliseconds = 0;
    this.lastElapsed = -Infinity;
    this.lastByte = null;
  }
  get ready() {
    return this.phase === "footer-drawing";
  }
  // HTML controls describe a completed dialog, not the recurring CPU read
  // window. Neutral page flips must not make controls/status flicker.
  get interactive() {
    return (
      this.footerPasses > 0 &&
      !this.confirming &&
      !["selection-wait", "reader-blocked"].includes(this.phase)
    );
  }
  time() {
    const value = this.elapsed();
    if (!Number.isFinite(value) || value < 0 || value < this.lastElapsed)
      throw Error("Invalid destination simulation clock");
    this.lastElapsed = value;
    return value;
  }
  becomeReady() {
    // Original1e2e flushes BEFORE drawing, not at a keydown or after the read.
    this.footerPasses++;
    this.flushInput();
    this.phase = "footer-drawing";
    this.call = 0;
    this.scheduleCall();
  }
  scheduleCall() {
    this.wait = {
      clock: "graphics",
      until: this.time() + this.footer[this.call].milliseconds,
    };
  }
  input() {
    throw Error("Autonomous destination reads only at the source boundary");
  }
  advanceGraphics() {
    if (
      this.wait?.clock !== "graphics" ||
      this.phase !== "footer-drawing" ||
      this.time() < this.wait.until
    )
      throw Error("Unexpected destination drawing completion");
    this.wait = null;
    this.completedCalls++;
    this.workMilliseconds += this.footer[this.call].milliseconds;
    if (++this.call < this.footer.length) this.scheduleCall();
    else this.readBoundary();
  }
  readBoundary() {
    // The shared reader handles system keys here, after all footer calls.
    if (!this.pollInput()) {
      this.phase = "reader-blocked";
      return;
    }
    this.phase = "footer-drawing"; // super.input uses the caller's ready getter.
    const byte = this.readInputByte();
    this.lastByte = byte;
    super.input(byte, this.clock);
  }
  advanceTick(clock) {
    super.advanceTick(clock);
    if (this.phase === "reader-blocked") this.readBoundary();
  }
  snapshot() {
    return {
      ...super.snapshot(),
      loop: {
        footerPasses: this.footerPasses,
        completedCalls: this.completedCalls,
        workMilliseconds: this.workMilliseconds,
        lastByte: this.lastByte,
        drawingUntil: this.wait?.until ?? null,
      },
    };
  }
}
