import { TandyDriver } from "./tandy-driver.js";

export const TANDY_TICK_SECONDS = (1365 * 12) / 1193182;
export const TANDY_CLOCK_HZ = 14318180 / 4;

// NCR8496 digital boundary, as selected by the pinned DOSBox Tandy profile.
// The audition supplies explicit phases/counters; these are not recovered
// original chip state. Centered mixing/gain and sample alignment remain preview
// settings, separate from the checked digital register/counter/LFSR behavior.
export class TandyTones {
  constructor({
    sampleRate = 44100,
    periods = [1, 1, 1],
    counters = [1, 1, 1],
    outputs = [1, 1, 1],
    noise = { control: 0, counter: 1, output: 0, lfsr: 0x8000 },
  } = {}) {
    if (
      !Number.isInteger(sampleRate) ||
      sampleRate < 8000 ||
      sampleRate > 192000
    )
      throw Error("Unsupported Tandy sample rate");
    if (
      [periods, counters, outputs].some(
        (a) => !Array.isArray(a) || a.length !== 3,
      )
    )
      throw Error("Invalid Tandy initial tone state");
    if (
      periods.some((v) => !Number.isInteger(v) || v < 0 || v > 1023) ||
      counters.some((v) => !Number.isInteger(v) || v < 1 || v > 1024) ||
      outputs.some((v) => v !== 0 && v !== 1)
    )
      throw Error("Invalid Tandy initial counter/phase values");
    if (
      !noise ||
      !Number.isInteger(noise.control) ||
      noise.control < 0 ||
      noise.control > 15 ||
      !Number.isInteger(noise.counter) ||
      noise.counter < 1 ||
      noise.counter > 2048 ||
      !Number.isInteger(noise.lfsr) ||
      noise.lfsr < 0 ||
      noise.lfsr > 65535 ||
      (noise.output !== 0 && noise.output !== 1)
    )
      throw Error("Invalid Tandy initial noise state");
    this.sampleRate = sampleRate;
    this.periods = [...periods];
    this.counters = [...counters, noise.counter];
    this.outputs = [...outputs, noise.output];
    this.noiseControl = noise.control;
    this.lfsr = noise.lfsr;
    this.volumes = [15, 15, 15, 15];
    this.latched = 0;
    this.remainder = 0;
  }
  write(value) {
    if (!Number.isInteger(value) || value < 0 || value > 255)
      throw Error("Invalid PSG register byte");
    if (value & 128) this.latched = (value >>> 4) & 7;
    const ch = this.latched >>> 1;
    // NCR data-only writes to attenuation/noise registers are ignored.
    if (!(value & 128) && (this.latched & 1 || ch === 3)) return;
    if (this.latched & 1) this.volumes[ch] = value & 15;
    else {
      if (ch === 3) {
        // Reset only on a mode-bit change. Preserve output and countdown until
        // the next shift; changing rate alone must retain the LFSR as well.
        if ((value ^ this.noiseControl) & 4) this.lfsr = 0x8000;
        this.noiseControl = value & 15;
        return;
      }
      this.periods[ch] =
        value & 128
          ? (this.periods[ch] & 0x3f0) | (value & 15)
          : (this.periods[ch] & 15) | ((value & 63) << 4);
    }
  }
  get noisePeriod() {
    const rate = this.noiseControl & 3;
    return rate === 3 ? (this.periods[2] || 1024) * 2 : 32 << rate;
  }
  advanceClocks(clocks) {
    // One digital clock is input clock/16. This explicit boundary also lets
    // the external reference probe compare state without a PCM resampler.
    if (!Number.isInteger(clocks) || clocks < 0 || clocks > 65536)
      throw Error("Invalid Tandy digital clock count");
    for (let i = 0; i < clocks; i++) {
      for (let ch = 0; ch < 3; ch++)
        if (--this.counters[ch] === 0) {
          this.counters[ch] = this.periods[ch] || 1024;
          this.outputs[ch] ^= 1;
        }
      if (--this.counters[3] === 0) {
        // NCR white feedback is XNOR of bits1/5. Periodic mode feeds bit1.
        const feedback =
          ((this.lfsr >>> 1) & 1) ^
          (this.noiseControl & 4 ? ((this.lfsr >>> 5) & 1) ^ 1 : 0);
        this.lfsr = (this.lfsr >>> 1) | (feedback << 15);
        this.outputs[3] = this.lfsr & 1;
        this.counters[3] = this.noisePeriod;
      }
    }
  }
  digitalState() {
    const registers = this.periods.flatMap((p, ch) => [p, this.volumes[ch]]);
    registers.push(this.noiseControl, this.volumes[3]);
    return {
      registers,
      periods: [...this.periods.map((p) => p || 1024), this.noisePeriod],
      counters: [...this.counters],
      outputs: [...this.outputs],
      lfsr: this.lfsr,
      latched: this.latched,
      negate: true,
    };
  }
  sample() {
    this.remainder += TANDY_CLOCK_HZ;
    const clocks = Math.floor(this.remainder / (this.sampleRate * 16));
    this.remainder -= clocks * this.sampleRate * 16;
    this.advanceClocks(clocks);
    let value = 0;
    for (let ch = 0; ch < 4; ch++)
      if (this.volumes[ch] !== 15)
        value +=
          (this.outputs[ch] ? -1 : 1) * 0.18 * 10 ** (-this.volumes[ch] / 10);
    return value;
  }
}

