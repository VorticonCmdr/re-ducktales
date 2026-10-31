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
    hasAudioDevice = () => false,
    pollInput = () => true,
    flushInput = () => {},
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
    if (
      typeof pollInput !== "function" ||
      typeof flushInput !== "function" ||
      typeof hasAudioDevice !== "function" ||
      typeof audioEnabled !== "boolean"
    )
      throw Error("Invalid atomic input boundary");
    this.pollInput = pollInput;
    this.onFlushInput = flushInput;
    this.hasAudioDevice = hasAudioDevice;
    this.waitingForInputPoll = false;
    this.inputPolls = 0;
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
    this.statusKnown = false;
    this.outcome = null;
    // Both original branches guard the initial request0 on03be.
    this.events = audioEnabled ? [{ type: "sound", id: 0 }] : [];
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid atomic audio setting");
    this.audioEnabled = enabled;
  }
  setAudioStatus(token, busy) {
    if (typeof busy !== "boolean") throw Error("Invalid atomic audio status");
    if (token !== this.token || this.phase !== "sound") return;
    this.busy = busy;
    this.statusKnown = true;
  }
  resumeAudioStatus() {
    if (this.phase !== "sound" || !this.statusKnown || this.busy !== false)
      throw Error("Atomic resumed outside idle sound-status boundary");
    //056b is a busy spin without a timed delay or input read.
    this.beginReport();
  }
  fire() {
    if (this.phase === "report") this.skipRequested = true;
  }
  beginReport() {
    this.target = misdirectedDestination(this.locations, this.requested);
    this.phase = "report";
    this.remaining = 60 * 7;
    this.skipRequested = false;
    // Resident067e calls shared09f5(60): flush once, then read before waiting.
    this.onFlushInput();
    this.pollReportInput();
  }
  pollReportInput() {
    const ready = this.pollInput();
    if (typeof ready !== "boolean")
      throw Error("Invalid atomic input poll result");
    if (!ready) {
      this.waitingForInputPoll = true;
      return;
    }
    this.waitingForInputPoll = false;
    this.inputPolls++;
    if (this.skipRequested) {
      if (this.audioEnabled) this.events.push({ type: "sound", id: 0x24 });
      this.finish();
    }
  }
  resumeInputPoll() {
    if (this.phase !== "report" || !this.waitingForInputPoll)
      throw Error("Atomic resumed outside input reader");
    this.pollReportInput();
  }
  flushInput() {
    this.skipRequested = false;
    this.onFlushInput();
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
        this.busy = null;
        this.statusKnown = false;
        if (this.audioEnabled)
          this.events.push({ type: "sound", id: 0x45, token: this.token });
        else {
          const query = this.hasAudioDevice();
          if (typeof query !== "boolean")
            throw Error("Invalid atomic device provider result");
          if (query)
            this.events.push({ type: "audio-query", token: this.token });
          else {
            this.busy = false;
            this.statusKnown = true;
            this.resumeAudioStatus();
          }
        }
      }
      return;
    }
    if (this.phase === "sound") {
      if (this.statusKnown && this.busy === false) this.resumeAudioStatus();
      return;
    }
    if (this.phase !== "report")
      throw Error(`Unsupported atomic phase ${this.phase}`);
    if (this.waitingForInputPoll) return;
    // The sixtieth neutral wait exits without a sixty-first read. A make in
    // that last wait is not consumed and cannot request the optional click.
    if (--this.remaining === 0) this.finish();
    else if (this.remaining % 7 === 0) this.pollReportInput();
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
      ...(this.phase === "sound" && !this.statusKnown
        ? { waitingForAudio: true }
        : {}),
      ...(this.phase === "report" || (!this.success && this.outcome)
        ? { inputPolls: this.inputPolls }
        : {}),
      ...(this.waitingForInputPoll ? { waitingForInputPoll: true } : {}),
      outcome: this.outcome ? { ...this.outcome } : null,
    };
  }
}
