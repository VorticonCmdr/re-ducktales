import { investmentPrice, tradeInvestment } from "./investments.js";
import { ResultInputWait } from "./result-input-wait.js";

// Original overlay10 menu state. Memory persists across screen visits; this
// controller owns only selection,input latches and presentation waits.
export class InvestmentScreen {
  constructor(
    memory,
    resources,
    { pollInput = () => true, flushInput = () => {} } = {},
  ) {
    if (typeof pollInput !== "function" || typeof flushInput !== "function")
      throw Error("Invalid investment input environment");
    this.pollInput = pollInput;
    this.onFlushInput = flushInput;
    this.wait = null;
    this.memory = memory;
    this.resources = resources;
    this.selected = this.top = 10;
    this.row = 0;
    this.button = 0;
    this.company = null;
    this.message = 0;
    this.latched = true;
    this.repeat = 0;
    this.complete = false;
    memory.b(0x3bb4, 0);
    this.news = Array.from({ length: 15 }, (_, i) => i).filter((i) =>
      [1, 2, 3, 4].includes(memory.b(0x92d6 + i * 46)),
    );
    this.phase = "portfolio";
    this.nextNews();
  }
  nextNews() {
    if (!this.news.length) {
      this.phase = "portfolio";
      return;
    }
    this.company = this.news.shift();
    this.newsStatus = this.memory.b(0x92d6 + this.company * 46);
    this.memory.b(
      0x92d6 + this.company * 46,
      this.newsStatus < 3 ? 5 : this.newsStatus | 128,
    );
    this.phase = "news";
    this.repeat = 7;
  }
  fire() {
    this.latched = true;
    if (this.phase === "news") {
      this.nextNews();
      return;
    }
    if (this.phase === "broker") {
      this.skipRequested = true;
      return;
    }
    if (this.phase === "portfolio") {
      if (this.selected === 15) this.leave();
      else {
        this.company = this.selected;
        this.button = 0;
        this.message = 0;
        this.phase = "company";
      }
      return;
    }
    if (this.phase !== "company")
      throw Error(`Unsupported investment phase ${this.phase}`);
    if (this.button === 0) {
      this.phase = "portfolio";
      return;
    }
    this.message = tradeInvestment(
      this.memory,
      this.company,
      this.button === 1 ? "buy" : "sell",
    );
    if (this.message === 2 || this.message === 3) this.latched = false;
  }
  leave() {
    if (this.memory.b(0x3bb4)) {
      this.phase = "broker";
      this.remaining = 50 * 7;
      // Overlay10:02b8 calls09f5(50),not a held-Fire portfolio poll.
      this.wait = new ResultInputWait({
        state: this,
        count: 50,
        pollInput: this.pollInput,
        flushInput: this.onFlushInput,
      });
      this.wait.begin();
      this.complete = this.wait.complete;
    } else this.complete = true;
  }
  input(event) {
    if (event.type === "fire") {
      this.fire();
      return;
    }
    // Escape is an explicit browser navigation adapter. DOS's global Escape
    // opens its quit dialog; it is not treated as original trading input.
    if (event.type === "back") {
      if (this.phase === "company") this.phase = "portfolio";
      else if (this.phase === "portfolio") this.leave();
      else if (this.phase === "news") this.nextNews();
      return;
    }
    if (this.phase === "company" && ["left", "right"].includes(event.type)) {
      this.button = (this.button + (event.type === "left" ? 2 : 1)) % 3;
      this.message = 0;
    }
    if (this.phase === "portfolio" && ["up", "down"].includes(event.type)) {
      this.move(event.type);
      this.repeat = 14;
    }
  }
  move(direction) {
    const delta = direction === "up" ? -1 : 1;
    this.selected = (this.selected + delta + 16) & 15;
    this.row += delta;
    if (this.row < 0) {
      this.row = 0;
      this.top = (this.top + 15) & 15;
    }
    if (this.row > 5) {
      this.row = 5;
      this.top = (this.top + 1) & 15;
    }
  }
  advanceTick(controls) {
    if (this.phase === "broker") {
      this.complete = this.wait.advanceTick();
      return;
    }
    if (!controls.fire) {
      this.latched = false;
      if (this.phase === "company") this.message = 0;
    }
    if (this.repeat > 0) this.repeat--;
    if (
      this.phase === "portfolio" &&
      this.repeat === 0 &&
      ["up", "down"].includes(controls.direction)
    ) {
      this.move(controls.direction);
      this.repeat = 14;
    }
    if (controls.fire && !this.latched && this.repeat === 0) this.fire();
  }
  flushInput() {
    if (this.phase !== "broker" || !this.wait)
      throw Error("Investment flush outside broker reader");
    this.wait.flushInput();
  }
  resumeInputPoll() {
    if (this.phase !== "broker" || !this.wait)
      throw Error("Investment resume outside broker reader");
    this.wait.resumeInputPoll();
    this.complete = this.wait.complete;
  }
  snapshot() {
    return {
      phase: this.phase,
      selected: this.selected,
      top: this.top,
      button: this.button,
      company: this.company,
      message: this.message,
      newsStatus: this.newsStatus ?? null,
      remaining: this.remaining ?? 0,
      complete: this.complete,
      ...(this.wait?.waitingForInputPoll ? { waitingForInputPoll: true } : {}),
      shares: Array.from({ length: 15 }, (_, i) =>
        this.memory.i(0x92d4 + i * 46),
      ),
      prices: Array.from({ length: 15 }, (_, i) =>
        investmentPrice(this.memory, i),
      ),
    };
  }
}
