import { nextRandom, s16, u8, u16, u32 } from "./integer.js";
import { OFFICE, travelDays } from "./campaign.js";
import { ResultInputWait } from "./result-input-wait.js";

const signedByte = (n) => (n << 24) >> 24;
export const RIVAL_UNLOCK = Object.freeze({
  jungle: 1,
  mountain: 2,
  cave: 4,
  photography: 8,
});

// Shared original126b claim dialogue:global sound-status/raw Fire loop,then
// optional09f5(40). The host supplies initial status and completion explicitly.
export class RivalReport {
  constructor({
    target,
    variant,
    name,
    audioEnabled = false,
    token,
    pollInput = () => true,
    flushInput = () => {},
  }) {
    if (
      typeof audioEnabled !== "boolean" ||
      typeof pollInput !== "function" ||
      typeof flushInput !== "function"
    )
      throw Error("Invalid rival input environment");
    Object.assign(this, { target, variant, audioEnabled, token, pollInput });
    if (name !== undefined) this.name = name;
    this.onFlushInput = flushInput;
    this.busy = audioEnabled ? null : false;
    this.statusKnown = !audioEnabled;
    this.waitingForAudio = false;
    this.phase = audioEnabled ? "speech" : "dialogue";
    this.polledBusy = false;
    this.pollRemaining = 0;
    this.remaining = 40 * 7;
    this.skipRequested = false;
    this.complete = false;
    this.started = false;
    this.wait = null;
  }
  setAudioEnabled(enabled) {
    if (typeof enabled !== "boolean") throw Error("Invalid rival audio enable");
    this.audioEnabled = enabled;
    if (!enabled) {
      this.busy = false;
      this.statusKnown = true;
    }
  }
  setAudioStatus(token, busy) {
    if (token !== this.token) return;
    if (typeof busy !== "boolean") throw Error("Invalid rival audio status");
    this.busy = this.audioEnabled && busy;
    this.statusKnown = true;
  }
  begin() {
    if (this.started) throw Error("Rival dialogue already started");
    this.started = true;
    this.flushInput(); //126b028d:19a5,also before the raw sound-status loop.
    this.readSpeech();
  }
  flushInput() {
    if (this.wait) this.wait.flushInput();
    else {
      this.skipRequested = false;
      this.onFlushInput();
    }
  }
  readSpeech() {
    if (!this.statusKnown) {
      this.waitingForAudio = true;
      return;
    }
    this.waitingForAudio = false;
    if (!this.busy) {
      if (this.polledBusy) this.complete = true;
      else {
        this.phase = "dialogue";
        this.wait = new ResultInputWait({
          state: this,
          count: 40,
          pollInput: this.pollInput,
          flushInput: this.onFlushInput,
        });
        this.wait.begin();
        this.complete = this.wait.complete;
      }
    } else if (this.skipRequested) {
      // Raw Fire exits speech without the fallback's click24.
      this.skipRequested = false;
      this.complete = true;
    } else {
      this.polledBusy = true;
      this.pollRemaining = 14;
    }
  }
  resumeAudioStatus() {
    if (
      !this.started ||
      !this.waitingForAudio ||
      !this.statusKnown ||
      this.complete
    )
      throw Error("Rival audio resumed outside status boundary");
    this.readSpeech();
  }
  get waitingForInputPoll() {
    return this.wait?.waitingForInputPoll === true;
  }
  get skipped() {
    return this.wait?.skipped === true;
  }
  resumeInputPoll() {
    if (!this.waitingForInputPoll)
      throw Error("Rival resumed outside input reader");
    this.wait.resumeInputPoll();
    this.complete = this.wait.complete;
  }
  advanceTick() {
    if (!this.started) {
      this.begin();
      return this.complete;
    }
    if (this.complete) return true;
    if (this.waitingForAudio) return false;
    if (this.phase === "dialogue") {
      this.complete = this.wait.advanceTick();
      return this.complete;
    }
    if (this.pollRemaining > 0 && --this.pollRemaining > 0) return false;
    this.readSpeech();
    return this.complete;
  }
  snapshot() {
    return {
      target: this.target,
      ...(this.name !== undefined ? { name: this.name } : {}),
      variant: this.variant,
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

// Resident126b:0345/038a/03fb/0470. Strict comparisons keep the first tie.
export function selectRivalDestination({ locations, loot, rival, difficulty }) {
  if (![0, 1, 2].includes(difficulty))
    throw Error(`Unsupported rival difficulty ${difficulty}`);
  if ((rival.money | 0) > [1000, 5000, 10000][difficulty]) return 0;
  let selected = OFFICE;
  let best = difficulty === 1 && rival.day & 1 ? 16000 : 0;
  for (let i = 1; i < 35; i++) {
    const location = locations[i];
    if (!location) throw Error(`Missing rival location ${i}`);
    if (
      i === rival.location ||
      location.playerCollected ||
      location.rivalCollected
    )
      continue;
    if (difficulty === 0) return i;
    const treasure = loot[location.treasure - 1];
    if (!treasure) throw Error(`Missing rival treasure ${location.treasure}`);
    const value = s16(treasure.value);
    const days = travelDays(locations, rival.location, i);
    if (difficulty === 1 && rival.day & 1) {
      if (days < best) {
        selected = i;
        best = days;
      }
    } else {
      const score = difficulty === 2 ? Math.trunc(value / days) : value;
      if (score > best) {
        selected = i;
        best = score;
      }
    }
  }
  return selected;
}

// Resident126b:0008..032c. One source dispatch invokes ONE trip,not an elapsed
// calendar catch-up loop. The caller owns report/audio waits and action order.
export function advanceRival({
  day,
  difficulty,
  unlockMask,
  seed,
  rival,
  locations,
  loot,
  forcedTarget = null,
  memory = null,
}) {
  seed = u16(seed);
  if (
    forcedTarget === null &&
    (signedByte(day) < signedByte(rival.day) ||
      signedByte(day) < 2 ||
      !u8(unlockMask))
  )
    return { acted: false, seed, draws: 0, report: null };
  const target =
    forcedTarget ??
    selectRivalDestination({ locations, loot, rival, difficulty });
  if (!Number.isInteger(target) || target < 0 || target > OFFICE)
    throw Error(`Unsupported rival target ${target}`);
  let draws = 0;
  const random = () => {
    seed = nextRandom(seed);
    draws++;
    return seed;
  };
  const from = rival.location;
  rival.day = u8(rival.day + travelDays(locations, from, target));
  let report = null,
    lostCash = false;
  if (target === 0) {
    rival.banked = u32((rival.banked ?? 0) + rival.money);
    rival.money = 0;
  } else {
    const roll = random() % 100;
    if (roll < 25) rival.day = u8(rival.day - 1);
    else if (roll < 50) rival.day = u8(rival.day + 1);
    else if (roll < 55 && forcedTarget === null) {
      rival.money = 0;
      lostCash = true;
    }
    const success = random() & 1;
    if (success || forcedTarget !== null) {
      let value, name;
      if (target === OFFICE) {
        ({ value, name } = claimExhaustedRivalRecord(memory));
      } else {
        const location = locations[target],
          treasure = loot[location.treasure - 1];
        if (!treasure)
          throw Error(`Missing rival treasure ${location.treasure}`);
        location.rivalCollected = true;
        value = s16(treasure.value);
      }
      rival.money = u32(rival.money + value);
      report = {
        variant: random() & 1,
        target,
        value,
        ...(name !== undefined ? { name } : {}),
      };
    }
  }
  rival.location = target;
  return {
    acted: true,
    from,
    target,
    seed,
    draws,
    report,
    lostCash,
    kind: target === 0 ? "bank" : report ? "claim" : "miss",
  };
}

//126b:0143..0155/0211..0254 also execute for the selector's sentinel35.
// Its8-byte record aliases the first two flight terrain entries. Preserve the
// original out-of-table flag write and raw byte string; do not invent a location.
export function claimExhaustedRivalRecord(memory) {
  if (
    !(memory?.bytes instanceof Uint8Array) ||
    memory.bytes.length !== 65536 ||
    typeof memory.b !== "function" ||
    typeof memory.i !== "function"
  )
    throw Error("Missing original data segment for exhausted rival claim");
  memory.b(0x4f49, 1);
  const namePointer = u16(memory.i(0x4f42)),
    treasurePointer = u16(memory.i(0x4f44)),
    value = memory.i(u16(treasurePointer + 2));
  let name = "";
  for (let i = 0; i < 65536; i++) {
    const byte = memory.b(u16(namePointer + i));
    if (byte === 0) return { value, name };
    name += String.fromCharCode(byte);
  }
  throw Error("Unterminated original exhausted-rival report name");
}
