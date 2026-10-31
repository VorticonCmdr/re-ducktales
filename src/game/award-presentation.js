import { portraitPageWork } from "./departure-work.js";
import { DRIVER_HZ, RETRACE_HZ } from "./timing.js";

// Main0b39..0c48: picture6's wipe/copy/flush, cash, wipe, reveal, then49/09f5.
// Resource loading, text and remaining CPU/IRQ costs are not modeled here.
export class AwardPresentation {
  constructor({
    entries,
    clock,
    flushInput,
    commitReward,
    sourceScene = null,
  }) {
    if (
      typeof flushInput !== "function" ||
      typeof commitReward !== "function" ||
      (clock !== undefined && typeof clock !== "function")
    )
      throw Error("Invalid award presentation environment");
    if (![null, "cave", "jungle", "mountain"].includes(sourceScene))
      throw Error("Invalid award source scene");
    this.sourceScene = sourceScene;
    this.work = portraitPageWork(entries?.[35]);
    this.flushInput = flushInput;
    this.commitReward = commitReward;
    this.tick = this.retrace = this.consumedRetraces = 0;
    this.clock =
      clock ??
      (() => Math.max(this.tick / DRIVER_HZ, this.retrace / RETRACE_HZ) * 1000);
    this.lastTime = -Infinity;
    this.transition = null;
    this.complete = false;
    this.phase = "clearing-page";
    this.wait = {
      clock: "graphics",
      until: this.time() + this.work.fill.milliseconds,
    };
  }
  time() {
    const n = this.clock();
    if (!Number.isFinite(n) || n < 0 || n < this.lastTime)
      throw Error("Invalid award presentation clock");
    this.lastTime = n;
    return n;
  }
  setClock(clock) {
    if (typeof clock !== "function")
      throw Error("Invalid award presentation clock");
    const before = this.time(),
      after = clock();
    if (!Number.isFinite(after) || after < 0 || (this.wait && before !== after))
      throw Error("Cannot rebase active award presentation clock");
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
      this.transition = null;
      this.phase = "copying-portrait";
      this.wait = {
        clock: "graphics",
        until: this.time() + this.work.copy.milliseconds,
      };
    } else if (this.phase === "wipe") this.beginTransition("reveal");
    else if (this.phase === "reveal") {
      this.transition = null;
      this.phase = "publishing";
      this.wait = { clock: "continuation", until: this.time() };
    } else throw Error("Unsupported award transition");
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
      throw Error("Unexpected award work boundary");
    this.wait = null;
    if (this.phase === "clearing-page") this.beginTransition("initial-wipe");
    else if (this.phase === "copying-portrait") {
      this.flushInput(); // Picture helper016d.
      this.commitReward(); // Main0bec; text work around this remains omitted.
      this.beginTransition("wipe");
    } else if (this.phase === "publishing") {
      this.phase = "complete";
      this.complete = true;
    } else throw Error("Unsupported award work completion");
  }
  snapshot() {
    return {
      phase: this.phase,
      consumedRetraces: this.consumedRetraces,
      ...(this.transition
        ? { transition: { ...this.transition }, remaining: this.remaining }
        : {}),
      work: this.work,
    };
  }
}
