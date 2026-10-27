import { nextRandom, u8, u16 } from "./integer.js";
import { travelDays } from "./campaign.js";

// Resident045e..047c: the comparison is unsigned and strict. No Launchpad
// variant/race draws are consumed on this aircraft's route.
export function atomicRoll(seed, difficulty) {
  if (![0, 1, 2].includes(difficulty))
    throw Error(`Unsupported atomic difficulty ${difficulty}`);
  seed = nextRandom(u16(seed));
  const roll = seed % 100;
  return { seed, roll, success: roll > 8 + difficulty * 8 };
}

// Resident0573..059e stops at the FIRST unclaimed slot. The chosen slot may
// equal the requested destination. If none exists, keep the requested target.
export function misdirectedDestination(locations, target) {
  if (locations.length !== 35)
    throw Error("Atomic transport requires35 locations");
  for (let i = 1; i < 35; i++) {
    if (!locations[i].playerCollected && !locations[i].rivalCollected) return i;
  }
  return target;
}

export class AtomicTransport {
  constructor({
    from,
    target,
    day,
    difficulty,
    seed,
    locations,
    audioEnabled = false,
    token,
  }) {
    if (
      !Number.isInteger(from) ||
      from < 0 ||
      from > 35 ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 34
    )
      throw Error(`Invalid atomic route ${from} -> ${target}`);
    Object.assign(this, atomicRoll(seed, difficulty), {
      from,
      requested: target,
      day: u8(day),
      locations,
      audioEnabled,
      token,
    });
    this.target = this.success ? target : null;
    this.days = this.success ? travelDays(locations, from, target) : null;
    if (this.success) this.day = u8(this.day + this.days);
    this.phase = "charge";
    this.remaining = 7;
    this.skipRequested = false;
    this.busy = false;
    this.outcome = null;
    this.events = [{ type: "stopAudio" }];
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid atomic audio setting");
    this.audioEnabled = enabled;
    if (!enabled) this.busy = false;
  }
  setAudioStatus(token, busy) {
    if (typeof busy !== "boolean") throw Error("Invalid atomic audio status");
    if (token === this.token) this.busy = this.audioEnabled && busy;
  }
  fire() {
    if (this.phase === "report") this.skipRequested = true;
  }
  beginReport() {
    this.target = misdirectedDestination(this.locations, this.requested);
    this.phase = "report";
    this.remaining = 60 * 7;
    this.skipRequested = false;
  }
  finish() {
    if (!this.success) {
      this.days = travelDays(this.locations, this.from, this.target);
      this.day = u8(this.day + this.days);
    }
    this.phase = "complete";
    this.outcome = {
      target: this.target,
      day: this.day,
      seed: this.seed,
      days: this.days,
      misdirected: !this.success,
    };
  }
  advanceTick() {
    if (this.outcome) return;
    if (this.phase === "charge") {
      if (--this.remaining > 0) return;
      if (this.success) {
        if (this.audioEnabled) this.events.push({ type: "sound", id: 0x54 });
        this.finish();
      } else {
        this.phase = "sound";
        this.busy = this.audioEnabled;
        if (this.audioEnabled)
          this.events.push({ type: "sound", id: 0x45, token: this.token });
        else this.beginReport();
      }
      return;
    }
    if (this.phase === "sound") {
      if (!this.busy) this.beginReport();
      return;
    }
    if (this.phase !== "report")
      throw Error(`Unsupported atomic phase ${this.phase}`);
    if (
      --this.remaining === 0 ||
      (this.remaining % 7 === 0 && this.skipRequested)
    ) {
      if (this.audioEnabled && this.skipRequested)
        this.events.push({ type: "sound", id: 0x24 });
      this.finish();
    }
  }
  drainEvents() {
    return this.events.splice(0);
  }
  snapshot() {
    return {
      phase: this.phase,
      from: this.from,
      requested: this.requested,
      target: this.target,
      seed: this.seed,
      roll: this.roll,
      success: this.success,
      day: this.day,
      days: this.days,
      remaining: this.remaining,
      busy: this.busy,
      outcome: this.outcome ? { ...this.outcome } : null,
    };
  }
}
