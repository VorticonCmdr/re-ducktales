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

// Resident ending and credits routines. External input/driver/retrace providers
// are separate. presentationReady is a conditional routine-entry precondition
// for original wait-boundary checks; the browser always executes presentations.
export class CampaignEnding {
  constructor({
    banked,
    rivalBanked,
    day,
    audioEnabled = false,
    presentationReady = false,
    pollInput = () => true,
    flushInput = () => {},
  }) {
    this.banked = u32(banked);
    this.rivalBanked = u32(rivalBanked);
    this.day = day;
    this.won = campaignWinner(banked, rivalBanked);
    this.audioEnabled = false;
    this.setAudioEnabled(audioEnabled);
    if (typeof presentationReady !== "boolean")
      throw Error("Invalid ending presentation precondition");
    this.presentationReady = presentationReady;
    this.pollInput = pollInput;
    this.onFlushInput = flushInput;
    this.phase = "cover";
    this.remaining = 700;
    this.choice = 0;
    this.repeat = 0;
    this.result = null;
    this.credit = -1;
    this.footerCleared = false;
    this.events = [];
    this.controls = { fire: false, direction: null };
    this.fireRequested = false;
    this.directionRequested = null;
    this.transition = null;
    this.visible = null;
    this.transitionToken = 0;
    this.tick = 0;
    this.retrace = 0;
    this.inputReads = 0;
    this.dialogueReads = 0;
    this.iterator = this.run();
    this.resume();
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean")
      throw Error("Invalid ending audio setting");
    this.audioEnabled = enabled;
  }
  setControls(controls) {
    if (
      typeof controls.fire !== "boolean" ||
      ![null, "up", "down", "left", "right"].includes(controls.direction)
    )
      throw Error("Invalid ending controls");
    this.controls = { ...controls };
  }
  sound(id) {
    if (this.audioEnabled) this.events.push({ type: "sound", id });
  }
  drainEvents() {
    return this.events.splice(0);
  }
  get asset() {
    if (this.phase === "cover") return this.won ? 36 : 37;
    if (this.phase === "celebration") return this.won ? 39 : 38;
    if (this.phase === "credits") return 1;
    if (["farewell", "closed"].includes(this.phase)) return 0;
    return null;
  }
  get ready() {
    if (!this.transition) return true;
    if (this.transition.kind !== "flip" || !this.visible) return false;
    return ["phase", "asset", "choice", "credit", "clearFooter"].every(
      (key) => this.visible[key] === this.transition.target[key],
    );
  }
  input(event) {
    if (!this.wait || this.phase === "closed") return;
    if (event.type === "fire") this.fireRequested = true;
    if (["up", "down", "left", "right"].includes(event.type))
      this.directionRequested = event.type;
  }
  flushInput(releaseControls = true) {
    this.fireRequested = false;
    this.directionRequested = null;
    if (releaseControls) this.controls = { fire: false, direction: null };
    this.onFlushInput(releaseControls);
  }
  *readInput() {
    const ready = this.pollInput();
    if (typeof ready !== "boolean")
      throw Error("Invalid ending global input provider");
    if (!ready) yield { clock: "input", remaining: 1 };
    this.inputReads++;
    const input = {
      fire: this.fireRequested || this.controls.fire,
      direction: this.directionRequested ?? this.controls.direction,
    };
    this.fireRequested = false;
    this.directionRequested = null;
    return input;
  }
  resume() {
    const next = this.iterator.next();
    if (next.done) {
      this.wait = null;
      return;
    }
    if (
      !["driver", "retrace", "input"].includes(next.value.clock) ||
      !Number.isInteger(next.value.remaining) ||
      next.value.remaining < 1
    )
      throw Error("Invalid ending wait");
    this.wait = next.value;
  }
  resumeInputPoll() {
    if (this.wait?.clock !== "input")
      throw Error("Ending resumed outside its input reader");
    this.resume();
  }
  advanceTick(controls) {
    if (controls) this.setControls(controls);
    this.tick++;
    if (this.wait?.clock === "driver") {
      if (this.wait.dialogue) this.remaining--;
      if (this.repeat > 0) this.repeat--;
    }
    this.advance("driver");
  }
  advanceBlockedTick() {
    this.tick++;
  }
  advanceBlockedRetrace() {
    this.retrace++;
  }
  advanceRetrace() {
    this.retrace++;
    this.advance("retrace");
  }
  advance(clock) {
    if (!this.wait || this.wait.clock !== clock || --this.wait.remaining)
      return;
    this.resume();
  }
  *bands(kind) {
    const source = this.visible;
    const target =
      kind === "wipe" || this.phase === "replay"
        ? { phase: "blank", asset: null, choice: 0, credit: -1 }
        : this.describe();
    if (this.presentationReady) {
      this.visible = target;
      return;
    }
    const token = ++this.transitionToken;
    for (let band = 0; band < 5; band++) {
      this.transition = { kind, band, token, source, target };
      yield { clock: "retrace", remaining: 5 };
    }
    this.visible = target;
    this.transition = null;
  }
  describe() {
    return {
      phase: this.phase,
      asset: this.asset,
      choice: this.choice,
      credit: this.credit >= 26 ? -1 : this.credit,
      clearFooter: this.phase === "credits" && this.footerCleared,
    };
  }
  *flip() {
    const target = this.describe();
    this.transition = {
      kind: "flip",
      band: null,
      token: ++this.transitionToken,
      source: this.visible,
      target,
    };
    yield { clock: "retrace", remaining: 1 };
    this.visible = target;
    this.transition = null;
  }
  *picture() {
    yield* this.bands("wipe");
    yield* this.bands("reveal");
  }
  *dialogue(count) {
    this.flushInput(false);
    this.remaining = count * 7;
    for (let poll = 0; poll < count; poll++) {
      const input = yield* this.readInput();
      this.dialogueReads++;
      if (input.fire) {
        this.remaining = 0;
        return true;
      }
      yield { clock: "driver", remaining: 7, dialogue: true };
    }
    this.remaining = 0;
    return false;
  }
  *run() {
    this.phase = "cover";
    yield* this.picture();
    yield* this.dialogue(100);
    yield* this.flip();
    this.phase = "celebration";
    this.remaining = 700;
    yield* this.picture();
    yield* this.dialogue(100);
    this.phase = "replay";
    yield* this.bands("wipe");
    this.sound(1); //12f5:0f74, after wipe and before the blank-page reveal.
    yield* this.bands("reveal");
    this.flushInput(false);
    while (true) {
      const input = yield* this.readInput();
      if (input.fire) break;
      if (input.direction) this.choice ^= 1;
      yield* this.flip();
      if (input.direction) {
        this.flushInput(false);
        this.repeat = 14;
        yield { clock: "driver", remaining: 14 };
      }
    }
    this.sound(0);
    this.events.push({ type: "replay-return", choice: this.choice });
    if (this.choice === 0) {
      this.result = "again";
      return;
    }
    yield* this.credits();
  }
  beginCredits() {
    this.wait = null;
    this.transition = null;
    this.iterator = this.credits();
    this.resume();
  }
  *credits() {
    this.phase = "credits";
    this.credit = -1;
    this.footerCleared = false;
    this.remaining = 140;
    this.sound(0); //12f5:1098, also on direct quit, separately from main's reset.
    yield* this.picture();
    let skipped = yield* this.dialogue(20);
    if (!skipped) {
      this.footerCleared = true;
      yield* this.flip(); //0dee clears the footer on both pages before name0.
      for (this.credit = 0; this.credit < 26; this.credit++) {
        yield* this.flip();
        skipped = yield* this.dialogue(20);
        if (skipped) break;
      }
      if (!skipped) yield* this.flip(); //Final blank footer before farewell.
    }
    if (skipped) this.sound(0x24);
    this.phase = "farewell";
    this.remaining = 280;
    yield* this.picture();
    if (yield* this.dialogue(40)) this.sound(0x24);
    this.sound(0);
    this.phase = "closed";
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
      ready: this.ready,
      ...(this.transition
        ? {
            transition: {
              kind: this.transition.kind,
              band: this.transition.band,
              token: this.transition.token,
            },
          }
        : {}),
      ...(this.wait?.clock === "input" ? { waitingForInputPoll: true } : {}),
    };
  }
}
