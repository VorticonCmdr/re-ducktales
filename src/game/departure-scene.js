import { Departure } from "./departure.js";
import { departureWork } from "./departure-work.js";
import { nextRandom } from "./integer.js";
import { DRIVER_HZ, RETRACE_HZ } from "./timing.js";

// Resident11c4:0008(3),then main06d9..0852. No input reader or manual
// preflight gate occurs here. The metadata class stays a pure call-contract
// calculation; this program commits its two RNG results at their source sites.
export class DepartureScene {
  constructor({ prepared, entries, clock, onSeed, flushInput, registerRace }) {
    if (
      !(prepared instanceof Departure) ||
      typeof onSeed !== "function" ||
      typeof flushInput !== "function" ||
      typeof registerRace !== "function"
    )
      throw Error("Invalid departure environment");
    if (clock !== undefined && typeof clock !== "function")
      throw Error("Invalid departure clock provider");
    this.prepared = prepared;
    this.work = departureWork(entries);
    this.onSeed = onSeed;
    this.flushInput = flushInput;
    this.registerRace = registerRace;
    this.raceRoute = null;
    this.tick = this.retrace = this.consumedRetraces = this.rngDraws = 0;
    this.seed = prepared.seedBefore;
    this.externalClock = !!clock;
    this.clock =
      clock ??
      (() => Math.max(this.tick / DRIVER_HZ, this.retrace / RETRACE_HZ) * 1000);
    this.lastTime = -Infinity;
    this.transition = null;
    this.outcome = null;
    this.completedWork = 0;
    this.phase = "clearing-page";
    this.wait = {
      clock: "graphics",
      until: this.time() + this.work.fill.milliseconds,
    };
  }
  setClock(clock) {
    if (typeof clock !== "function")
      throw Error("Invalid departure clock provider");
    this.clock = clock;
    this.externalClock = true;
    this.lastTime = -Infinity;
  }
  time() {
    const n = this.clock();
    if (!Number.isFinite(n) || n < 0 || n < this.lastTime)
      throw Error("Invalid departure simulation clock");
    this.lastTime = n;
    return n;
  }
  advanceTick() {
    this.tick++;
    // Direct component callers retain an explicit synthetic driver/retrace
    // provider. The production Scheduler dispatches the exact work boundary.
    if (!this.externalClock && this.wait && this.time() >= this.wait.until)
      this.advanceGraphics();
  }
  advanceRetrace() {
    this.retrace++;
    if (!this.transition) return;
    this.consumedRetraces++;
    if (--this.remaining) return;
    if (this.transition.band < 4) {
      this.transition.band++;
      this.remaining = 5;
      return;
    }
    if (this.phase === "wipe") {
      this.transition = null;
      this.phase = "copying-portrait";
      this.wait = {
        clock: "graphics",
        until: this.time() + this.work.copy.milliseconds,
      };
    } else if (this.phase === "reveal") {
      this.transition = null;
      this.phase = "handoff";
      this.commitSeed(this.prepared.seed);
      if (this.prepared.racing) {
        this.raceRoute = this.prepared.rivalRoute;
        this.registerRace(this.raceRoute);
      }
      // Return from the reveal,compute race/write its route,then invoke the
      // overlay in the same simulation instant after its final publication.
      this.wait = { clock: "continuation", until: this.time() };
    } else throw Error("Unsupported departure transition");
  }
  commitSeed(seed) {
    this.seed = seed;
    this.rngDraws++;
    this.onSeed(seed);
  }
  advanceGraphics() {
    if (!this.wait || this.time() < this.wait.until)
      throw Error("Unexpected departure work boundary");
    this.wait = null;
    if (this.phase === "clearing-page") {
      this.completedWork++;
      this.beginTransition("wipe");
    } else if (this.phase === "copying-portrait") {
      this.completedWork++;
      this.flushInput(); //11c4:016d,after the full portrait copy.
      this.commitSeed(nextRandom(this.prepared.seedBefore)); //main06d9.
      this.beginTransition("reveal");
    } else if (this.phase === "handoff") {
      this.phase = "complete";
      this.outcome = this.prepared.flightRequest;
    } else throw Error("Unsupported departure work completion");
  }
  beginTransition(kind) {
    this.phase = kind;
    this.transition = { kind, band: 0 };
    this.remaining = 5;
  }
  snapshot() {
    return {
      phase: this.phase,
      transition: this.transition ? { ...this.transition } : null,
      tick: this.tick,
      retrace: this.retrace,
      consumedRetraces: this.consumedRetraces,
      remaining: this.transition ? this.remaining : 0,
      completedWork: this.completedWork,
      rngDraws: this.rngDraws,
      seed: this.seed,
      wait: this.wait ? { ...this.wait } : null,
      raceRoute: this.raceRoute ? { ...this.raceRoute } : null,
      outcome: this.outcome,
    };
  }
}
