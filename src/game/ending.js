import { u32 } from "./integer.js";

// Main1036..107f. Shares are not sold here. At the deadline the rival's
// carried cash is also added,but its carried-cash field is not cleared.
export function depositAccounts({
  day,
  money,
  banked,
  rivalMoney,
  rivalBanked,
}) {
  return {
    money: 0,
    banked: u32(banked + money),
    rivalMoney: u32(rivalMoney),
    rivalBanked:
      (day << 24) >> 24 >= 30
        ? u32(rivalBanked + rivalMoney)
        : u32(rivalBanked),
  };
}

// Main0fb0..0fe9: signed high word,then unsigned low word. Equality wins.
export function campaignWinner(banked, rivalBanked) {
  return (banked | 0) >= (rivalBanked | 0);
}

// Resident12f5:0ee7/0f26/0f55/1098. Rendering and external input are separate.
// Picture reveals/page-copy costs are not included in these dialogue waits.
export class CampaignEnding {
  constructor({ banked, rivalBanked, day }) {
    this.banked = u32(banked);
    this.rivalBanked = u32(rivalBanked);
    this.day = day;
    this.won = campaignWinner(banked, rivalBanked);
    this.phase = "cover";
    this.remaining = 100 * 7;
    this.skipRequested = false;
    this.choice = 0;
    this.repeat = 0;
    this.result = null;
    this.credit = -1;
  }
  get asset() {
    if (this.phase === "cover") return this.won ? 36 : 37;
    if (this.phase === "celebration") return this.won ? 39 : 33;
    if (this.phase === "credits") return 1;
    if (this.phase === "farewell" || this.phase === "closed") return 0;
    return null;
  }
  input(event) {
    if (event.type === "fire") {
      if (this.phase === "replay") {
        if (this.choice === 0) this.result = "again";
        else this.beginCredits();
      } else this.skipRequested = true;
      return;
    }
    if (
      this.phase === "replay" &&
      ["up", "down", "left", "right"].includes(event.type)
    ) {
      this.choice ^= 1;
      this.repeat = 14;
    }
  }
  beginCredits() {
    this.phase = "credits";
    this.credit = -1;
    this.remaining = 20 * 7;
    this.skipRequested = false;
  }
  advanceTick(controls = { fire: false, direction: null }) {
    if (this.phase === "replay") {
      if (this.repeat > 0) this.repeat--;
      if (this.repeat === 0 && controls.direction) {
        this.choice ^= 1;
        this.repeat = 14;
      }
      return;
    }
    if (this.phase === "closed") return;
    this.remaining--;
    if (this.remaining > 0 && !(this.remaining % 7 === 0 && this.skipRequested))
      return;
    const skipped = this.skipRequested;
    this.skipRequested = false;
    if (this.phase === "cover") {
      this.phase = "celebration";
      this.remaining = 700;
    } else if (this.phase === "celebration") this.phase = "replay";
    else if (this.phase === "credits") {
      if (skipped || controls.fire || ++this.credit >= 26) {
        this.phase = "farewell";
        this.remaining = 40 * 7;
      } else this.remaining = 20 * 7;
    } else if (this.phase === "farewell") this.phase = "closed";
    else throw Error(`Unsupported ending phase ${this.phase}`);
  }
  snapshot() {
    return {
      phase: this.phase,
      won: this.won,
      banked: this.banked,
      rivalBanked: this.rivalBanked,
      day: this.day,
      remaining: this.remaining,
      choice: this.choice,
      credit: this.credit,
      asset: this.asset,
      result: this.result,
    };
  }
}
