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
        this.pending
          .flatMap((r) => r.batch ?? [r])
          .some((r) => r.token === token))
    )
      throw Error("Invalid or duplicate speaker token");
    if (!Number.isInteger(argument) || argument < 0 || argument > 65535)
      throw Error("Speaker request must be a word");
    this.sequence = sequence;
    this.pending.push({ sequence, argument, token });
    this.deliver();
  }
  requestBatch(requests) {
    if (
      !Array.isArray(requests) ||
      requests.length < 1 ||
      requests.length > 16 ||
      !requests.every(
        (r, i) =>
          r.sequence === this.sequence + i + 1 &&
          r.token === null &&
          Number.isInteger(r.argument) &&
          r.argument >= 0 &&
          r.argument <= 65535,
      )
    )
      throw Error("Invalid native speaker batch");
    this.sequence += requests.length;
    this.pending.push({ batch: requests });
    this.deliver();
  }
  query({ sequence, token, argument }) {
    if (
      sequence !== this.sequence + 1 ||
      argument !== null ||
      typeof token !== "string" ||
      !token.length ||
      this.waiters.has(token) ||
      this.pending.flatMap((r) => r.batch ?? [r]).some((r) => r.token === token)
    )
      throw Error("Invalid speaker status query");
    this.sequence = sequence;
    const request = { sequence, argument: null, token, query: true };
    this.pending.push(request);
    this.deliver();
  }
  apply({ sequence, argument, token, query = false }) {
    const accepted = query ? true : this.driver.request(argument);
    this.consumePorts();
    this.events.push({
      type: "ack",
      sequence,
      argument,
      token,
      accepted,
      ...(query ? { query: true } : {}),
      ...this.state(),
    });
    if (token !== null && this.driver.busy) this.waiters.set(token, sequence);
    return accepted;
  }
  applyBatch(requests) {
    let lastAccepted = null;
    for (const r of requests) if (this.apply(r)) lastAccepted = r.argument;
    // Native calls do not wait for a previous stop to finish. A completely
    // rejected batch leaves the prior host restart barrier intact.
    if (lastAccepted !== null)
      this.resetBarrier = (lastAccepted & 255) === 0 && this.driver.busy;
  }
  deliver() {
    while (this.pending.length) {
      // Only legacy host stop/start words wait for stop completion. Native call
      // batches and status reads keep FIFO order but see the current device.
      const next = this.pending[0];
      if (this.resetBarrier && !next.batch && !next.query) break;
      const request = this.pending.shift();
      if (request.batch) {
        // Original calls are consecutive:no host stop-completion barrier inside
        // the batch,no retry of a rejected click. IRQ sub-call phase is explicit.
        this.applyBatch(request.batch);
        continue;
      }
      const { argument, query } = request;
      this.apply(request);
      // Browser stop/start adaptation: let the original high-priority stop
      // sequence finish before delivering later requests. Otherwise a stop
      // and title start in one browser frame would discard the new song.
      if (!query && (argument & 255) === 0 && this.driver.busy)
        this.resetBarrier = true;
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
        this.waiters.size +
        this.pending
          .flatMap((r) => r.batch ?? [r])
          .filter((r) => r.token !== null).length,
      queuedRequests: this.pending.flatMap((r) => r.batch ?? [r]).length,
      engineActive: this.driver.b(0x287) !== 0,
      speedWord: this.driver.w(0x2a5),
      pitDivisor: this.chip.pendingPeriod,
    };
  }
}
