import { SpeakerDriver } from "./speaker-driver.js";
export const SPEAKER_PIT_HZ = 1193182;
export const SPEAKER_IRQ_CLOCKS = 1365;

// Ideal mode3 digital output. Initial phase/gain are explicit rendition
// settings;this is not an analog speaker/filter or recovered machine phase.
export class SpeakerCounter {
  constructor() {
    this.period = this.pendingPeriod = 65536;
    this.remaining = 32768;
    this.output = 1;
    this.port61 = 0;
    this.low = null;
  }
  write(port, value) {
    if (port === 0x61) {
      if (!(value & 1) || !(this.port61 & 1)) {
        this.output = 1;
        this.period = this.pendingPeriod;
        this.remaining = this.period / 2;
      }
      this.port61 = value;
    } else if (port === 0x42) {
      if (this.low === null) this.low = value;
      else {
        this.pendingPeriod = this.low | (value << 8) || 65536;
        this.low = null;
        if (!(this.port61 & 1)) {
          this.period = this.pendingPeriod;
          this.remaining = this.period / 2;
        }
      }
    } else throw Error(`Unsupported PC-speaker output port ${port}`);
  }
  integrate(clocks) {
    if (!(this.port61 & 1)) return this.port61 & 2 ? clocks : 0;
    let total = 0;
    while (clocks > 0) {
      const span = Math.min(clocks, this.remaining);
      if (this.port61 & 2) total += (this.output ? 1 : -1) * span;
      clocks -= span;
      this.remaining -= span;
      if (this.remaining <= 0) {
        this.output ^= 1;
        this.period = this.pendingPeriod;
        this.remaining = this.period / 2;
      }
    }
    return total;
  }
}

export class SpeakerGameStream {
  constructor(bytes, { sampleRate, port61 = 0 } = {}) {
    if (
      !Number.isInteger(sampleRate) ||
      sampleRate < 8000 ||
      sampleRate > 192000
    )
      throw Error("Unsupported speaker sample rate");
    this.driver = new SpeakerDriver(bytes, { port61 });
    this.chip = new SpeakerCounter();
    this.sampleRate = sampleRate;
    this.frame = this.sequence = this.signalSamples = 0;
    this.irqRemaining = SPEAKER_IRQ_CLOCKS;
    this.events = [];
    this.waiters = new Map();
    this.pending = [];
    this.consumePorts();
  }
  state() {
    return {
      frame: this.frame,
      playbackStatus: this.driver.busy ? 1 : 0,
      marker: this.driver.marker,
      busy: this.driver.busy,
    };
  }
  consumePorts() {
    for (const e of this.driver.drainEvents()) {
      if (e.type === "chain") continue; // Counted explicit old-handler boundary.
      if (e.type !== "out") throw Error("Unsupported speaker device event");
      if (e.port === 0x20) {
        if (e.value !== 0x20) throw Error("Unsupported speaker PIC write");
      } else this.chip.write(e.port, e.value);
    }
  }
  poll() {
    if (this.driver.busy) return;
    for (const [token, sequence] of this.waiters)
      this.events.push({ type: "complete", sequence, token, ...this.state() });
    this.waiters.clear();
    this.resetBarrier = false;
    this.deliver();
  }
  request({ sequence, argument, token = null }) {
    if (!Number.isSafeInteger(sequence) || sequence !== this.sequence + 1)
      throw Error("Unordered speaker request");
    if (
      token !== null &&
      (typeof token !== "string" ||
        !token.length ||
        this.waiters.has(token) ||
        this.pending.some((r) => r.token === token))
    )
      throw Error("Invalid or duplicate speaker token");
    if (!Number.isInteger(argument) || argument < 0 || argument > 65535)
      throw Error("Speaker request must be a word");
    this.sequence = sequence;
    this.pending.push({ sequence, argument, token });
    this.deliver();
  }
  deliver() {
    while (!this.resetBarrier && this.pending.length) {
      const { sequence, argument, token } = this.pending.shift();
      const accepted = this.driver.request(argument);
      this.consumePorts();
      this.events.push({
        type: "ack",
        sequence,
        argument,
        token,
        accepted,
        ...this.state(),
      });
      if (token !== null && this.driver.busy) this.waiters.set(token, sequence);
      // Browser stop/start adaptation: let the original high-priority stop
      // sequence finish before delivering later requests. Otherwise a stop
      // and title start in one browser frame would discard the new song.
      if ((argument & 255) === 0 && this.driver.busy) this.resetBarrier = true;
    }
  }
  renderFrames(count) {
    if (!Number.isInteger(count) || count < 1 || count > 65536)
      throw Error("Invalid speaker audio frame count");
    const pcm = new Float32Array(count),
      clocksPerFrame = SPEAKER_PIT_HZ / this.sampleRate;
    for (let i = 0; i < count; i++) {
      let left = clocksPerFrame,
        sum = 0;
      // Event frame is the containing output sample,not an inferred WAV end.
      this.frame++;
      while (left > 0) {
        const span = Math.min(left, this.irqRemaining);
        sum += this.chip.integrate(span);
        left -= span;
        this.irqRemaining -= span;
        if (this.irqRemaining <= 0) {
          this.driver.interrupt();
          this.consumePorts();
          this.poll();
          this.irqRemaining = SPEAKER_IRQ_CLOCKS;
        }
      }
      const value = (sum / clocksPerFrame) * 0.18;
      pcm[i] = value;
      if (value !== 0) this.signalSamples++;
    }
    return pcm;
  }
  drainEvents() {
    return this.events.splice(0);
  }
  stats() {
    return {
      ...this.state(),
      sequence: this.sequence,
      sampleRate: this.sampleRate,
      interrupts: this.driver.interrupts,
      ticks: this.driver.ticks,
      acknowledgements: this.driver.acknowledgements,
      chains: this.driver.chains,
      signalSamples: this.signalSamples,
      pendingTokens:
        this.waiters.size + this.pending.filter((r) => r.token !== null).length,
      queuedRequests: this.pending.length,
      engineActive: this.driver.b(0x287) !== 0,
      speedWord: this.driver.w(0x2a5),
      pitDivisor: this.chip.pendingPeriod,
    };
  }
}
