import { TandyDriver } from "./tandy-driver.js";

export const TANDY_TICK_SECONDS = (1365 * 12) / 1193182;
export const TANDY_CLOCK_HZ = 14318180 / 4;

// Tone-only SN76489 register/counter boundary. TI's 10-bit period counters
// toggle at clock/16; each attenuation step is2dB and15 is off. This preview
// supplies explicit initial periods/counters/output phases rather than claiming
// to recover the unobserved original chip phase. Noise remains unsupported.
export class TandyTones {
  constructor({
    sampleRate = 44100,
    periods = [1, 1, 1],
    counters = [1, 1, 1],
    outputs = [1, 1, 1],
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
      [...periods, ...counters].some(
        (v) => !Number.isInteger(v) || v < 1 || v > 1023,
      ) ||
      outputs.some((v) => v !== 0 && v !== 1)
    )
      throw Error("Invalid Tandy initial counter/phase values");
    this.sampleRate = sampleRate;
    this.periods = [...periods];
    this.counters = [...counters];
    this.outputs = [...outputs];
    this.volumes = [15, 15, 15, 15];
    this.latched = 0;
    this.remainder = 0;
  }
  write(value) {
    if (!Number.isInteger(value) || value < 0 || value > 255)
      throw Error("Invalid PSG register byte");
    if (value & 128) this.latched = (value >>> 4) & 7;
    const ch = this.latched >>> 1;
    if (this.latched & 1) this.volumes[ch] = value & 15;
    else {
      if (ch === 3) throw Error("Tandy noise synthesis is not implemented");
      this.periods[ch] =
        value & 128
          ? (this.periods[ch] & 0x3f0) | (value & 15)
          : (this.periods[ch] & 15) | ((value & 63) << 4);
    }
  }
  sample() {
    if (this.volumes[3] !== 15)
      throw Error("Tandy noise channel is not implemented");
    for (let ch = 0; ch < 3; ch++)
      if (this.periods[ch] === 0)
        throw Error("Tandy zero-period behavior is not implemented");
    this.remainder += TANDY_CLOCK_HZ;
    while (this.remainder >= this.sampleRate * 16) {
      this.remainder -= this.sampleRate * 16;
      for (let ch = 0; ch < 3; ch++)
        if (--this.counters[ch] === 0) {
          this.counters[ch] = this.periods[ch];
          this.outputs[ch] ^= 1;
        }
    }
    let value = 0;
    for (let ch = 0; ch < 3; ch++)
      if (this.volumes[ch] !== 15)
        value +=
          (this.outputs[ch] ? 1 : -1) * 0.18 * 10 ** (-this.volumes[ch] / 10);
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
  throw Error("Tandy preview did not terminate");
}
