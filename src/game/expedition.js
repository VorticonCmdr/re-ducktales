import { nextRandom } from "./integer.js";
import { expeditionType } from "./departure.js";
// Main12bb:00fe/022a. Clues are three original lines at x20/y40,52,64.
export class ExpeditionBriefing {
  constructor({
    flags,
    seed,
    clues,
    pollInput = () => true,
    flushInput = () => {},
  }) {
    if (typeof pollInput !== "function" || typeof flushInput !== "function")
      throw Error("Invalid guide input boundary");
    this.pollInput = pollInput;
    this.onFlushInput = flushInput;
    this.started = false;
    this.complete = false;
    this.waitingForInputPoll = false;
    this.inputPolls = 0;
    this.activity = expeditionType(flags);
    this.variant = flags >>> 4;
    const family = { mountain: 0, jungle: 1, photography: 2, cave: 3 }[
      this.activity
    ];
    this.seed = nextRandom(seed);
    this.clue = family * 4 + (this.seed & 3);
    const entry = clues?.[this.clue];
    if (!entry) throw Error("Missing original expedition clues");
    this.lines = new TextDecoder("ascii")
      .decode(entry.data)
      .replace(/\x1a.*$/s, "")
      .split(/\r?\n/)
      .slice(0, 3);
    if (this.lines.length !== 3) throw Error("Incomplete expedition clue");
    this.chapter = {
      mountain: 0x5a6,
      jungle: 0x5c2,
      photography: 0x5dc,
      cave: 0x5f8,
    }[this.activity];
    this.remaining = 30 * 7;
    this.skipRequested = false;
  }
  begin() {
    if (this.started) throw Error("Guide wait already started");
    this.started = true;
    this.flushInput();
    this.readInput();
  }
  readInput() {
    const ready = this.pollInput();
    if (typeof ready !== "boolean")
      throw Error("Invalid guide input poll result");
    this.waitingForInputPoll = !ready;
    if (!ready) return;
    this.inputPolls++;
    if (this.skipRequested) this.complete = true;
  }
  resumeInputPoll() {
    if (!this.started || this.complete || !this.waitingForInputPoll)
      throw Error("Guide resumed outside input reader");
    this.readInput();
  }
  flushInput() {
    this.skipRequested = false;
    this.onFlushInput();
  }
  advanceTick() {
    if (!this.started) throw Error("Guide advanced before entry flush");
    if (this.complete) return true;
    if (this.waitingForInputPoll) return false;
    // Shared09f5(30): read first, then wait7; the final wait has no extra read.
    if (--this.remaining === 0) this.complete = true;
    else if (this.remaining % 7 === 0) this.readInput();
    return this.complete;
  }
  snapshot() {
    return {
      activity: this.activity,
      variant: this.variant,
      seed: this.seed,
      clue: this.clue,
      remaining: this.remaining,
      ...(this.waitingForInputPoll ? { waitingForInputPoll: true } : {}),
    };
  }
}
