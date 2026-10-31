// Resident0e68..0f7c (player),0312..0439 (rival). No campaign state or RNG
// changes here: the caller clears the money-bin latch before this dispatch.
import { RivalReport } from "./rival.js";
import { ResultInputWait } from "./result-input-wait.js";

// The rival notice uses the same status/input/fallback sequence as RivalReport,
// with a seven-tick speech poll rather than fourteen. Player uses09f5(80) only.
export class CampaignVisitNotice extends RivalReport {
  constructor({
    reason,
    target,
    audioEnabled = false,
    queryAudio = false,
    token,
    pollInput = () => true,
    flushInput = () => {},
  }) {
    if (
      !["player", "rival"].includes(reason) ||
      !Number.isInteger(target) ||
      target < 1 ||
      target > 34
    )
      throw Error("Invalid collected-location notice");
    super({
      target,
      audioEnabled,
      queryAudio: reason === "rival" && queryAudio,
      token,
      pollInput,
      flushInput,
    });
    this.reason = reason;
    if (reason === "player") {
      this.busy = false;
      this.statusKnown = true;
      this.phase = "dialogue";
      this.remaining = 80 * 7;
    }
  }
  begin() {
    if (this.reason === "rival") return super.begin();
    if (this.started) throw Error("Collected notice already started");
    this.started = true;
    this.wait = new ResultInputWait({
      state: this,
      count: 80,
      pollInput: this.pollInput,
      flushInput: this.onFlushInput,
    });
    this.wait.begin();
    this.complete = this.wait.complete;
  }
  readSpeechInput() {
    super.readSpeechInput();
    if (!this.waitingForSpeechInput && !this.complete) this.pollRemaining = 7;
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
  setAudioStatus(token, busy) {
    if (this.reason === "rival") super.setAudioStatus(token, busy);
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
      ...(this.waitingForAudio ? { waitingForAudio: true } : {}),
      ...(this.waitingForInputPoll ? { waitingForInputPoll: true } : {}),
    };
  }
}
