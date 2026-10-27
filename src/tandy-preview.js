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

export function renderTandyPreview(bytes, id, { sampleRate = 44100 } = {}) {
  if (!Number.isInteger(id) || id < 0 || id > 120)
    throw Error(`Unsupported Tandy public sound ID ${id}`);
  const chip = new TandyTones({ sampleRate }),
    bus = [],
    biosFlags = [];
  let tick = -1;
  const driver = new TandyDriver(bytes, {
    writePort: (port, value) => {
      bus.push({ tick, port, value });
      if (port === 0xc0) chip.write(value);
      else if (port !== 0x61) throw Error(`Unsupported Tandy port ${port}`);
    },
  });
  // Independent audition environment: port61 control0,initial chip state above,
  // first sequencer tick at time0. No expected PCM or final state supplies input.
  driver.reset(0);
  driver.start(id, { port61: 0 });
  const pcm = [];
  let ticks = 0;
  for (tick = 0; tick < 1024; tick++) {
    const end = Math.round(tick * TANDY_TICK_SECONDS * sampleRate);
    while (pcm.length < end) pcm.push(chip.sample());
    driver.processTick({ clearBiosFlags: (mask) => biosFlags.push(mask) });
    ticks++;
    if (!driver.active) {
      if (chip.volumes.some((v) => v !== 15))
        throw Error("Tandy sequence ended without muting all channels");
      return {
        pcm: Float32Array.from(pcm),
        sampleRate,
        duration: pcm.length / sampleRate,
        ticks,
        bus,
        biosFlags,
        approximate: true,
        truncated: false,
      };
    }
  }
  throw Error(
    "Tandy audition exceeded 1024 ticks; persistent playback is not implemented",
  );
}