export const TANDY_INTERRUPT_SECONDS = 1365 / 1193182;

// Persistent,DOM-free device clock. Callers supply a sample rate and frames;
// wall-clock scheduling,input and browser audio remain outside translated logic.
export class TandyPlayback {
  constructor(
    bytes,
    {
      sampleRate = 44100,
      port61 = 0,
      auditionAlignment = false,
      trace = false,
    } = {},
  ) {
    this.chip = new TandyTones({ sampleRate });
    this.sampleRate = sampleRate;
    this.port61 = port61;
    this.trace = trace;
    this.frame = 0;
    this.interrupts = 0;
    this.ticks = 0;
    this.nextInterruptFrame = 0;
    this.clock = 0;
    this.bios = 0;
    this.acks = 0;
    this.chains = 0;
    this.signalSamples = 0;
    this.bus = [];
    this.biosFlags = [];
    this.driver = new TandyDriver(bytes, {
      writePort: (port, value) => {
        if (port === 0x20) {
          if (value !== 0x20)
            throw Error("Unsupported Tandy PIC acknowledgement");
          this.acks++;
          return;
        }
        if (port !== 0xc0 && port !== 0x61)
          throw Error(`Unsupported Tandy port ${port}`);
        if (this.trace) this.bus.push({ tick: this.ticks - 1, port, value });
        if (port === 0xc0) this.chip.write(value);
      },
    });
    this.driver.reset(port61);
    // Independent audition alignment,retaining the established first tick0.
    // Normal persistent devices keep original divider12. Neither option claims
    // to recover the unobserved phase of a previously running original machine.
    if (auditionAlignment) this.driver.byte(0x1ca, 1);
  }
  start(argument) {
    this.driver.start(argument, { port61: this.port61 });
  }
  renderFrames(count, { haltWhenIdle = false } = {}) {
    if (!Number.isInteger(count) || count < 1 || count > 65536)
      throw Error("Invalid Tandy frame request");
    const pcm = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      while (this.frame >= this.nextInterruptFrame) {
        this.driver.processInterrupt({
          clearBiosFlags: (mask) => {
            this.bios &= mask;
            if (this.trace) this.biosFlags.push(mask);
          },
          incrementClock: (address) => {
            this.clock = (this.clock + 1) >>> 0;
            this.clockAddress = address;
            this.ticks++;
          },
          chainInterrupt: (address) => {
            this.chainAddress = address;
            this.chains++;
          },
        });
        this.interrupts++;
        this.nextInterruptFrame = Math.round(
          this.interrupts * TANDY_INTERRUPT_SECONDS * this.sampleRate,
        );
      }
      if (haltWhenIdle && !this.driver.active) {
        if (this.chip.volumes.some((v) => v !== 15))
          throw Error("Tandy sequence ended without muting all channels");
        return { pcm: pcm.subarray(0, i), ended: true };
      }
      const value = this.chip.sample();
      pcm[i] = value;
      if (value !== 0) this.signalSamples++;
      this.frame++;
    }
    return { pcm, ended: false };
  }
}

export class TandyPreviewLimitError extends Error {
  constructor() {
    super(
      "Tandy audition exceeded 1024 ticks; use live playback for long or looping sequences",
    );
    this.code = "TANDY_PREVIEW_LIMIT";
  }
}
export function renderTandyPreview(bytes, id, { sampleRate = 44100 } = {}) {
  if (!Number.isInteger(id) || id < 0 || id > 120)
    throw Error(`Unsupported Tandy public sound ID ${id}`);
  const playback = new TandyPlayback(bytes, {
    sampleRate,
    auditionAlignment: true,
    trace: true,
  });
  playback.start(id);
  const chunks = [];
  let length = 0;
  while (playback.ticks < 1024) {
    const { pcm, ended } = playback.renderFrames(128, { haltWhenIdle: true });
    chunks.push(pcm);
    length += pcm.length;
    if (ended) {
      const output = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      if (playback.acks + playback.chains !== playback.interrupts)
        throw Error("Unconsumed Tandy interrupt effects");
      return {
        pcm: output,
        sampleRate,
        duration: length / sampleRate,
        ticks: playback.ticks,
        bus: playback.bus,
        biosFlags: playback.biosFlags,
        interrupts: playback.interrupts,
        acknowledgements: playback.acks,
        chains: playback.chains,
        approximate: true,
        truncated: false,
      };
    }
  }
  throw new TandyPreviewLimitError();
}
