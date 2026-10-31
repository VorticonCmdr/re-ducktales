import { portraitPageWork } from "./departure-work.js";
import { DRIVER_HZ, RETRACE_HZ } from "./timing.js";

// Picture3/10 entry fill/wipe/copy,caller text/cue,reveal,reader,exit wipe.
// Main0326/0e82 and rival126b:015e..0322. Text/loading/IRQ phase remain separate.
export class ReportPresentation {
  constructor({
    entries,
    portrait,
    clock,
    flushInput,
    portraitReady,
    readerReady,
    exited,
  }) {
    if (
      ![30, 33].includes(portrait) ||
      [flushInput, portraitReady, readerReady, exited].some(
        (f) => typeof f !== "function",
      ) ||
      (clock !== undefined && typeof clock !== "function")
    )
      throw Error("Invalid report presentation environment");
    Object.assign(this, {
      portrait,
      flushInput,
      portraitReady,
      readerReady,
      exited,
    });
    this.work = portraitPageWork(entries?.[portrait]);
    this.tick = this.retrace = this.consumedRetraces = 0;
    this.clock =
      clock ??
      (() => Math.max(this.tick / DRIVER_HZ, this.retrace / RETRACE_HZ) * 1000);
    this.lastTime = -Infinity;
    this.phase = "clearing-page";
    this.transition = null;
    this.complete = false;
    this.wait = {
      clock: "graphics",
      until: this.time() + this.work.fill.milliseconds,
    };
  }
  time() {
    const value = this.clock();
    if (!Number.isFinite(value) || value < 0 || value < this.lastTime)
      throw Error("Invalid report presentation clock");
    this.lastTime = value;
    return value;
  }
  setClock(clock) {
    if (typeof clock !== "function")
      throw Error("Invalid report presentation clock");
    const before = this.time(),
      after = clock();
    if (!Number.isFinite(after) || after < 0 || (this.wait && before !== after))
      throw Error("Cannot rebase active report presentation clock");
    this.clock = clock;
    this.lastTime = after;
  }
  advanceTick() {
    this.tick++;
    if (
      ["graphics", "continuation"].includes(this.wait?.clock) &&
      this.time() >= this.wait.until
    )
      this.advanceGraphics();
  }
  advanceRetrace() {
    this.retrace++;
    if (this.wait?.clock === "graphics" && this.time() >= this.wait.until)
      this.advanceGraphics();
    if (this.wait?.clock !== "retrace") return;
    this.consumedRetraces++;
    if (--this.remaining) return;
    if (this.transition.band < 4) {
      this.transition.band++;
      this.remaining = 5;
    } else if (this.phase === "initial-wipe") {
      this.phase = "copying-portrait";
      this.transition = null;
      this.wait = {
        clock: "graphics",
        until: this.time() + this.work.copy.milliseconds,
      };
    } else if (["reveal", "exit-wipe"].includes(this.phase)) {
      this.phase = this.phase === "reveal" ? "publishing" : "publishing-exit";
      this.transition = null;
      this.wait = { clock: "continuation", until: this.time() };
    } else throw Error("Unsupported report transition");
  }
  beginTransition(phase) {
    this.phase = phase;
    this.transition = { kind: phase === "reveal" ? "reveal" : "wipe", band: 0 };
    this.remaining = 5;
    this.wait = { clock: "retrace" };
  }
  advanceGraphics() {
    if (
      !["graphics", "continuation"].includes(this.wait?.clock) ||
      this.time() < this.wait.until
    )
      throw Error("Unexpected report work boundary");
    this.wait = null;
    if (this.phase === "clearing-page") this.beginTransition("initial-wipe");
    else if (this.phase === "copying-portrait") {
      this.flushInput(); // Shared picture helper016d,after its portrait copy.
      this.portraitReady(); // Caller text and enabled6e precede the reveal.
      this.beginTransition("reveal");
    } else if (this.phase === "publishing") {
      this.phase = "reading";
      this.readerReady(); // Caller19a5 flush/status or09f5 owns actual input.
    } else if (this.phase === "publishing-exit") {
      this.phase = "complete";
      this.complete = true;
      this.exited(); // Enabled21/rival location/root continuation follow wipe.
    } else throw Error("Unsupported report work completion");
  }
  beginExit() {
    if (this.phase !== "reading" || this.wait || this.complete)
      throw Error("Report exit outside completed reader");
    this.beginTransition("exit-wipe");
  }
  snapshot() {
    return {
      phase: this.phase,
      portrait: this.portrait,
      consumedRetraces: this.consumedRetraces,
      ...(this.transition
        ? { transition: { ...this.transition }, remaining: this.remaining }
        : {}),
      work: this.work,
    };
  }
}
