import { nextRandom, u16 } from "./integer.js";

const ACTIVITIES = new Map([
  [1, "jungle"],
  [2, "mountain"],
  [4, "photography"],
  [8, "cave"],
]);
export function expeditionType(flags) {
  const activity = ACTIVITIES.get(flags & 15);
  if (!activity) throw Error(`Unsupported expedition flags ${flags}`);
  return activity;
}
// Main 1000:06b8–0855, normal Launchpad aircraft. The flight owns elapsed
// travel days. Preparing departure never supplies a fabricated flight result.
export class Departure {
  constructor({
    from,
    target,
    days,
    flags,
    difficulty,
    seed,
    rivalCollected = false,
  }) {
    if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 2)
      throw Error("Invalid departure difficulty");
    if (!Number.isInteger(days) || days < 1 || days > 3)
      throw Error("Flight requires one to three travel days");
    if (!Number.isInteger(seed) || seed < 0 || seed > 65535)
      throw Error("Invalid departure RNG seed");
    if (
      !Number.isInteger(from) ||
      from < 0 ||
      from > 35 ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 34
    )
      throw Error("Invalid expedition route");
    if (!Number.isInteger(flags) || flags < 0 || flags > 65535)
      throw Error("Invalid expedition flags");
    this.flags = flags;
    this.from = from;
    this.target = target;
    this.days = days;
    this.activity = expeditionType(flags);
    this.seedBefore = u16(seed);
    let next = nextRandom(this.seedBefore);
    this.variant = next % 3;
    next = nextRandom(next);
    this.raceRoll = next % 100;
    this.racing = this.raceRoll < [25, 50, 75][difficulty] && !rivalCollected;
    this.seed = next;
    this.aircraft = "launchpad";
    this.phase = "prepared";
  }
  // Original speech rows at y60/76/92; strings remain in the user's EXE.
  get speechOffsets() {
    return [
      [0x186, 0x199, 0x1a7],
      [0x1b8, 0x1c1, 0x1d0],
      [0x1d9, 0x1e2, 0x1ec],
    ][this.variant];
  }
  get rivalRoute() {
    return this.racing ? { from: this.from, target: this.target } : null;
  }
  get flightRequest() {
    return { days: this.days, racing: Number(this.racing) };
  }
  snapshot() {
    return {
      from: this.from,
      target: this.target,
      days: this.days,
      activity: this.activity,
      flags: this.flags,
      aircraft: this.aircraft,
      variant: this.variant,
      raceRoll: this.raceRoll,
      racing: this.racing,
      seedBefore: this.seedBefore,
      seed: this.seed,
      phase: this.phase,
      flightRequest: this.flightRequest,
      rivalRoute: this.rivalRoute,
    };
  }
}
