import { Departure } from "./departure.js";
import { Campaign, OFFICE, travelDays } from "./campaign.js";
import { MoneyBin } from "./money-bin.js";
import { Flight } from "./flight.js";
import { Cave } from "./cave.js";
import { Mountain } from "./mountain.js";
import { Jungle } from "./jungle.js";
import { Photography } from "./photography.js";
import { ExpeditionBriefing } from "./expedition.js";
import { CampaignVisitNotice } from "./campaign-visit.js";
import { nextRandom, u8, u32, u16 } from "./integer.js";
import { FlightMemory } from "./flight-physics.js";
import { initializeInvestments, advanceInvestmentDays } from "./investments.js";
import { InvestmentScreen } from "./investment-screen.js";
export const DRIVER_HZ = 1193182 / (1365 * 12);
export const RETRACE_HZ = 70.086;

export class Game {
  constructor({
    biosSeed = 0,
    locations = null,
    flightResources = null,
    loot = null,
    expeditionResources = null,
    audioEnabled = false,
    investmentResources = null,
  } = {}) {
    this.expeditionResources = expeditionResources;
    this.audioEnabled = audioEnabled;
    this.audioScope = 0;
    this.visitNotice = null;
    this.cave = null;
    this.mountain = null;
    this.jungle = null;
    this.photography = null;
    this.briefing = null;
    this.loot = loot;
    this.flightResources = flightResources;
    this.flight = null;
    this.flightMemory = null;
    this.controls = { fire: false, direction: null };
    this.locations = locations;
    this.investmentResources = investmentResources;
    this.investments = null;
    this.marketMemory = null;
    const campaignSeed = this.initializeMarket(biosSeed);
    this.campaign = locations ? new Campaign(locations, campaignSeed) : null;
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
  initializeMarket(seed) {
    if (!this.investmentResources) return seed; // Explicit component-only callers.
    const bytes = new Uint8Array(65536);
    bytes.set(this.investmentResources.image.subarray(0x120e0));
    this.marketMemory = new FlightMemory(bytes);
    this.marketMemory.i(0x2229, seed);
    return initializeInvestments(this.marketMemory, this.investmentResources)
      .seed;
  }
  settleMarket() {
    if (
      !this.marketMemory ||
      !this.campaign ||
      !["office", "map"].includes(this.scene)
    )
      return;
    const m = this.marketMemory,
      c = this.campaign;
    m.i(0x2229, this.seed);
    m.b(0x8990, this.difficulty);
    m.b(0x4e0e, c.day);
    m.view.setUint32(0x8cc0, this.money, true);
    m.view.setUint32(0x5ae2, c.banked, true);
    m.view.setUint32(0x4e0a, c.rival.money, true);
    m.view.setUint32(0x54f2, c.rival.banked ?? 0, true);
    this.seed = c.seed = advanceInvestmentDays(m).seed;
  }
  input(event) {
    this.handleInput(event);
    this.settleMarket();
  }
  handleInput(event) {
    if (this.diagnostic) throw Error(this.diagnostic);
    if (event.type === "audio-enabled") {
      if (typeof event.enabled !== "boolean")
        throw Error("Invalid audio setting");
      this.audioEnabled = event.enabled;
      this.cave?.setAudioEnabled(event.enabled);
      this.mountain?.setAudioEnabled(event.enabled);
      this.jungle?.setAudioEnabled(event.enabled);
      this.photography?.setAudioEnabled(event.enabled);
      this.visitNotice?.setAudioEnabled(event.enabled);
      return;
    }
    if (event.type === "audio-status") {
      this.cave?.setAudioStatus(event.token, event.busy);
      this.visitNotice?.setAudioStatus(event.token, event.busy);
      return;
    }
    if (event.type === "restart") {
      this.scene = "title";
      this.difficulty = 0;
      this.tick = 0;
      this.bin = null;
      this.departure = null;
      this.flight = null;
      this.flightMemory = null;
      this.cave = null;
      this.mountain = null;
      this.jungle = null;
      this.photography = null;
      this.investments = null;
      this.visitNotice = null;
      this.briefing = null;
      this.controls = { fire: false, direction: null };
      this.money = 0;
      this.campaign = this.locations
        ? new Campaign(this.locations, this.initializeMarket(this.biosSeed))
        : null;
      this.seed = this.campaign?.seed ?? this.biosSeed;
      this.rareCoinTaken = false;
      this.effects.push({ type: "stopAudio" });
      return;
    }
    if (event.type === "controls") {
      this.controls = { fire: event.fire, direction: event.direction };
      this.flight?.setControls(this.controls);
      this.cave?.setControls(this.controls);
      this.mountain?.setControls(this.controls);
      this.jungle?.setControls(this.controls);
      this.photography?.setControls(this.controls);
      return;
    }
    if (this.scene === "investments") {
      this.investments.input(event);
      this.collectInvestments();
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
      if (
        (event.type === "fire" && event.direction === "left") ||
        event.type === "investments"
      ) {
        if (!this.marketMemory) throw Error("Investment resources not loaded");
        this.settleMarket();
        this.investments = new InvestmentScreen(
          this.marketMemory,
          this.investmentResources,
        );
        this.scene = "investments";
        return;
      }
      if (event.type === "unsupported")
        throw Error(
          `Untranslated route: ${event.route}. Supported routes: money bin and campaign bank travel.`,
        );
      return;
    }
    if (this.scene === "departure") {
      if (event.type === "fire") {
        if (!this.flightResources) throw Error("Flight resources not loaded");
        this.flight = new Flight(
          {
            ...this.flightResources,
            ...this.departure.flightRequest,
            difficulty: this.difficulty,
            seed: this.seed,
            day: this.campaign.day,
            money: this.money,
          },
          this.flightMemory,
        );
        this.flight.setControls(this.controls);
        this.scene = "flight";
      }
      return;
    }
    if (this.scene === "rival-claim") {
      if (event.type === "fire") this.claim.skipRequested = true;
      return;
    }
    if (this.scene === "crash-repairs") {
      if (event.type === "fire") this.repairs.skipRequested = true;
      return;
    }
    if (this.scene === "expedition-briefing") {
      if (event.type === "fire") this.briefing.skipRequested = true;
      return;
    }
    if (this.scene === "expedition-result") {
      if (event.type === "fire") this.expeditionResult.skipRequested = true;
      return;
    }
    if (this.scene === "visit-notice") {
      if (event.type === "fire") this.visitNotice.skipRequested = true;
      return;
    }
    if (this.scene === "money-bin" && event.type === "fire")
      this.bin.enqueueFire();
  }
  travel(target) {
    const c = this.campaign;
    const days = travelDays(c.locations, c.location, target);
    if (target !== OFFICE && target !== 0) {
      const destination = c.locations[target];
      this.rareCoinTaken = false;
      c.direction = null;
      if (destination.playerCollected || destination.rivalCollected) {
        this.visitNotice = new CampaignVisitNotice({
          reason: destination.playerCollected ? "player" : "rival",
          target,
          audioEnabled: this.audioEnabled,
          token: `visit:${++this.audioScope}`,
        });
        this.scene = "visit-notice";
        this.effects.push({ type: "stopAudio" });
        if (this.visitNotice.reason === "rival")
          this.effects.push({
            type: "sound",
            id: 0x6e,
            token: this.visitNotice.token,
          });
        return;
      }
      if (days === 0) {
        this.flight = null;
        this.departure = null;
        this.effects.push({ type: "stopAudio" });
        this.arrive(target, destination.flags);
        return;
      }
      const departure = new Departure({
        from: c.location,
        target,
        days,
        flags: c.locations[target].flags,
        difficulty: this.difficulty,
        seed: this.seed,
        rivalCollected: !!c.locations[target].rivalCollected,
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
    this.advanceDriverTick();
    this.settleMarket();
  }
  advanceDriverTick() {
    this.tick++;
    if (this.scene === "investments") {
      this.investments.advanceTick(this.controls);
      this.collectInvestments();
      return;
    }
    if (this.scene === "photography") {
      this.photography.advanceTick();
      this.collectPhotography();
      return;
    }
    if (this.scene === "visit-notice") {
      if (this.visitNotice.advanceTick()) {
        const fireClick =
          this.audioEnabled &&
          this.visitNotice.skipRequested &&
          this.visitNotice.phase === "dialogue";
        this.visitNotice = null;
        this.campaign.openMap();
        this.scene = "map";
        this.effects.push({ type: "stopAudio" });
        if (fireClick) this.effects.push({ type: "sound", id: 0x24 });
      }
      return;
    }
    if (this.scene === "expedition-result") {
      if (this.advanceDialogue(this.expeditionResult))
        this.finishExpeditionResult();
      return;
    }
    if (
      this.scene === "expedition-briefing" &&
      this.advanceDialogue(this.briefing)
    ) {
      this.startExpedition();
      return;
    }
    if (this.scene === "cave") {
      this.cave.advanceTick();
      this.collectCave();
      return;
    }
    if (this.scene === "mountain") {
      this.mountain.advanceTick();
      this.collectMountain();
      return;
    }
    if (this.scene === "jungle") {
      this.jungle.advanceTick();
      this.collectActionExpedition(this.jungle);
      return;
    }
    if (this.scene === "flight") {
      this.flight.advanceTick();
      this.collectFlight();
      return;
    }
    if (this.scene === "rival-claim" && this.advanceDialogue(this.claim)) {
      this.finishRivalClaim();
      return;
    }
    if (this.scene === "crash-repairs" && this.advanceDialogue(this.repairs)) {
      this.finishRepairs();
      return;
    }
    if (this.scene === "map") this.campaign.advanceTick();
    if (this.scene !== "money-bin") return;
    this.bin.advanceTick();
    this.collectEffects();
  }
  advanceRetrace() {
    if (this.scene === "photography") {
      this.photography.advanceRetrace();
      this.collectPhotography();
      return;
    }
    if (this.scene === "jungle") {
      this.jungle.advanceRetrace();
      this.collectActionExpedition(this.jungle);
      return;
    }
    if (this.scene === "mountain") {
      this.mountain.advanceRetrace();
      this.collectMountain();
      return;
    }
    if (this.scene === "cave") {
      this.cave.advanceRetrace();
      this.collectCave();
      return;
    }
    if (this.scene === "flight") {
      this.flight.advanceRetrace();
      this.collectFlight();
      return;
    }
    if (this.scene === "money-bin") {
      this.bin.advanceRetrace();
      this.collectEffects();
    }
  }
  collectFlight() {
    this.effects.push(...this.flight.drainEvents());
    if (!this.flight.outcome) return;
    const result = this.flight.outcome,
      c = this.campaign;
    this.flightMemory = this.flight.memory;
    this.money = result.money;
    this.seed = c.seed = result.seed;
    c.day = result.day;
    if (result.code === 0 && this.departure.racing) {
      // Main 0855..085e -> 126b:0008(1): forced rival claim, including
      // all three RNG draws even when the ordinary parity test is bypassed.
      const rival = c.rival;
      rival.day = u8(
        rival.day +
          travelDays(c.locations, this.departure.from, this.departure.target),
      );
      this.seed = nextRandom(this.seed);
      const roll = this.seed % 100;
      if (roll < 25) rival.day = u8(rival.day - 1);
      else if (roll < 50) rival.day = u8(rival.day + 1);
      this.seed = nextRandom(this.seed);
      const destination = c.locations[this.departure.target];
      destination.rivalCollected = true;
      // LOC's fourth number is a one-based LOOT resource ID, not its value.
      const treasure = this.loot?.[destination.treasure - 1];
      if (!treasure)
        throw Error("Missing original treasure record for this destination.");
      rival.money = u32(rival.money + treasure.value);
      this.seed = nextRandom(this.seed);
      c.seed = this.seed;
      rival.location = this.departure.target;
      this.claim = {
        variant: this.seed & 1,
        remaining: 40 * 7,
        skipRequested: false,
      };
      this.scene = "rival-claim";
      return;
    }
    if (result.code === 0) {
      c.day = u8(c.day + 2);
      this.repairs = {
        phase: "repair",
        remaining: 60 * 7,
        loss: 0,
        skipRequested: false,
      };
      this.scene = "crash-repairs";
      return;
    }
    this.arrive();
  }
  advanceDialogue(wait) {
    wait.remaining--;
    return (
      wait.remaining === 0 || (wait.remaining % 7 === 0 && wait.skipRequested)
    );
  }
  collectCave() {
    this.effects.push(...this.cave.drainEvents());
    this.money = this.cave.memory.view.getUint32(0x8cc0, true);
    this.seed = this.campaign.seed = u16(this.cave.memory.i(0x2229));
    if (!this.cave.outcome) return;
    this.flightMemory = this.cave.memory;
    if (this.cave.outcome.code === 0) {
      // Failure portrait is inside the cave call; the caller increments the day later.
      this.expeditionResult = {
        phase: "failure",
        remaining: 20 * 7,
        skipRequested: false,
      };
    } else {
      this.campaign.day = u8(this.campaign.day + 1);
      if (this.finishScoredExpedition(this.cave.memory)) return;
      const id = this.campaign.locations[this.campaign.location].treasure;
      const treasure = this.loot?.[id - 1];
      if (!treasure) throw Error("Missing original expedition reward");
      this.money = u32(this.money + treasure.value);
      this.expeditionResult = {
        phase: "award",
        value: treasure.value,
        remaining: 40 * 7,
        skipRequested: false,
      };
      this.effects.push({ type: "sound", id: 0x49 });
    }
    this.scene = "expedition-result";
  }
  collectMountain() {
    this.collectActionExpedition(this.mountain);
  }
  collectPhotography() {
    const p = this.photography,
      c = this.campaign;
    this.effects.push(...p.drainEvents());
    this.money = p.memory.view.getUint32(0x8cc0, true);
    this.seed = c.seed = u16(p.memory.i(0x2229));
    if (!p.outcome) return;
    this.flightMemory = p.memory;
    // Photography increments its own day before returning. Main04e7 then
    // increments it again. A nonzero photo score bypasses the loot award.
    c.day = u8(p.outcome.day + 1);
    p.memory.b(0x4e0e, c.day);
    if (p.outcome.code) {
      if (!p.outcome.score)
        throw Error("Unsupported photography success without score");
      if (!this.finishScoredExpedition(p.memory))
        throw Error("Photography score disappeared before campaign return");
    } else {
      if (c.day > 30)
        throw Error("Untranslated campaign ending after photography.");
      c.openMap();
      this.scene = "map";
      this.effects.push({ type: "stopAudio" });
    }
  }
  finishScoredExpedition(memory) {
    // Resident04f2 tests the shared DWORD after any successful expedition.
    // A failed ordinary-only photography visit leaves it set,so a later
    // success also takes this branch. No other expedition clears it on entry.
    if (!memory.view.getUint32(0x97a8, true)) return false;
    memory.view.setUint32(0x97a8, 0, true);
    this.expeditionResult = { phase: "award", value: 0 };
    this.scene = "expedition-result";
    this.finishExpeditionResult();
    return true;
  }
  collectActionExpedition(expedition) {
    this.effects.push(...expedition.drainEvents());
    this.money = expedition.memory.view.getUint32(0x8cc0, true);
    this.seed = this.campaign.seed = u16(expedition.memory.i(0x2229));
    if (!expedition.outcome) return;
    this.flightMemory = expedition.memory;
    // Action expeditions return directly on failure; Cave's failure portrait
    // is not part of these routines. Both callers then spend one day.
    if (expedition.outcome.code === 0) {
      this.campaign.day = u8(this.campaign.day + 1);
      if (this.campaign.day > 30)
        throw Error("Untranslated campaign ending after expedition.");
      this.campaign.openMap();
      this.scene = "map";
      return;
    }
    this.campaign.day = u8(this.campaign.day + 1);
    if (this.finishScoredExpedition(expedition.memory)) return;
    const id = this.campaign.locations[this.campaign.location].treasure;
    const treasure = this.loot?.[id - 1];
    if (!treasure) throw Error("Missing original expedition reward");
    this.money = u32(this.money + treasure.value);
    this.expeditionResult = {
      phase: "award",
      value: treasure.value,
      remaining: 40 * 7,
      skipRequested: false,
    };
    this.effects.push({ type: "sound", id: 0x49 });
    this.scene = "expedition-result";
  }
  finishExpeditionResult() {
    const c = this.campaign,
      result = this.expeditionResult;
    if (result.phase === "failure") c.day = u8(c.day + 1);
    if (result.phase === "award") {
      c.locations[c.location].playerCollected = true;
      if (c.location === c.atomicLocation) {
        c.atomicAvailable = true;
        this.expeditionResult = {
          phase: "atomic",
          remaining: 100 * 7,
          skipRequested: false,
        };
        this.effects.push({ type: "sound", id: 0x54 });
        return;
      }
    }
    if (c.day > 30)
      throw Error("Untranslated campaign ending after expedition.");
    c.openMap();
    this.scene = "map";
    this.effects.push({ type: "stopAudio" });
  }
  finishRepairs() {
    if (this.repairs.phase === "repair" && (this.money | 0) > 0) {
      this.seed = this.campaign.seed = nextRandom(this.seed);
      const roll = this.seed % 10;
      const shift = roll < 2 ? null : roll < 5 ? 3 : roll < 8 ? 2 : 1;
      // Main 0967..0990 stores only AX from the signed 32-bit shift.
      const loss = shift === null ? 0 : u16((this.money | 0) >> shift);
      this.money = u32(this.money - loss);
      this.repairs = {
        phase: "wreckage",
        remaining: 100 * 7,
        loss,
        skipRequested: false,
      };
      return;
    }
    this.arrive();
  }
  arrive(target = this.departure?.target, flags = this.departure?.flags) {
    if (!Number.isInteger(target) || target < 1 || target > 34)
      throw Error("Missing expedition destination");
    this.campaign.location = target;
    if (this.campaign.day > 30)
      throw Error("Untranslated campaign ending after flight.");
    if (!this.expeditionResources)
      throw Error(
        `Untranslated expedition arrival: ${this.campaign.locations[target].name}.`,
      );
    this.briefing = new ExpeditionBriefing({
      flags,
      seed: this.seed,
      clues: this.expeditionResources.clues,
    });
    this.seed = this.campaign.seed = this.briefing.seed;
    this.scene = "expedition-briefing";
  }
  startExpedition() {
    if (this.briefing.activity === "photography") {
      this.photography = new Photography(
        {
          ...this.expeditionResources,
          entries: this.expeditionResources.photographyEntries,
          variant: this.briefing.variant,
          difficulty: this.difficulty,
          seed: this.seed,
          money: this.money,
          day: this.campaign.day,
          location: this.campaign.location,
          audioEnabled: this.audioEnabled,
        },
        this.flightMemory,
      );
      this.photography.setControls(this.controls);
      this.scene = "photography";
      return;
    }
    if (this.briefing.activity === "jungle") {
      this.jungle = new Jungle(
        {
          ...this.expeditionResources,
          entries: this.expeditionResources.jungleEntries,
          variant: this.briefing.variant,
          difficulty: this.difficulty,
          seed: this.seed,
          money: this.money,
          day: this.campaign.day,
          audioEnabled: this.audioEnabled,
        },
        this.flightMemory,
      );
      this.jungle.setControls(this.controls);
      this.scene = "jungle";
      return;
    }
    if (this.briefing.activity === "mountain") {
      this.mountain = new Mountain(
        {
          ...this.expeditionResources,
          entries: this.expeditionResources.mountainEntries,
          variant: this.briefing.variant,
          difficulty: this.difficulty,
          seed: this.seed,
          money: this.money,
          day: this.campaign.day,
          audioEnabled: this.audioEnabled,
        },
        this.flightMemory,
      );
      this.mountain.setControls(this.controls);
      this.scene = "mountain";
      return;
    }
    if (this.briefing.activity !== "cave")
      throw Error(
        `Untranslated ${this.briefing.activity} expedition gameplay.`,
      );
    this.cave = new Cave(
      {
        ...this.expeditionResources,
        variant: this.briefing.variant,
        difficulty: this.difficulty,
        seed: this.seed,
        money: this.money,
        audioEnabled: this.audioEnabled,
        audioScope: ++this.audioScope,
      },
      this.flightMemory,
    );
    this.cave.setControls(this.controls);
    this.scene = "cave";
  }
  finishRivalClaim() {
    this.campaign.location = this.departure.target;
    this.campaign.openMap();
    this.scene = "map";
    this.effects.push({ type: "stopAudio" });
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
  collectInvestments() {
    this.money = this.marketMemory.view.getUint32(0x8cc0, true);
    if (this.investments.complete) this.scene = "office";
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
      flight: this.flight?.snapshot() ?? null,
      cave: this.cave?.snapshot() ?? null,
      mountain: this.mountain?.snapshot() ?? null,
      jungle: this.jungle?.snapshot() ?? null,
      photography: this.photography?.snapshot() ?? null,
      investments: this.investments?.snapshot() ?? null,
      briefing: this.briefing?.snapshot() ?? null,
      repairs: this.scene === "crash-repairs" ? { ...this.repairs } : null,
      expeditionResult:
        this.scene === "expedition-result"
          ? { ...this.expeditionResult }
          : null,
      visitNotice:
        this.scene === "visit-notice" ? this.visitNotice.snapshot() : null,
      diagnostic: this.diagnostic,
    };
  }
}
