import { Departure } from "./departure.js";
import { Campaign, OFFICE, travelDays } from "./campaign.js";
import { MoneyBin } from "./money-bin.js";
import { u32, u16 } from "./integer.js";
export const DRIVER_HZ = 1193182 / (1365 * 12);
export const RETRACE_HZ = 70.086;

export class Game {
  constructor({ biosSeed = 0, locations = null } = {}) {
    this.locations = locations;
    this.campaign = locations ? new Campaign(locations, biosSeed) : null;
    this.scene = "title";
    this.difficulty = 0;
    this.money = 0;
    this.rareCoinTaken = false;
    this.biosSeed = u16(biosSeed);
    this.seed = this.campaign?.seed ?? this.biosSeed;
    this.tick = 0;
    this.bin = null;
    this.departure = null;
    this.effects = [];
    this.diagnostic = null;
  }
  input(event) {
    if (this.diagnostic) throw Error(this.diagnostic);
    if (event.type === "restart") {
      this.scene = "title";
      this.difficulty = 0;
      this.tick = 0;
      this.bin = null;
      this.departure = null;
      this.money = 0;
      this.campaign = this.locations
        ? new Campaign(this.locations, this.biosSeed)
        : null;
      this.seed = this.campaign?.seed ?? this.biosSeed;
      this.rareCoinTaken = false;
      this.effects.push({ type: "stopAudio" });
      return;
    }
    if (this.scene === "title" && event.type === "fire") {
      this.scene = "difficulty";
      return;
    }
    if (this.scene === "difficulty") {
      if (event.type === "up") this.difficulty = (this.difficulty + 2) % 3;
      if (event.type === "down") this.difficulty = (this.difficulty + 1) % 3;
      if (event.type === "fire") this.scene = "office";
      return;
    }
    if (this.scene === "map") {
      const c = this.campaign;
      if (event.type === "step" && !c.info) {
        const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[
          event.direction
        ];
        if (!v) throw Error("Invalid map step");
        c.point(c.cursor.x + v[0], c.cursor.y + v[1]);
        return;
      }
      if (event.type === "direction") {
        c.direction = event.direction;
        return;
      }
      if (event.type === "point" && !c.info) {
        c.point(event.x, event.y);
        return;
      }
      if (event.type === "back") {
        if (c.info) c.info = false;
        else this.travel(OFFICE);
        return;
      }
      if (c.info && ["left", "right"].includes(event.type)) {
        c.choice = 1 - c.choice;
        return;
      }
      if (event.type === "fire") {
        if (c.selected === OFFICE) {
          this.travel(OFFICE);
          return;
        }
        if (!c.info) {
          if (c.location !== OFFICE) {
            this.travel(c.selected);
            return;
          }
          c.info = true;
          c.choice = 0;
          c.direction = null;
          return;
        }
        if (c.choice === 0) {
          c.info = false;
          return;
        }
        this.travel(c.selected);
      }
      return;
    }
    if (this.scene === "office") {
      if (
        event.type === "map" ||
        (event.type === "fire" && event.direction === "right")
      ) {
        if (!this.campaign) throw Error("Campaign locations not loaded");
        this.campaign.openMap();
        this.scene = "map";
        return;
      }
      if (
        event.type === "money-bin" ||
        (event.type === "fire" && event.direction === "up")
      ) {
        this.scene = "money-bin";
        this.bin = new MoneyBin({ coinAvailable: !this.rareCoinTaken });
        this.effects.push(...this.bin.drainEvents());
        return;
      }
      if (event.type === "fire" && ["left", "right"].includes(event.direction))
        throw Error("Untranslated route: investments.");
      if (event.type === "unsupported")
        throw Error(
          `Untranslated route: ${event.route}. Supported routes: money bin and campaign bank travel.`,
        );
      return;
    }
    if (this.scene === "departure") {
      if (event.type === "fire")
        throw Error(
          `Untranslated flight activity: Launchpad's ${this.departure.days}-day flight to ${this.campaign.locations[this.departure.target].name}. Departure is prepared; no arrival or flight outcome has been substituted.`,
        );
      return;
    }
    if (this.scene === "money-bin" && event.type === "fire")
      this.bin.enqueueFire();
  }
  travel(target) {
    const c = this.campaign;
    const days = travelDays(c.locations, c.location, target);
    if (target !== OFFICE && target !== 0) {
      if (days === 0)
        throw Error(
          `Untranslated expedition activity: ${c.locations[target].name}.`,
        );
      const departure = new Departure({
        from: c.location,
        target,
        days,
        flags: c.locations[target].flags,
        difficulty: this.difficulty,
        seed: this.seed,
      });
      this.departure = departure;
      this.seed = departure.seed;
      c.seed = this.seed;
      this.rareCoinTaken = false;
      c.direction = null;
      this.scene = "departure";
      this.effects.push({ type: "stopAudio" });
      return;
    }
    if (c.day + days >= 30)
      throw Error(
        "Campaign ending is not translated; journey would reach day 30.",
      );
    c.day += days;
    c.location = target;
    if (target === 0) {
      c.banked = u32(c.banked + this.money);
      this.money = 0;
      this.rareCoinTaken = false;
      c.openMap();
    } else {
      this.scene = "office";
      c.info = false;
    }
  }
  advanceTick() {
    this.tick++;
    if (this.scene === "map") this.campaign.advanceTick();
    if (this.scene !== "money-bin") return;
    this.bin.advanceTick();
    this.collectEffects();
  }
  advanceRetrace() {
    if (this.scene === "money-bin") {
      this.bin.advanceRetrace();
      this.collectEffects();
    }
  }
  collectEffects() {
    for (const event of this.bin.drainEvents()) {
      if (event.type === "return") {
        if (event.won) {
          this.money = u32(this.money + 1000);
          this.rareCoinTaken = true;
        }
        this.scene = "office";
      }
      this.effects.push(event);
    }
  }
  drainEffects() {
    return this.effects.splice(0);
  }
  fail(error) {
    this.diagnostic = error instanceof Error ? error.message : String(error);
  }
  snapshot() {
    return {
      scene: this.scene,
      difficulty: this.difficulty,
      money: this.money,
      rareCoinTaken: this.rareCoinTaken,
      seed: this.seed,
      tick: this.tick,
      bin: this.bin?.snapshot() ?? null,
      campaign: this.campaign?.snapshot() ?? null,
      departure: this.departure?.snapshot() ?? null,
      diagnostic: this.diagnostic,
    };
  }
}
