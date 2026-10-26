// Resident0e68..0f7c (player),0312..0439 (rival). No campaign state or RNG
// changes here: the caller clears the money-bin latch before this dispatch.
export class CampaignVisitNotice {
  constructor({ reason, target, audioEnabled = false, token }) {
    if (
      !["player", "rival"].includes(reason) ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 34
    )
      throw Error("Invalid collected-location notice");
    this.reason = reason;
    this.target = target;
    this.token = token;
    this.audioEnabled = audioEnabled;
    this.busy = reason === "rival" && audioEnabled;
    this.phase = this.busy ? "speech" : "dialogue";
    this.remaining = (reason === "player" ? 80 : 40) * 7;
    this.skipRequested = false;
    this.polledBusy = false;
    this.pollRemaining = 0;
    this.complete = false;
  }
  get portrait() {
    return this.reason === "player" ? 30 : 33;
  }
  get rows() {
    return this.reason === "player"
      ? [0xb1, 0xb7, 0xc5, 0xd6, 0xe5, 0xf1, 0xfd].map((at, i) => ({
          at,
          x: 168,
          y: 60 + i * 16,
        }))
      : [0x10d, 0x11d, 0x12c, 0x13b].map((at, i) => ({
          at,
          x: 168,
          y: [60, 76, 100, 116][i],
        }));
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid visit audio setting");
    this.audioEnabled = enabled;
    if (!enabled) this.busy = false;
  }
  setAudioStatus(token, busy) {
    if (typeof busy !== "boolean") throw Error("Invalid visit audio status");
    if (token === this.token) this.busy = this.audioEnabled && busy;
  }
  advanceTick() {
    if (this.complete) return true;
    if (this.phase === "dialogue") {
      this.remaining--;
      this.complete =
        this.remaining === 0 ||
        (this.remaining % 7 === 0 && this.skipRequested);
      return this.complete;
    }
    if (this.pollRemaining > 0 && --this.pollRemaining > 0) return false;
    if (!this.busy) {
      // An observed busy poll sets the original local flag to1. When sound
      // finishes, that flag bypasses the extra40-poll sound-disabled wait.
      if (this.polledBusy) this.complete = true;
      else this.phase = "dialogue";
    } else if (this.skipRequested) this.complete = true;
    else {
      this.polledBusy = true;
      this.pollRemaining = 7;
    }
    return this.complete;
  }
  snapshot() {
    return {
      reason: this.reason,
      target: this.target,
      phase: this.phase,
      remaining: this.remaining,
      busy: this.busy,
      pollRemaining: this.pollRemaining,
      complete: this.complete,
    };
  }
}
