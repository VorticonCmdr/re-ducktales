// External BIOS40:6c provider. No game RNG or DOM access. The nominal PIT
// phase starts at construction; native sub-tick/clock-sync parity is not implied.
export const BIOS_TICK_HZ = 1193182 / 65536;
export const BIOS_DAY_TICKS = 0x1800b0;
const rate = BIOS_TICK_HZ / 1000;
export function biosTicksAtLocalTime(milliseconds) {
  if (
    !Number.isInteger(milliseconds) ||
    milliseconds < 0 ||
    milliseconds >= 86400000
  )
    throw Error("Invalid BIOS local time");
  return Math.floor(milliseconds * rate);
}
export function parseBiosSeedOverride(raw) {
  if (raw === null) return null;
  if (
    typeof raw !== "string" ||
    !/^(0|[1-9][0-9]{0,4})$/.test(raw) ||
    Number(raw) > 65535
  )
    throw Error("Invalid bios-seed override;expected an integer 0..65535");
  return Number(raw);
}
export class BiosClock {
  constructor({ clock, initialMilliseconds, fixedWord = null }) {
    if (
      typeof clock !== "function" ||
      (fixedWord !== null &&
        (!Number.isInteger(fixedWord) || fixedWord < 0 || fixedWord > 65535))
    )
      throw Error("Invalid BIOS clock provider");
    this.clock = clock;
    this.initialMilliseconds = initialMilliseconds;
    this.initialTicks = biosTicksAtLocalTime(initialMilliseconds);
    this.fixedWord = fixedWord;
    this.origin = this.now();
    this.pausedMilliseconds = 0;
    this.lastElapsed = 0;
    this.reads = [];
  }
  now() {
    const now = this.clock();
    if (
      !Number.isFinite(now) ||
      now < 0 ||
      (this.lastNow !== undefined && now < this.lastNow)
    )
      throw Error("Invalid or backwards BIOS clock");
    this.lastNow = now;
    return now;
  }
  pauseDuration(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw Error("Invalid BIOS pause duration");
    const elapsed =
      this.now() - this.origin - this.pausedMilliseconds - milliseconds;
    if (elapsed < this.lastElapsed)
      throw Error("BIOS pause overlaps consumed time");
    this.pausedMilliseconds += milliseconds;
  }
  readWord(boundary) {
    if (!["startup", "difficulty"].includes(boundary))
      throw Error("Unsupported BIOS read boundary");
    const elapsed = this.now() - this.origin - this.pausedMilliseconds;
    if (elapsed < this.lastElapsed) throw Error("Backwards BIOS elapsed time");
    this.lastElapsed = elapsed;
    const increments = Math.floor(elapsed * rate);
    // DOSBox's initial local-time conversion can exceed the midnight threshold
    // by two ticks late in the day. The first INT8 then resets to 0.
    const ticks =
      increments === 0
        ? this.initialTicks
        : this.initialTicks >= BIOS_DAY_TICKS
          ? (increments - 1) % BIOS_DAY_TICKS
          : (this.initialTicks + increments) % BIOS_DAY_TICKS;
    const value = this.fixedWord ?? ticks & 65535;
    this.reads.push({ boundary, elapsed, ticks, value });
    return value;
  }
  snapshot() {
    return {
      mode: this.fixedWord === null ? "local-clock" : "fixed-word",
      initialTicks: this.initialTicks,
      initialMilliseconds: this.initialMilliseconds,
      reads: this.reads.map((r) => ({ ...r })),
    };
  }
}
