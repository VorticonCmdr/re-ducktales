import { MoneyBin } from "./money-bin.js";
import { u32, u16 } from "./integer.js";
export const DRIVER_HZ = 1193182 / (1365 * 12);
export const RETRACE_HZ = 70.086;

export class Game {
  constructor({ biosSeed = 0 } = {}) {
    this.scene = "title";
    this.difficulty = 0;
    this.money = 0;
    this.rareCoinTaken = false;
    this.seed = u16(biosSeed);
    this.tick = 0;
    this.bin = null;
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
      this.money = 0;
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
    if (this.scene === "office") {
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
        throw Error(
          `Untranslated route: ${event.direction === "left" ? "control center" : "stock market"}.`,
        );
      if (event.type === "unsupported")
        throw Error(
          `Untranslated route: ${event.route}. Current playable route: office → money bin → office.`,
        );
      return;
    }
    if (this.scene === "money-bin" && event.type === "fire")
      this.bin.enqueueFire();
  }
  advanceTick() {
    this.tick++;
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
      diagnostic: this.diagnostic,
    };
  }
}
