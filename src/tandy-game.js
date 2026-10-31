import { TandyPlayback } from "./tandy-preview.js";

// Persistent original device. Requests and frame counts are explicit inputs;
// completion is queried after each IRQ, not inferred from a rendered WAV.
export class TandyGameStream {
  constructor(bytes, { sampleRate, port61 = 0 } = {}) {
    this.playback = new TandyPlayback(bytes, { sampleRate, port61 });
    this.sequence = 0;
    this.waiters = new Map();
    this.events = [];
  }
  state() {
    const p = this.playback;
    return {
      frame: p.frame,
      playbackStatus: p.driver.playbackStatus,
      marker: p.driver.marker,
      busy: p.driver.active,
    };
  }
  request({ sequence, argument, token = null }) {
    if (!Number.isSafeInteger(sequence) || sequence !== this.sequence + 1)
      throw Error("Unordered Tandy game request");
    if (token !== null && (typeof token !== "string" || !token.length))
      throw Error("Invalid Tandy completion token");
    if (token !== null && this.waiters.has(token))
      throw Error("Duplicate pending Tandy completion token");
    this.playback.start(argument);
    this.sequence = sequence;
    this.poll();
    const state = this.state();
    this.events.push({ type: "ack", sequence, argument, token, ...state });
    if (token !== null && state.busy) this.waiters.set(token, sequence);
  }
  poll() {
    if (!this.playback.driver.pollWait()) return;
    for (const [token, sequence] of this.waiters)
      this.events.push({ type: "complete", sequence, token, ...this.state() });
    this.waiters.clear();
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
      throw Error("Invalid native Tandy batch");
    for (const { sequence, argument, token } of requests) {
      this.playback.start(argument);
      this.sequence = sequence;
      this.events.push({
        type: "ack",
        sequence,
        argument,
        token,
        ...this.state(),
      });
    }
    // Do not publish an intermediate idle reset before the following click.
    this.poll();
  }
  query({ sequence, argument, token }) {
    if (
      sequence !== this.sequence + 1 ||
      argument !== null ||
      typeof token !== "string" ||
      !token.length ||
      this.waiters.has(token)
    )
      throw Error("Invalid Tandy status query");
    this.sequence = sequence;
    this.poll();
    const state = this.state();
    this.events.push({
      type: "ack",
      sequence,
      argument: null,
      token,
      query: true,
      ...state,
    });
    if (state.busy) this.waiters.set(token, sequence);
  }
  renderFrames(count) {
    // Keep the device and divider running even between cues. Poll at the
    // sequencer's consumption boundary, retaining an exact audio-frame stamp.
    return this.playback.renderFrames(count, {
      onInterrupt: () => this.poll(),
    }).pcm;
  }
  drainEvents() {
    return this.events.splice(0);
  }
  stats() {
    const p = this.playback;
    return {
      ...this.state(),
      sequence: this.sequence,
      interrupts: p.interrupts,
      ticks: p.ticks,
      acknowledgements: p.acks,
      chains: p.chains,
      signalSamples: p.signalSamples,
      sampleRate: p.sampleRate,
      pendingTokens: this.waiters.size,
    };
  }
}
