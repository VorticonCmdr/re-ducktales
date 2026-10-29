import { u32 } from "./integer.js";

const word = (value) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw Error("Invalid map deadline clock word");
  return value;
};

// Resident198e:01d8..0208. The external clock returns DX:AX. A browser caller
// may retry a pending poll on its next driver tick; CPU spin counts are separate.
export class MapDeadline {
  constructor({ deadline = 0, period = 6 } = {}) {
    this.deadline = word(deadline);
    this.period = word(period);
  }
  poll(readClock) {
    if (typeof readClock !== "function")
      throw Error("Map deadline requires an explicit clock provider");
    if (this.period === 0) return true;
    // CMP DX,high; JA/JC; CMP AX,low: unsigned32,not signed elapsed time.
    if (word(readClock()) < this.deadline) return false;
    // The original reads again before ADD/ADC. Do not reuse the successful
    // comparison read or advance the old deadline to manufacture this result.
    this.deadline = u32(word(readClock()) + this.period);
    return true;
  }
}
