import { DRIVER_HZ, RETRACE_HZ } from "./timing.js";
// The browser supplies elapsed milliseconds and semantic input events. Rendering
// is an observer. Long animation frames catch up every simulation step.
export class Scheduler {
  constructor(game, start = 0, { present = () => {} } = {}) {
    this.present = present;
    this.game = game;
    this.now = start;
    this.origin = start;
    this.pausedMilliseconds = 0;
    this.elapsed = 0;
    game.setSimulationClock?.(() => this.elapsed);
    this.tickAt = start + 1000 / DRIVER_HZ;
    this.retraceAt = start + 1000 / RETRACE_HZ;
    this.events = [];
    this.consumed = [];
  }
  enqueue(event, at) {
    if (at < this.now) throw Error("Input timestamp precedes simulation time");
    this.events.push({ at, event });
  }
  advanceTo(now) {
    if (now < this.now) throw Error("Clock moved backwards");
    while (Math.min(this.tickAt, this.retraceAt) <= now) {
      const at = Math.min(this.tickAt, this.retraceAt);
      this.elapsed = at - this.origin - this.pausedMilliseconds;
      while (this.events.length && this.events[0].at <= at) {
        const entry = this.events.shift();
        this.game.input(entry.event);
        this.consumed.push({ ...entry, consumedAt: at, tick: this.game.tick });
      }
      if (this.tickAt <= this.retraceAt) {
        this.game.advanceTick();
        this.tickAt += 1000 / DRIVER_HZ;
      } else {
        this.game.advanceRetrace();
        this.present(this.game);
        this.retraceAt += 1000 / RETRACE_HZ;
      }
    }
    this.now = now;
    this.elapsed = now - this.origin - this.pausedMilliseconds;
  }
  pauseDuration(ms) {
    if (ms < 0) throw Error("Invalid pause duration");
    this.pausedMilliseconds += ms;
    this.tickAt += ms;
    this.retraceAt += ms;
    this.now += ms;
    for (const event of this.events) event.at += ms;
  }
}
