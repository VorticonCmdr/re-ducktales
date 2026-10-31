// Shared09f5:failure20,award/rival40,broker50,flight repair60,player notice80,
// wreckage/transmitter100.
// Back the wait with the existing result fields so neutral snapshots stay stable.
export class ResultInputWait {
  constructor({ state, count, pollInput, flushInput }) {
    if (
      ![20, 40, 50, 60, 80, 100].includes(count) ||
      !state ||
      state.remaining !== count * 7 ||
      typeof pollInput !== "function" ||
      typeof flushInput !== "function"
    )
      throw Error("Invalid result input boundary");
    this.state = state;
    this.pollInput = pollInput;
    this.onFlushInput = flushInput;
    this.started = false;
    this.complete = false;
    this.skipped = false;
    this.waitingForInputPoll = false;
    this.inputPolls = 0;
  }
  begin() {
    if (this.started) throw Error("Result wait already started");
    this.started = true;
    this.flushInput();
    this.readInput();
  }
  flushInput() {
    this.state.skipRequested = false;
    this.onFlushInput();
  }
  readInput() {
    const ready = this.pollInput();
    if (typeof ready !== "boolean")
      throw Error("Invalid result input poll result");
    this.waitingForInputPoll = !ready;
    if (!ready) return;
    this.inputPolls++;
    if (this.state.skipRequested) this.skipped = this.complete = true;
  }
  resumeInputPoll() {
    if (!this.started || this.complete || !this.waitingForInputPoll)
      throw Error("Result resumed outside input reader");
    this.readInput();
  }
  advanceTick() {
    if (!this.started) throw Error("Result advanced before entry flush");
    if (this.complete) return true;
    if (this.waitingForInputPoll) return false;
    if (--this.state.remaining === 0) this.complete = true;
    else if (this.state.remaining % 7 === 0) this.readInput();
    return this.complete;
  }
}
