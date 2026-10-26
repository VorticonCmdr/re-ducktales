import { nextRandom } from "./integer.js";
import { expeditionType } from "./departure.js";
// Main12bb:00fe/022a. Clues are three original lines at x20/y40,52,64.
export class ExpeditionBriefing {
  constructor({ flags, seed, clues }) {
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
  snapshot() {
    return {
      activity: this.activity,
      variant: this.variant,
      seed: this.seed,
      clue: this.clue,
      remaining: this.remaining,
    };
  }
}
