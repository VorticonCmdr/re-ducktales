import { DepartureScene } from "./departure-scene.js";
import { DestinationLoop } from "./destination-loop.js";
import { Opening } from "./opening.js";
import { OfficeMoneyBin } from "./office.js";
import { OfficeControlCenter } from "./office-control-center.js";
import { OfficeInvestmentDeparture } from "./office-investments.js";
import { OfficeMenu } from "./office-menu.js";
import { SecurityScreen } from "./security-screen.js";
import { DifficultyMenu } from "./difficulty-menu.js";
import { Departure } from "./departure.js";
import { Campaign, OFFICE, travelDays } from "./campaign.js";
import { MoneyBin } from "./money-bin.js";
import { Flight } from "./flight.js";
import { Cave } from "./cave.js";
import { Mountain } from "./mountain.js";
import { Jungle } from "./jungle.js";
import { Photography } from "./photography.js";
import { ResultInputWait } from "./result-input-wait.js";
import { AwardPresentation } from "./award-presentation.js";
import { ExpeditionBriefing } from "./expedition.js";
import { CampaignVisitNotice } from "./campaign-visit.js";
import { nextRandom, u8, u32, u16 } from "./integer.js";
import { FlightMemory } from "./flight-physics.js";
import { initializeInvestments, advanceInvestmentDays } from "./investments.js";
import { InvestmentScreen } from "./investment-screen.js";
import { CampaignEnding, depositAccounts } from "./ending.js";
import { advanceRival, RivalReport, RIVAL_UNLOCK } from "./rival.js";
import { AtomicTransport } from "./atomic-transport.js";
import { BankScene } from "./bank.js";
import { SystemControls } from "./system-controls.js";
import { OrdinaryKeyboard, isOrdinaryScanCode } from "./ordinary-keyboard.js";
export { DRIVER_HZ, RETRACE_HZ } from "./timing.js";

export class Game {
  constructor({
    biosSeed = 0,
    readBiosSeed = null,
    locations = null,
    flightResources = null,
    loot = null,
    expeditionResources = null,
    audioEnabled = false,
    hasAudioDevice = () => false,
    investmentResources = null,
    bankResources = null,
    openingResources = null,
    departureEntries = null,
    originalSecurity = false,
    expeditionInput = "digital",
    // Component fixtures supply already-decoded read boundaries. Production
    // selects the autonomous physical-key provider explicitly in browser.js.
    destinationInput = "boundary",
  } = {}) {
    if (typeof originalSecurity !== "boolean")
      throw Error("Invalid security setting");
    if (!["digital", "keyboard"].includes(expeditionInput))
      throw Error("Unsupported expedition input provider");
    if (!["boundary", "keyboard"].includes(destinationInput))
      throw Error("Unsupported destination input provider");
    this.destinationInput = destinationInput;
    this.expeditionInput = expeditionInput;
    this.keyboardMode = 1; // Resident0077 initializes ordinary-reader mode1.
    this.expeditionKeyboard = new OrdinaryKeyboard(1);
    this.expeditionKeyReads = 0;
    this.lastExpeditionKeyByte = null;
    this.originalSecurity = originalSecurity;
    this.openingResources = openingResources;
    this.departureEntries =
      departureEntries ??
      openingResources?.entries ??
      expeditionResources?.mainEntries ??
      null;
    this.opening = null;
    this.difficultyMenu = null;
    this.officeDeparture = null;
    this.officeMenu = null;
    this.security = null;
    this.securityPending = true;
    this.expeditionResources = expeditionResources;
    this.bankResources = bankResources;
    this.bank = null;
    this.audioEnabled = audioEnabled;
    if (typeof hasAudioDevice !== "function")
      throw Error("Invalid audio device provider");
    this.hasAudioDevice = hasAudioDevice;
    this.audioScope = 0;
    this.visitNotice = null;
    this.cave = null;
    this.mountain = null;
    this.jungle = null;
    this.photography = null;
    this.briefing = null;
    this.resultWait = null;
    this.resultPresentation = null;
    this.repairs = null;
    this.loot = loot;
    this.flightResources = flightResources;
    this.flight = null;
    this.flightMemory = null;
    this.controls = { fire: false, direction: null };
    this.locations = locations;
    this.investmentResources = investmentResources;
    this.investments = null;
    this.ending = null;
    this.marketMemory = null;
    this.pendingCampaignAction = null;
    this.rivalReport = null;
    this.claim = null;
    this.atomicTransport = null;
    this.systemOverlay = null;
    this.pendingBinSystemKeys = new Map();
    this.pendingFlightSystemKeys = new Map();
    this.pendingCaveSystemKeys = new Map();
    this.pendingMountainSystemKeys = new Map();
    this.pendingJungleSystemKeys = new Map();
    this.pendingPhotographySystemKeys = new Map();
    this.pendingEndingSystemKeys = new Map();
    this.pendingBankSystemKeys = new Map();
    this.pendingOpeningSystemKeys = new Map();
    this.pendingDifficultySystemKeys = new Map();
    this.pendingSecuritySystemKeys = new Map();
    this.pendingOfficeSystemKeys = new Map();
    this.pendingDestinationSystemKeys = new Map();
    this.pendingAtomicSystemKeys = new Map();
    this.pendingBriefingSystemKeys = new Map();
    this.pendingResultSystemKeys = new Map();
    this.pendingRivalSystemKeys = new Map();
    this.pendingInvestmentSystemKeys = new Map();
    this.exiting = false;
    if (readBiosSeed !== null && typeof readBiosSeed !== "function")
      throw Error("Invalid BIOS seed provider");
    this.readBiosSeed = readBiosSeed ?? (() => biosSeed);
    const startupSeed = this.consumeBiosSeed("startup");
    const campaignSeed = this.initializeMarket(startupSeed);
    this.campaign = locations ? new Campaign(locations, campaignSeed) : null;
    this.scene = "title";
    this.difficulty = 0;
    this.difficultyFromEnding = false;
    this.money = 0;
    this.rareCoinTaken = false;
    this.seed = this.campaign?.seed ?? this.biosSeed;
    this.tick = 0;
    this.bin = null;
    this.departure = null;
    this.departureScene = null;
    this.effects = [];
    this.diagnostic = null;
    this.titleMusicRequested = false;
    this.startOpening();
    this.startTitleMusic();
  }
  // The environment owns elapsed time. It excludes explicit scheduler pauses
  // and advances independently of the renderer and the game's driver counter.
  setSimulationClock(clock) {
    if (typeof clock !== "function") throw Error("Invalid simulation clock");
    this.simulationClock = clock;
    this.jungle?.setClock(clock);
    this.cave?.setClock(clock);
    this.mountain?.setClock(clock);
    this.photography?.setClock(clock);
    this.departureScene?.setClock(clock);
    this.resultPresentation?.setClock(clock);
  }
  nextSimulationWake() {
    const component =
      this.scene === "departure"
        ? this.departureScene
        : this.scene === "cave"
          ? this.cave
          : this.scene === "mountain"
            ? this.mountain
            : this.scene === "photography"
              ? this.photography
              : this.scene === "expedition-result"
                ? this.resultPresentation
                : this.scene === "map" && this.destinationInput === "keyboard"
                  ? this.campaign?.destinationWaits
                  : null;
    return !this.systemOverlay &&
      ["graphics", "continuation"].includes(component?.wait?.clock)
      ? component.wait.until
      : null;
  }
  advanceSimulationWake() {
    const component =
      this.scene === "departure"
        ? this.departureScene
        : this.scene === "cave"
          ? this.cave
          : this.scene === "mountain"
            ? this.mountain
            : this.scene === "photography"
              ? this.photography
              : this.scene === "expedition-result"
                ? this.resultPresentation
                : this.scene === "map" && this.destinationInput === "keyboard"
                  ? this.campaign?.destinationWaits
                  : null;
    if (
      this.systemOverlay ||
      !["graphics", "continuation"].includes(component?.wait?.clock)
    )
      throw Error("Unexpected simulation work boundary");
    component.advanceGraphics();
    if (this.scene === "departure") this.collectDeparture();
    else if (this.scene === "cave") this.collectCave();
    else if (this.scene === "mountain") this.collectMountain();
    else if (this.scene === "photography") this.collectPhotography();
    else if (this.scene === "expedition-result")
      this.collectAwardPresentation();
    else this.collectDestination();
  }
  get usesExpeditionKeyboard() {
    return (
      this.expeditionInput === "keyboard" &&
      [
        "departure",
        "flight",
        "cave",
        "mountain",
        "jungle",
        "photography",
      ].includes(this.scene)
    );
  }
  syncExpeditionKeyboard() {
    if (!this.usesExpeditionKeyboard) return;
    const memory = this[this.scene]?.memory;
    if (!memory) return;
    memory.b(0x3c1, this.expeditionKeyboard.mode);
    const flags = this.expeditionKeyboard.bytes();
    for (let scan = 0; scan < 128; scan++)
      if (isOrdinaryScanCode(scan)) memory.b(0x276c + scan, flags[scan]);
  }
  flushExpeditionKeyboard() {
    this.expeditionKeyboard.flush();
    if (this.usesExpeditionKeyboard)
      this[this.scene]?.memory?.bytes.fill(0, 0x276c, 0x27ec);
    this.syncExpeditionKeyboard();
  }
  readExpeditionKeyboard() {
    if (!this.usesExpeditionKeyboard || this.scene === "departure")
      throw Error("Expedition keyboard read outside its source boundary");
    const byte = this.expeditionKeyboard.poll();
    this.expeditionKeyReads++;
    this.lastExpeditionKeyByte = byte;
    this.syncExpeditionKeyboard();
    return byte;
  }
  beginExpeditionKeyboard(activity) {
    // Flight/Cave/Mountain clear ordinary-reader mode;Photo sets mode1.
    // Jungle makes no assignment and retains the incoming caller mode.
    if (["cave", "mountain"].includes(activity)) this.keyboardMode = 0;
    if (activity === "photography") this.keyboardMode = 1;
    this.expeditionKeyboard = new OrdinaryKeyboard(this.keyboardMode);
    this.expeditionKeyReads = 0;
    this.lastExpeditionKeyByte = null;
  }
  startOpening() {
    this.opening =
      this.scene === "title" && this.openingResources
        ? new Opening({
            ...this.openingResources,
            seed: this.biosSeed,
            audioEnabled: this.audioEnabled,
            pollInput: () =>
              this.pollSystemInput(this.pendingOpeningSystemKeys),
            flushInput: () => this.flushOpeningInput(),
          })
        : null;
    if (this.opening) this.collectOpening();
  }
  consumeBiosSeed(boundary) {
    if (!["startup", "difficulty"].includes(boundary))
      throw Error("Unsupported BIOS seed boundary");
    const value = this.readBiosSeed(boundary);
    if (!Number.isInteger(value) || value < 0 || value > 65535)
      throw Error("Invalid BIOS seed word");
    this.biosSeed = value;
    return value;
  }
  collectOpening() {
    this.effects.push(...this.opening.drainEvents());
    this.seed = this.opening.seed;
    this.titleMusicRequested = this.opening.musicRequested;
    if (this.opening.outcome && this.scene === "title" && !this.exiting) {
      this.startDifficulty();
    }
  }
  startDifficulty() {
    this.scene = "difficulty";
    this.difficulty = 0;
    this.difficultyMenu = this.openingResources
      ? new DifficultyMenu({
          ...this.openingResources,
          audioEnabled: this.audioEnabled,
          readBiosSeed: () => this.consumeBiosSeed("difficulty"),
          pollInput: () =>
            this.pollSystemInput(this.pendingDifficultySystemKeys),
          flushInput: (release) => this.flushDifficultyInput(release),
        })
      : null;
    this.difficultyMenu?.setControls(this.controls);
  }
  flushDifficultyInput(release = false) {
    this.pendingOpeningSystemKeys.clear();
    this.pendingDifficultySystemKeys.clear();
    if (release) {
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    }
  }
  collectDifficulty() {
    const menu = this.difficultyMenu;
    this.difficulty = menu.selection;
    this.effects.push(...menu.drainEvents());
    if (menu.biosSeed !== null) {
      this.seed = menu.biosSeed;
      if (this.campaign) this.campaign.seed = menu.biosSeed;
      this.marketMemory?.i(0x2229, menu.biosSeed);
    }
    if (!menu.outcome) return;
    if (menu.outcome.code !== 0)
      throw Error("Unsupported difficulty return37 outside global quit dialog");
    if (this.difficultyFromEnding && this.audioEnabled)
      this.effects.push({ type: "sound", id: 0 });
    this.difficultyFromEnding = false;
    this.campaign = this.locations
      ? new Campaign(
          this.locations,
          this.initializeMarket(menu.outcome.biosSeed),
        )
      : null;
    this.seed = this.campaign?.seed ?? menu.outcome.biosSeed;
    this.difficultyMenu = null;
    this.securityPending = true;
    this.startOffice();
    this.settleMarket();
  }
  startOffice() {
    this.scene = "office";
    this.officeMenu = this.openingResources
      ? new OfficeMenu({
          ...this.openingResources,
          audioEnabled: this.audioEnabled,
          pollInput: () => this.pollSystemInput(this.pendingOfficeSystemKeys),
          flushInput: (release) => {
            if (release) {
              this.handleInput({
                type: "controls",
                fire: false,
                direction: null,
              });
              this.effects.push({ type: "flushControls" });
            }
          },
        })
      : null;
    this.officeMenu?.setControls(this.controls);
    if (this.officeMenu) this.collectOfficeMenu();
  }
  collectOfficeMenu() {
    const menu = this.officeMenu;
    this.effects.push(...menu.drainEvents());
    if (!menu.outcome) return;
    const action = menu.outcome.action;
    this.officeMenu = null;
    if (action === "money-bin") this.startOfficeMoneyBin();
    else if (action === "map") this.startOfficeMap();
    else if (action === "investments") this.startOfficeInvestments();
    else throw Error(`Unsupported office outcome ${action}`);
  }
  startOfficeMoneyBin() {
    if (!this.openingResources) {
      // Component-only fixtures without original presentation resources.
      this.completeCampaignAction({ type: "money-bin" });
      return;
    }
    if (this.scene !== "office") throw Error("Money-bin door outside office");
    if (this.audioEnabled) this.effects.push({ type: "sound", id: 0 });
    this.officeDeparture = new OfficeMoneyBin({
      audioEnabled: this.audioEnabled,
    });
    this.scene = "office-departure";
    this.collectOfficeDeparture();
  }
  startOfficeMap() {
    if (!this.openingResources) {
      this.completeCampaignAction({ type: "map" });
      return;
    }
    if (this.scene !== "office") throw Error("Control center outside office");
    if (this.audioEnabled) this.effects.push({ type: "sound", id: 0 });
    this.officeDeparture = new OfficeControlCenter({
      audioEnabled: this.audioEnabled,
    });
    this.scene = "office-departure";
    this.collectOfficeDeparture();
  }
  startOfficeInvestments() {
    if (!this.openingResources) {
      this.completeCampaignAction({ type: "investments" });
      return;
    }
    if (this.scene !== "office")
      throw Error("Investment departure outside office");
    if (this.audioEnabled) this.effects.push({ type: "sound", id: 0 });
    this.officeDeparture = new OfficeInvestmentDeparture({
      audioEnabled: this.audioEnabled,
    });
    this.scene = "office-departure";
    this.collectOfficeDeparture();
  }
  startSecurity() {
    if (!this.securityPending || !this.openingResources) return false;
    // Overlay2:0e59 clears the main campaign's one-shot flag BEFORE the call.
    this.securityPending = false;
    this.security = new SecurityScreen({
      ...this.openingResources,
      ...(this.officeEntryFrame ? { initialFrame: this.officeEntryFrame } : {}),
      seed: this.seed,
      day: this.campaign.day,
      money: this.money,
      audioEnabled: this.audioEnabled,
      originalSecurity: this.originalSecurity,
      pollInput: () => this.pollSystemInput(this.pendingSecuritySystemKeys),
      flushInput: () => this.flushSecurityInput(),
    });
    this.officeEntryFrame = null;
    this.scene = "security";
    this.collectSecurity();
    return true;
  }
  flushSecurityInput() {
    this.pendingSecuritySystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  collectSecurity() {
    const screen = this.security;
    this.effects.push(...screen.drainEvents());
    this.seed = this.campaign.seed = screen.seed;
    if (!screen.outcome) return;
    if (screen.outcome.code === 0) {
      // Restore the AX return test bypassed by Overlay2:0f0f OR BP,BP.
      // The original failure branch terminates through resident198e:013a.
      if (!this.exiting) this.effects.push({ type: "stopAudio" });
      this.exiting = true;
      return;
    }
    if (screen.outcome.code !== 1) throw Error("Unsupported security return");
    this.security = null;
    this.scene = "map";
  }
  collectOfficeDeparture() {
    const departure = this.officeDeparture;
    this.effects.push(...departure.drainEvents());
    if (!departure.outcome) return;
    // Overlay2:06bf calls resident19a5 before returning to the dispatcher.
    // Keys held/queued during the uninterruptible door animation are discarded.
    this.officeDeparture = null;
    this.pendingBinSystemKeys.clear();
    this.pendingOfficeSystemKeys.clear();
    this.pendingDestinationSystemKeys.clear();
    this.pendingAtomicSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
    if (departure.outcome.action === "map")
      this.officeEntryFrame = departure.frame;
    this.completeCampaignAction({ type: departure.outcome.action });
  }
  flushOpeningInput() {
    this.pendingOpeningSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  startTitleMusic() {
    if (this.opening && this.scene === "title") {
      this.opening.setAudioEnabled(this.audioEnabled);
      this.collectOpening();
      return;
    }
    // Original12f5:0a51..0a60 starts request1 once while MAIN.ARC2 is shown.
    // The browser's initially muted provider may activate on its first sound
    // gesture. Later mute/unmute events must not replay an already-started song.
    if (
      this.scene !== "title" ||
      !this.audioEnabled ||
      this.titleMusicRequested
    )
      return;
    this.titleMusicRequested = true;
    this.effects.push({ type: "sound", id: 1 });
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
  settleMarket(force = false) {
    if (
      !this.marketMemory ||
      !this.campaign ||
      (!force && !["office", "map"].includes(this.scene))
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
  }
  // Resident main0187/0f7f: exactly one rival call, then daily market work,
  // before the next root dispatch. Cursor movement and idle clocks never call it.
  completeCampaignAction(action) {
    if (this.pendingCampaignAction)
      throw Error("Campaign continuation already pending");
    const c = this.campaign;
    if (c && c.day > 30 && action.type !== "ending") {
      this.beginEnding();
      return;
    }
    if (c) {
      const result = advanceRival({
        day: c.day,
        difficulty: this.difficulty,
        unlockMask: c.rivalUnlockMask,
        seed: this.seed,
        rival: c.rival,
        locations: c.locations,
        loot: this.loot,
        memory: this.flightMemory ?? this.marketMemory,
      });
      this.seed = c.seed = result.seed;
      if (result.report) {
        c.rival.location = result.from; // Original publishes this after the report.
        this.pendingCampaignAction = { ...action };
        this.rivalReport = new RivalReport({
          ...result.report,
          audioEnabled: this.audioEnabled,
          token: `rival:${++this.audioScope}`,
          queryAudio: !this.audioEnabled && this.hasAudioDevice(),
          pollInput: () => this.pollSystemInput(this.pendingRivalSystemKeys),
          flushInput: () => this.flushRivalInput(),
        });
        this.scene = "rival-report";
        if (this.audioEnabled)
          this.effects.push({
            type: "sound",
            id: 0x6e,
            token: this.rivalReport.token,
          });
        else if (!this.rivalReport.statusKnown)
          this.effects.push({
            type: "audio-query",
            token: this.rivalReport.token,
          });
        this.rivalReport.begin();
        return;
      }
    }
    this.finishCampaignAction(action);
  }
  finishCampaignAction(action) {
    this.settleMarket(true);
    if (action.type === "travel") {
      this.travel(action.target);
      return;
    }
    if (action.type === "map") {
      this.campaign.openMap();
      if (this.startSecurity()) return;
      this.officeEntryFrame = null;
      this.scene = "map";
      return;
    }
    if (action.type === "office") {
      this.startOffice();
      return;
    }
    if (action.type === "money-bin") {
      this.scene = "money-bin";
      this.bin = new MoneyBin({
        coinAvailable: !this.rareCoinTaken,
        pollInput: () => this.pollMoneyBinSystemInput(),
      });
      this.effects.push(...this.bin.drainEvents());
      return;
    }
    if (action.type === "investments") {
      this.investments = new InvestmentScreen(
        this.marketMemory,
        this.investmentResources,
        {
          pollInput: () =>
            this.pollSystemInput(this.pendingInvestmentSystemKeys),
          flushInput: () => this.flushInvestmentInput(),
        },
      );
      this.scene = "investments";
      return;
    }
    if (action.type === "ending") {
      this.showEnding();
      return;
    }
    throw Error(`Unsupported campaign continuation ${action.type}`);
  }
  handleInput(event, fromActivityPoll = false) {
    if (this.diagnostic) throw Error(this.diagnostic);
    if (event.type === "expedition-key") {
      if (!this.usesExpeditionKeyboard)
        throw Error("Physical expedition key outside keyboard provider");
      this.expeditionKeyboard.event(event.scanCode, event.pressed);
      this.syncExpeditionKeyboard();
      return;
    }
    if (event.type === "flush-expedition-keys") {
      this.flushExpeditionKeyboard();
      return;
    }
    if (event.type === "original-security") {
      if (typeof event.enabled !== "boolean")
        throw Error("Invalid security setting");
      this.originalSecurity = event.enabled;
      if (this.security && !this.security.outcome)
        this.security.originalSecurity = event.enabled;
      return;
    }
    if (
      this.security?.outcome?.code === 0 &&
      !["restart", "audio-enabled", "audio-status"].includes(event.type)
    )
      return;
    if (
      !fromActivityPoll &&
      !this.systemOverlay &&
      ([
        "money-bin",
        "office-departure",
        "security",
        ...(this.officeMenu ? ["office"] : []),
        ...(this.difficultyMenu ? ["difficulty"] : []),
        "flight",
        "departure",
        "cave",
        "mountain",
        "jungle",
        "photography",
        "atomic-transport",
        "expedition-briefing",
        "rival-report",
        "rival-claim",
        "visit-notice",
        ...(this.investments?.phase === "broker" ? ["investments"] : []),
        ...(this.resultWait || this.resultPresentation
          ? ["expedition-result", "crash-repairs"]
          : []),
        "ending",
        "bank",
        ...(this.scene === "map" &&
        this.campaign?.info &&
        this.destinationInput === "keyboard"
          ? ["map"]
          : []),
      ].includes(this.scene) ||
        (this.scene === "title" && this.opening && !this.opening.outcome)) &&
      !(this.scene === "ending" && this.ending.phase === "closed") &&
      ["pause", "quit", "toggle-sound"].includes(event.type)
    ) {
      // IRQ9 retains make/release flags until19c5 consumes them. No input
      // reader runs during the intro, dive or explicit animation waits.
      const keys =
        this.scene === "title"
          ? this.pendingOpeningSystemKeys
          : this.scene === "security"
            ? this.pendingSecuritySystemKeys
            : this.scene === "office"
              ? this.pendingOfficeSystemKeys
              : this.scene === "difficulty"
                ? this.pendingDifficultySystemKeys
                : ["flight", "departure"].includes(this.scene)
                  ? this.pendingFlightSystemKeys
                  : this.scene === "cave"
                    ? this.pendingCaveSystemKeys
                    : this.scene === "mountain"
                      ? this.pendingMountainSystemKeys
                      : this.scene === "jungle"
                        ? this.pendingJungleSystemKeys
                        : this.scene === "photography"
                          ? this.pendingPhotographySystemKeys
                          : [
                                "rival-report",
                                "rival-claim",
                                "visit-notice",
                              ].includes(this.scene)
                            ? this.pendingRivalSystemKeys
                            : this.scene === "investments"
                              ? this.pendingInvestmentSystemKeys
                              : ["expedition-result", "crash-repairs"].includes(
                                    this.scene,
                                  )
                                ? this.pendingResultSystemKeys
                                : this.scene === "expedition-briefing"
                                  ? this.pendingBriefingSystemKeys
                                  : this.scene === "atomic-transport"
                                    ? this.pendingAtomicSystemKeys
                                    : this.scene === "ending"
                                      ? this.pendingEndingSystemKeys
                                      : this.scene === "bank"
                                        ? this.pendingBankSystemKeys
                                        : this.scene === "map"
                                          ? this.pendingDestinationSystemKeys
                                          : this.pendingBinSystemKeys;
      keys.set(
        event.scanCode ??
          { quit: 0x10, pause: 0x19, "toggle-sound": 0x1f }[event.type],
        event.type,
      );
      return;
    }
    if (event.type === "toggle-sound") {
      // Pause's35/7-tick waits do not read input; their final flush drops S.
      if (this.systemOverlay && this.systemOverlay.phase !== "waiting") return;
      //1124:019a:the off-click is requested before03be is cleared. Preserve
      // this native call batch independently of the final enabled flag.
      this.effects.push({
        type: "sound-batch",
        arguments: this.audioEnabled ? [0, 0x24] : [0],
      });
      this.handleInput({ type: "audio-enabled", enabled: !this.audioEnabled });
      return;
    }
    if (event.type === "audio-enabled") {
      if (typeof event.enabled !== "boolean")
        throw Error("Invalid audio setting");
      this.audioEnabled = event.enabled;
      this.opening?.setAudioEnabled(event.enabled);
      this.difficultyMenu?.setAudioEnabled(event.enabled);
      this.officeDeparture?.setAudioEnabled(event.enabled);
      this.officeMenu?.setAudioEnabled(event.enabled);
      this.security?.setAudioEnabled(event.enabled);
      this.cave?.setAudioEnabled(event.enabled);
      this.mountain?.setAudioEnabled(event.enabled);
      this.jungle?.setAudioEnabled(event.enabled);
      this.photography?.setAudioEnabled(event.enabled);
      this.visitNotice?.setAudioEnabled(event.enabled);
      this.rivalReport?.setAudioEnabled(event.enabled);
      this.claim?.setAudioEnabled(event.enabled);
      this.resumeRivalAudio();
      this.atomicTransport?.setAudioEnabled(event.enabled);
      this.ending?.setAudioEnabled(event.enabled);
      this.bank?.setAudioEnabled(event.enabled);
      this.startTitleMusic();
      return;
    }
    if (event.type === "audio-status") {
      this.cave?.setAudioStatus(event.token, event.busy);
      if (
        this.scene === "cave" &&
        !this.systemOverlay &&
        this.cave.wait?.clock === "audio" &&
        this.cave.audioBusy === false
      ) {
        this.cave.resumeAudioStatus();
        this.collectCave();
      }
      this.visitNotice?.setAudioStatus(event.token, event.busy);
      this.rivalReport?.setAudioStatus(event.token, event.busy);
      this.claim?.setAudioStatus(event.token, event.busy);
      this.resumeRivalAudio();
      this.resumeVisitAudio();
      this.atomicTransport?.setAudioStatus(event.token, event.busy);
      if (
        this.scene === "atomic-transport" &&
        !this.systemOverlay &&
        this.atomicTransport.phase === "sound" &&
        this.atomicTransport.statusKnown &&
        this.atomicTransport.busy === false
      ) {
        this.atomicTransport.resumeAudioStatus();
        this.collectAtomicTransport();
      }
      return;
    }
    if (event.type === "restart") {
      if (event.skipTitle !== true) this.consumeBiosSeed("startup");
      this.scene = event.skipTitle === true ? "difficulty" : "title";
      this.opening = null;
      this.difficultyMenu = null;
      this.officeDeparture = null;
      this.officeMenu = null;
      this.security = null;
      this.officeEntryFrame = null;
      this.securityPending = true;
      this.difficulty = 0;
      this.difficultyFromEnding = event.skipTitle === true;
      this.tick = 0;
      this.bin = null;
      this.departure = null;
      this.departureScene = null;
      this.flight = null;
      this.flightMemory = null;
      this.cave = null;
      this.mountain = null;
      this.jungle = null;
      this.photography = null;
      this.investments = null;
      this.ending = null;
      this.visitNotice = null;
      this.rivalReport = null;
      this.claim = null;
      this.atomicTransport = null;
      this.systemOverlay = null;
      this.pendingBinSystemKeys.clear();
      this.pendingFlightSystemKeys.clear();
      this.pendingCaveSystemKeys.clear();
      this.pendingMountainSystemKeys.clear();
      this.pendingJungleSystemKeys.clear();
      this.pendingPhotographySystemKeys.clear();
      this.pendingEndingSystemKeys.clear();
      this.pendingBankSystemKeys.clear();
      this.pendingOpeningSystemKeys.clear();
      this.pendingDifficultySystemKeys.clear();
      this.pendingSecuritySystemKeys.clear();
      this.pendingOfficeSystemKeys.clear();
      this.pendingDestinationSystemKeys.clear();
      this.pendingAtomicSystemKeys.clear();
      this.pendingBriefingSystemKeys.clear();
      this.pendingResultSystemKeys.clear();
      this.pendingRivalSystemKeys.clear();
      this.pendingInvestmentSystemKeys.clear();
      this.resultWait = null;
      this.resultPresentation = null;
      this.repairs = null;
      this.bank = null;
      this.exiting = false;
      this.pendingCampaignAction = null;
      this.briefing = null;
      this.controls = { fire: false, direction: null };
      this.keyboardMode = 1;
      this.flushExpeditionKeyboard();
      this.expeditionKeyReads = 0;
      this.lastExpeditionKeyByte = null;
      this.money = 0;
      this.campaign = this.locations
        ? new Campaign(this.locations, this.initializeMarket(this.biosSeed))
        : null;
      this.seed = this.campaign?.seed ?? this.biosSeed;
      this.rareCoinTaken = false;
      if (event.skipTitle !== true) this.effects.push({ type: "stopAudio" });
      this.titleMusicRequested = false;
      if (event.skipTitle === true) this.startDifficulty();
      this.startOpening();
      this.startTitleMusic();
      return;
    }
    if (this.systemOverlay) {
      if (event.type === "controls")
        this.controls = { fire: event.fire, direction: event.direction };
      const previous = this.systemOverlay.phase;
      this.systemOverlay.input(event);
      if (
        previous === "waiting" &&
        this.systemOverlay.phase === "resuming" &&
        this.audioEnabled
      )
        this.effects.push({ type: "sound", id: 0x24 });
      this.finishSystemOverlay();
      return;
    }
    if (["pause", "quit"].includes(event.type)) {
      if (
        !this.exiting &&
        !(this.scene === "ending" && this.ending.phase === "closed")
      )
        this.systemOverlay = new SystemControls(event.type);
      return;
    }
    if (event.type === "controls") {
      this.controls = { fire: event.fire, direction: event.direction };
      this.opening?.setControls(this.controls);
      this.difficultyMenu?.setControls(this.controls);
      this.officeMenu?.setControls({
        ...this.controls,
        ...(event.officeKeys !== undefined
          ? { officeKeys: event.officeKeys }
          : {}),
      });
      this.security?.setControls(this.controls);
      this.flight?.setControls(this.controls);
      this.cave?.setControls(this.controls);
      this.mountain?.setControls(this.controls);
      this.jungle?.setControls(this.controls);
      this.photography?.setControls(this.controls);
      this.ending?.setControls(this.controls);
      this.bank?.setControls(this.controls);
      return;
    }
    if (this.scene === "office-departure") return;
    if (this.scene === "office" && this.officeMenu) {
      if (
        [
          "fire",
          "up",
          "down",
          "left",
          "right",
          "money-bin",
          "map",
          "investments",
          "ordinary-key",
        ].includes(event.type)
      )
        this.officeMenu.input(event);
      else if (event.type === "unsupported")
        throw Error(`Untranslated office route ${event.route}`);
      return;
    }
    if (this.scene === "security") {
      this.security.input(event);
      return;
    }
    if (this.scene === "investments") {
      this.investments.input(event);
      this.collectInvestments();
      return;
    }
    if (this.scene === "bank") {
      this.bank.input(event);
      this.collectBank();
      return;
    }
    if (this.scene === "ending") {
      this.ending.input(event);
      this.collectEnding();
      return;
    }
    if (this.scene === "title" && this.opening) {
      if (event.type === "fire") this.opening.input(event);
      return;
    }
    if (this.scene === "title" && event.type === "fire") {
      // The interrupted original intro sends reset0 at12f5:0a10..0a17.
      if (this.audioEnabled) this.effects.push({ type: "sound", id: 0 });
      this.startDifficulty();
      return;
    }
    if (this.scene === "difficulty" && this.difficultyMenu) {
      if (["fire", "up", "down"].includes(event.type))
        this.difficultyMenu.input(event);
      return;
    }
    if (this.scene === "difficulty") {
      if (event.type === "up") this.difficulty = (this.difficulty + 2) % 3;
      if (event.type === "down") this.difficulty = (this.difficulty + 1) % 3;
      if (event.type === "fire") {
        if (this.difficultyFromEnding && this.audioEnabled)
          this.effects.push({ type: "sound", id: 0 });
        this.difficultyFromEnding = false;
        if (this.openingResources) {
          // Original12f5:0d75 reseeds from BIOS40:6c before main00dd initializes
          // companies and then location/loot ordering. The browser supplies the
          // same explicit BIOS seed provider value at this second boundary.
          this.campaign = this.locations
            ? new Campaign(this.locations, this.initializeMarket(this.biosSeed))
            : null;
          this.seed = this.campaign?.seed ?? this.biosSeed;
        }
        this.startOffice();
        this.settleMarket();
      }
      return;
    }
    if (this.scene === "map") {
      const c = this.campaign;
      if (event.type === "map-key") {
        c.mapKey(event.scanCode, event.pressed);
        if (c.info && event.pressed) {
          if (this.destinationInput === "boundary") this.readDestinationInput();
          else if (!c.destinationWaits.ready)
            c.destinationWaits.discardedDuringWait++;
        }
        return;
      }
      if (event.type === "destination-read") {
        // Explicit reader boundary for independently scheduled ordinary IRQ
        // groups. Browser makes use the same reader through map-key above.
        if (
          this.destinationInput !== "boundary" ||
          !c.info ||
          !c.destinationWaits?.ready ||
          !Array.isArray(event.keys)
        )
          throw Error("Invalid destination reader boundary");
        for (const key of event.keys) c.mapKey(key.scanCode, key.pressed);
        this.readDestinationInput();
        return;
      }
      if (event.type === "flush-map-keys") {
        c.flushMapKeys();
        return;
      }
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
        if (c.info) {
          if (c.destinationWaits?.confirming) return;
          c.info = false;
          c.destinationWaits = null;
        } else this.completeCampaignAction({ type: "travel", target: OFFICE });
        return;
      }
      if (
        c.info &&
        ["left", "right", "up", "down", "fire"].includes(event.type)
      ) {
        if (!c.destinationWaits) throw Error("Missing destination wait state");
        if (this.destinationInput === "keyboard") {
          const scan = {
            left: 0x4b,
            right: 0x4d,
            up: 0x48,
            down: 0x50,
            fire: 0x39,
          }[event.type];
          c.mapKey(scan, true);
          c.mapKey(scan, false);
          return;
        }
        c.destinationWaits.input(
          { left: 7, right: 3, up: 1, down: 5, fire: 0xc0 }[event.type],
          u32(this.tick),
        );
        this.collectDestination();
        return;
      }
      if (event.type === "fire") {
        this.keyboardMode = 0; // Map pointer Fire bypasses mode restoration.
        if (c.selected === OFFICE) {
          this.completeCampaignAction({ type: "travel", target: OFFICE });
          return;
        }
        if (!c.info) {
          if (c.location !== OFFICE) {
            this.completeCampaignAction({ type: "travel", target: c.selected });
            return;
          }
          c.enterDestination(u32(this.tick));
          if (this.destinationInput === "keyboard") {
            if (typeof this.simulationClock !== "function")
              throw Error("Destination requires an elapsed simulation clock");
            c.destinationWaits = new DestinationLoop(
              u32(this.tick),
              c.atomicAvailable,
              {
                entries: this.expeditionResources?.mainEntries,
                clock: () => this.simulationClock(),
                readInput: () => this.readDestinationByte(),
                pollInput: () =>
                  this.pollSystemInput(this.pendingDestinationSystemKeys),
                flushInput: () => this.flushDestinationInput(),
              },
            );
          }
          return;
        }
      }
      return;
    }
    if (this.scene === "office") {
      if (
        event.type === "map" ||
        (event.type === "fire" && event.direction === "right")
      ) {
        if (!this.campaign) throw Error("Campaign locations not loaded");
        this.startOfficeMap();
        return;
      }
      if (
        event.type === "money-bin" ||
        (event.type === "fire" && event.direction === "up")
      ) {
        this.startOfficeMoneyBin();
        return;
      }
      if (
        (event.type === "fire" && event.direction === "left") ||
        event.type === "investments"
      ) {
        if (!this.marketMemory) throw Error("Investment resources not loaded");
        this.startOfficeInvestments();
        return;
      }
      if (event.type === "unsupported")
        throw Error(
          `Untranslated route: ${event.route}. Supported routes: money bin and campaign bank travel.`,
        );
      return;
    }
    // Main06d9..084d contains no input reader. Departure progresses on its
    // source graphics/retrace boundaries; Fire cannot create an early call.
    if (this.scene === "departure") return;
    if (this.scene === "flight") {
      if (event.type === "fire") this.flight.requestFire();
      return;
    }
    if (this.scene === "rival-claim") {
      if (event.type === "fire") this.claim.skipRequested = true;
      return;
    }
    if (this.scene === "rival-report") {
      if (event.type === "fire") this.rivalReport.skipRequested = true;
      return;
    }
    if (this.scene === "atomic-transport") {
      if (event.type === "fire") this.atomicTransport.fire();
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
          queryAudio: !this.audioEnabled && this.hasAudioDevice(),
          pollInput: () => this.pollSystemInput(this.pendingRivalSystemKeys),
          flushInput: () => this.flushRivalInput(),
        });
        this.scene = "visit-notice";
        if (this.visitNotice.reason === "rival" && this.audioEnabled)
          this.effects.push({
            type: "sound",
            id: 0x6e,
            token: this.visitNotice.token,
          });
        else if (!this.visitNotice.statusKnown)
          this.effects.push({
            type: "audio-query",
            token: this.visitNotice.token,
          });
        this.visitNotice.begin();
        return;
      }
      if (days === 0) {
        this.flight = null;
        this.departure = null;
        this.departureScene = null;
        this.effects.push({ type: "stopAudio" });
        this.arrive(target, destination.flags);
        return;
      }
      if (c.aircraft === "atomic") {
        if (!c.atomicAvailable) throw Error("Atomic transport is not unlocked");
        this.departure = null;
        this.departureScene = null;
        this.flight = null;
        this.atomicTransport = new AtomicTransport({
          from: c.location,
          target,
          day: c.day,
          difficulty: this.difficulty,
          seed: this.seed,
          locations: c.locations,
          audioEnabled: this.audioEnabled,
          token: `atomic:${++this.audioScope}`,
          hasAudioDevice: () => this.hasAudioDevice(),
          pollInput: () => this.pollSystemInput(this.pendingAtomicSystemKeys),
          flushInput: () => this.flushAtomicInput(),
        });
        this.scene = "atomic-transport";
        this.collectAtomicTransport();
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
      // No ordinary reader runs before the portrait helper's flush. Keep its
      // later reveal makes in this same table through the flight handoff.
      this.beginExpeditionKeyboard("departure");
      this.departureScene = new DepartureScene({
        prepared: departure,
        entries: this.departureEntries,
        clock: this.simulationClock,
        onSeed: (seed) => {
          this.seed = c.seed = seed;
        },
        flushInput: () => this.flushDepartureInput(),
        registerRace: ({ from, target }) => {
          c.rival.location = from;
          const memory = this.flightMemory ?? this.marketMemory;
          memory?.b(0x581, from);
          memory?.b(0x358e, target);
        },
      });
      this.rareCoinTaken = false;
      c.direction = null;
      this.scene = "departure";
      this.effects.push({ type: "stopAudio" });
      return;
    }
    c.day += days;
    c.location = target;
    if (target === 0) {
      this.startBank({ toEnding: c.day >= 30 });
    } else {
      if (c.day > 30) {
        this.beginEnding();
        return;
      }
      this.startOffice();
      c.info = false;
    }
  }
  collectDeparture() {
    const scene = this.departureScene;
    if (!scene?.outcome) return;
    this.startDepartureFlight();
  }
  startDepartureFlight() {
    if (this.scene !== "departure" || !this.departureScene?.outcome)
      throw Error("Unexpected departure continuation");
    if (!this.flightResources) throw Error("Flight resources not loaded");
    this.keyboardMode = 0; // Flight entry clears ordinary-reader mode.
    this.expeditionKeyboard.mode = 0;
    this.flight = new Flight(
      {
        ...this.flightResources,
        ...this.departure.flightRequest,
        difficulty: this.difficulty,
        seed: this.seed,
        day: this.campaign.day,
        money: this.money,
        ...(this.expeditionInput === "keyboard"
          ? { readInput: () => this.readExpeditionKeyboard() }
          : {}),
        pollInput: () => this.pollFlightSystemInput(),
        flushInput: () => this.flushFlightInput(),
      },
      this.flightMemory,
    );
    this.flight.setControls(this.controls);
    this.scene = "flight";
    this.syncExpeditionKeyboard();
  }
  flushDepartureInput() {
    this.flushExpeditionKeyboard();
    this.pendingFlightSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  advanceTick() {
    this.advanceDriverTick();
  }
  advanceDriverTick() {
    this.tick++;
    if (this.systemOverlay) {
      if (this.scene === "title" && this.opening)
        this.opening.advanceBlockedTick();
      if (this.scene === "difficulty" && this.difficultyMenu)
        this.difficultyMenu.advanceBlockedTick();
      if (this.scene === "flight") this.flight.advanceBlockedTick();
      if (this.scene === "cave") this.cave.advanceBlockedTick();
      if (this.scene === "mountain") this.mountain.advanceBlockedTick();
      if (this.scene === "jungle") this.jungle.advanceBlockedTick();
      if (this.scene === "photography") this.photography.advanceBlockedTick();
      if (this.scene === "ending") this.ending.advanceBlockedTick();
      if (this.scene === "bank") this.bank.advanceBlockedTick();
      if (this.scene === "security") this.security.advanceBlockedTick();
      if (this.scene === "office" && this.officeMenu)
        this.officeMenu.advanceBlockedTick();
      if (this.scene === "map" && this.campaign.destinationWaits)
        this.campaign.destinationWaits.advanceBlockedTick(u32(this.tick));
      this.systemOverlay.advanceTick();
      this.finishSystemOverlay();
      return;
    }
    if (this.scene === "title" && this.opening) {
      this.opening.advanceTick();
      this.collectOpening();
      return;
    }
    if (this.scene === "difficulty" && this.difficultyMenu) {
      this.difficultyMenu.advanceTick();
      this.collectDifficulty();
      return;
    }
    if (this.scene === "security") {
      this.security.advanceTick();
      this.collectSecurity();
      return;
    }
    if (this.scene === "departure") {
      this.departureScene.advanceTick();
      this.collectDeparture();
      return;
    }
    if (this.scene === "office-departure") {
      this.officeDeparture.advanceTick();
      this.collectOfficeDeparture();
      return;
    }
    if (this.scene === "office" && this.officeMenu) {
      this.officeMenu.advanceTick();
      this.collectOfficeMenu();
      return;
    }
    if (this.scene === "bank") {
      this.bank.advanceTick();
      this.collectBank();
      return;
    }
    if (this.scene === "atomic-transport") {
      this.atomicTransport.advanceTick();
      this.collectAtomicTransport();
      return;
    }
    if (["rival-report", "rival-claim"].includes(this.scene)) {
      this.activeRivalDialogue().advanceTick();
      this.collectRivalDialogue();
      return;
    }
    if (this.scene === "ending") {
      this.ending.advanceTick(this.controls);
      this.collectEnding();
      return;
    }
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
      this.visitNotice.advanceTick();
      this.collectVisitNotice();
      return;
    }
    if (this.scene === "expedition-result") {
      if (this.resultPresentation) {
        this.resultPresentation.advanceTick();
        this.collectAwardPresentation();
      } else if (this.resultWait) {
        this.resultWait.advanceTick();
        this.collectResultWait();
      } else if (this.advanceDialogue(this.expeditionResult))
        this.finishExpeditionResult();
      return;
    }
    if (this.scene === "expedition-briefing" && this.briefing.advanceTick()) {
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
    if (this.scene === "crash-repairs") {
      this.resultWait.advanceTick();
      this.collectRepairWait();
      return;
    }
    if (this.scene === "map") {
      if (this.campaign.destinationWaits) {
        this.campaign.destinationWaits.advanceTick(u32(this.tick));
        this.collectDestination();
      } else {
        const input = this.campaign.advanceTick(u32(this.tick));
        if (input?.fire) this.handleInput({ type: "fire" });
      }
    }
    if (this.scene !== "money-bin") return;
    this.bin.advanceTick();
    this.collectEffects();
  }
  advanceRetrace() {
    if (this.systemOverlay) {
      if (this.scene === "title" && this.opening)
        this.opening.advanceBlockedRetrace();
      if (this.scene === "difficulty" && this.difficultyMenu)
        this.difficultyMenu.advanceBlockedRetrace();
      if (this.scene === "flight") this.flight.advanceBlockedRetrace();
      if (this.scene === "cave") this.cave.advanceBlockedRetrace();
      if (this.scene === "mountain") this.mountain.advanceBlockedRetrace();
      if (this.scene === "jungle") this.jungle.advanceBlockedRetrace();
      if (this.scene === "photography")
        this.photography.advanceBlockedRetrace();
      if (this.scene === "ending") this.ending.advanceBlockedRetrace();
      if (this.scene === "bank") this.bank.advanceBlockedRetrace();
      if (this.scene === "security") this.security.advanceBlockedRetrace();
      if (this.scene === "office" && this.officeMenu)
        this.officeMenu.advanceBlockedRetrace();
      return;
    }
    if (this.scene === "title" && this.opening) {
      this.opening.advanceRetrace();
      this.collectOpening();
      return;
    }
    if (this.scene === "difficulty" && this.difficultyMenu) {
      this.difficultyMenu.advanceRetrace();
      this.collectDifficulty();
      return;
    }
    if (this.scene === "security") {
      this.security.advanceRetrace();
      this.collectSecurity();
      return;
    }
    if (this.scene === "departure") {
      this.departureScene.advanceRetrace();
      this.collectDeparture();
      return;
    }
    if (this.scene === "office-departure") {
      this.officeDeparture.advanceRetrace();
      this.collectOfficeDeparture();
      return;
    }
    if (this.scene === "office" && this.officeMenu) {
      this.officeMenu.advanceRetrace();
      this.collectOfficeMenu();
      return;
    }
    if (this.scene === "map" && this.campaign.destinationWaits) {
      this.campaign.destinationWaits.advanceRetrace(u32(this.tick));
      this.collectDestination();
      return;
    }
    if (this.scene === "bank") {
      this.bank.advanceRetrace();
      this.collectBank();
      return;
    }
    if (this.scene === "ending") {
      this.ending.advanceRetrace();
      this.collectEnding();
      return;
    }
    if (this.scene === "expedition-result" && this.resultPresentation) {
      this.resultPresentation.advanceRetrace();
      this.collectAwardPresentation();
      return;
    }
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
      this.claim = new RivalReport({
        target: this.departure.target,
        variant: this.seed & 1,
        audioEnabled: this.audioEnabled,
        token: `claim:${++this.audioScope}`,
        queryAudio: !this.audioEnabled && this.hasAudioDevice(),
        pollInput: () => this.pollSystemInput(this.pendingRivalSystemKeys),
        flushInput: () => this.flushRivalInput(),
      });
      this.scene = "rival-claim";
      if (this.audioEnabled)
        this.effects.push({ type: "sound", id: 0x6e, token: this.claim.token });
      else if (!this.claim.statusKnown)
        this.effects.push({ type: "audio-query", token: this.claim.token });
      this.claim.begin();
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
      this.beginRepairWait();
      return;
    }
    this.arrive();
  }
  collectAtomicTransport() {
    const a = this.atomicTransport;
    this.effects.push(...a.drainEvents());
    this.seed = this.campaign.seed = a.seed;
    this.campaign.day = a.day;
    if (a.outcome) {
      // Success has no reader. The following chapter's09f5 flush discards
      // these unread semantic key slots before any later input can consume them.
      this.pendingAtomicSystemKeys.clear();
      this.arrive(
        a.outcome.target,
        this.campaign.locations[a.outcome.target].flags,
      );
    }
  }
  flushAtomicInput() {
    this.pendingAtomicSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  finishSystemOverlay() {
    if (!this.systemOverlay?.result) return;
    const result = this.systemOverlay.result;
    this.systemOverlay = null;
    this.pendingBinSystemKeys.clear();
    this.pendingFlightSystemKeys.clear();
    this.pendingCaveSystemKeys.clear();
    this.pendingMountainSystemKeys.clear();
    this.pendingJungleSystemKeys.clear();
    this.pendingPhotographySystemKeys.clear();
    this.pendingEndingSystemKeys.clear();
    this.pendingBankSystemKeys.clear();
    this.pendingOpeningSystemKeys.clear();
    this.pendingSecuritySystemKeys.clear();
    this.pendingOfficeSystemKeys.clear();
    this.pendingDestinationSystemKeys.clear();
    this.pendingAtomicSystemKeys.clear();
    this.pendingBriefingSystemKeys.clear();
    this.pendingResultSystemKeys.clear();
    this.pendingRivalSystemKeys.clear();
    this.pendingInvestmentSystemKeys.clear();
    if (this.bin) this.bin.inputQueue.length = 0;
    // Original19a5 clears the BIOS input queue and128-byte key table.
    if (this.scene === "title" && this.opening) this.opening.flushInput();
    else if (this.scene === "difficulty" && this.difficultyMenu)
      this.difficultyMenu.flushInput(true);
    else if (this.scene === "security") this.security.flushInput();
    else if (this.scene === "office" && this.officeMenu)
      this.officeMenu.flushInput(true);
    else if (this.scene === "map") {
      this.campaign.flushMapKeys();
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    } else if (this.scene === "flight") this.flight.flushInput();
    else if (this.scene === "cave") this.cave.flushInput();
    else if (this.scene === "mountain") this.mountain.flushInput();
    else if (this.scene === "jungle") this.jungle.flushInput();
    else if (this.scene === "photography") this.photography.flushInput();
    else if (this.scene === "atomic-transport")
      this.atomicTransport.flushInput();
    else if (this.scene === "expedition-briefing") this.briefing.flushInput();
    else if (
      ["expedition-result", "crash-repairs"].includes(this.scene) &&
      this.resultWait
    )
      this.resultWait.flushInput();
    else if (this.activeRivalDialogue())
      this.activeRivalDialogue().flushInput();
    else if (this.scene === "visit-notice") this.visitNotice.flushInput();
    else if (
      this.scene === "investments" &&
      this.investments.phase === "broker"
    )
      this.investments.flushInput();
    else if (this.scene === "ending") this.ending.flushInput();
    else if (this.scene === "bank") this.bank.flushInput(true);
    else {
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    }
    if (result === "quit") {
      this.officeMenu = null;
      this.exiting = true;
      this.pendingCampaignAction = null;
      this.ending = new CampaignEnding({
        day: this.campaign?.day ?? 1,
        banked: this.campaign?.banked ?? 0,
        rivalBanked: this.campaign?.rival.banked ?? 0,
        audioEnabled: this.audioEnabled,
        pollInput: () => this.pollEndingSystemInput(),
        flushInput: (release) => this.flushEndingInput(release),
      });
      this.ending.beginCredits();
      this.scene = "ending";
      this.collectEnding();
      if (!this.audioEnabled) this.effects.push({ type: "stopAudio" });
    }
    if (result === "resume" && this.scene === "money-bin") {
      this.bin.resumeInputPoll();
      this.collectEffects();
    }
    if (result === "resume" && this.scene === "flight") {
      this.flight.resumeInputPoll();
      this.collectFlight();
    }
    if (result === "resume" && this.scene === "cave") {
      this.cave.resumeInputPoll();
      this.collectCave();
    }
    if (result === "resume" && this.scene === "mountain") {
      this.mountain.resumeInputPoll();
      this.collectMountain();
    }
    if (result === "resume" && this.scene === "jungle") {
      this.jungle.resumeInputPoll();
      this.collectActionExpedition(this.jungle);
    }
    if (result === "resume" && this.scene === "photography") {
      this.photography.resumeInputPoll();
      this.collectPhotography();
    }
    if (result === "resume" && this.scene === "atomic-transport") {
      this.atomicTransport.resumeInputPoll();
      this.collectAtomicTransport();
    }
    if (result === "resume" && this.scene === "expedition-briefing") {
      this.briefing.resumeInputPoll();
      if (this.briefing.complete) this.startExpedition();
    }
    if (
      result === "resume" &&
      ["expedition-result", "crash-repairs"].includes(this.scene) &&
      this.resultWait
    ) {
      this.resultWait.resumeInputPoll();
      if (this.scene === "crash-repairs") this.collectRepairWait();
      else this.collectResultWait();
    }
    if (result === "resume" && this.scene === "bank") {
      this.bank.resumeInputPoll();
      this.collectBank();
    }
    if (
      result === "resume" &&
      this.activeRivalDialogue()?.waitingForInputPoll
    ) {
      this.activeRivalDialogue().resumeInputPoll();
      this.collectRivalDialogue();
    }
    if (result === "resume" && this.scene === "ending") {
      this.ending.resumeInputPoll();
      this.collectEnding();
    }
    if (result === "resume" && this.scene === "visit-notice") {
      this.visitNotice.resumeInputPoll();
      this.collectVisitNotice();
    }
    if (
      result === "resume" &&
      this.scene === "investments" &&
      this.investments.phase === "broker"
    ) {
      this.investments.resumeInputPoll();
      this.collectInvestments();
    }
  }
  pollBankSystemInput() {
    return this.pollSystemInput(this.pendingBankSystemKeys);
  }
  flushBankInput(release = false) {
    this.pendingBankSystemKeys.clear();
    this.pendingOpeningSystemKeys.clear();
    if (release) {
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    }
  }
  pollEndingSystemInput() {
    return this.pollSystemInput(this.pendingEndingSystemKeys);
  }
  flushEndingInput(releaseControls = true) {
    this.pendingEndingSystemKeys.clear();
    if (releaseControls) {
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    }
  }
  pollPhotographySystemInput() {
    return this.pollSystemInput(this.pendingPhotographySystemKeys);
  }
  flushPhotographyInput(releaseControls = true) {
    this.flushExpeditionKeyboard();
    this.pendingPhotographySystemKeys.clear();
    if (releaseControls) {
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    }
  }
  pollJungleSystemInput() {
    return this.pollSystemInput(this.pendingJungleSystemKeys);
  }
  flushJungleInput(releaseControls = true) {
    this.flushExpeditionKeyboard();
    this.pendingJungleSystemKeys.clear();
    if (releaseControls) {
      this.handleInput({ type: "controls", fire: false, direction: null });
      this.effects.push({ type: "flushControls" });
    }
  }
  pollMountainSystemInput() {
    return this.pollSystemInput(this.pendingMountainSystemKeys);
  }
  flushMountainInput() {
    this.flushExpeditionKeyboard();
    this.pendingMountainSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  pollMoneyBinSystemInput() {
    return this.pollSystemInput(this.pendingBinSystemKeys);
  }
  pollCaveSystemInput() {
    return this.pollSystemInput(this.pendingCaveSystemKeys);
  }
  flushCaveInput() {
    this.flushExpeditionKeyboard();
    this.pendingCaveSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  pollFlightSystemInput() {
    return this.pollSystemInput(this.pendingFlightSystemKeys);
  }
  flushFlightInput() {
    this.flushExpeditionKeyboard();
    this.pendingFlightSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  pollSystemInput(keys) {
    // The custom key table is scanned by scan code, not event arrival order.
    // Native Escape/Q precede P/S; F1 follows them. A dialog flushes the rest.
    for (const [scanCode, type] of [...keys].sort((a, b) => a[0] - b[0])) {
      keys.delete(scanCode);
      this.handleInput({ type }, true);
      if (this.systemOverlay) return false;
    }
    return true;
  }
  collectDestination() {
    const c = this.campaign,
      waits = c.destinationWaits;
    if (!waits) return;
    this.keyboardMode = 1; // Destination sets mode1 and retains it on return.
    c.choice = waits.choice;
    for (const event of waits.drainEvents()) {
      if (event.type === "sound") {
        if (this.audioEnabled) this.effects.push(event);
      } else if (event.type === "transport") c.aircraft = event.aircraft;
      else if (event.type === "flush") this.flushDestinationInput();
      else throw Error(`Unsupported destination effect ${event.type}`);
    }
    if (!waits.outcome) return;
    const code = waits.outcome.returnCode;
    c.destinationWaits = null;
    if (code === 0x24) c.info = false;
    else if (code === 1)
      this.completeCampaignAction({ type: "travel", target: c.selected });
    else throw Error(`Unsupported destination return ${code}`);
  }
  flushDestinationInput() {
    this.campaign.flushMapKeys();
    this.pendingDestinationSystemKeys.clear();
    this.pendingAtomicSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  readDestinationByte() {
    const c = this.campaign;
    const beforeFlags = [...c.mapKeyboard.bytes()];
    const byte = c.mapKeyboard.poll();
    c.destinationReadTrace = {
      beforeFlags,
      byte,
      readerFlags: [...c.mapKeyboard.bytes()],
    };
    return byte;
  }
  readDestinationInput() {
    const c = this.campaign,
      waits = c?.destinationWaits;
    if (!c?.info || !waits) throw Error("Missing destination reader state");
    // Original mode1 scans raw slots before normalizing aliases. During a
    // blocking wait IRQ flags accumulate until the caller's next flush; no
    // reader runs there. The recurring neutral loop/CPU draw window remains
    // separate from this explicit input-consumption boundary.
    let byte = 0;
    if (waits.ready) {
      byte = this.readDestinationByte();
    }
    waits.input(byte, u32(this.tick));
    this.collectDestination();
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
    this.resultWait = null;
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
      this.expeditionResult = {
        phase: "award",
        value: treasure.value,
        remaining: 40 * 7,
        skipRequested: false,
      };
      this.scene = "expedition-result";
      this.beginAwardPresentation(treasure.value, "cave");
      return;
    }
    // Only the actual09f5 result dialog starts with19a5. The shared photo-score
    // branch above returns directly and never enters this input wait.
    this.cave.flushInput();
    this.scene = "expedition-result";
    this.beginResultWait();
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
      if (c.day > 30) {
        this.beginEnding();
        return;
      }
      this.effects.push({ type: "stopAudio" });
      this.completeCampaignAction({ type: "map" });
    }
  }
  finishScoredExpedition(memory) {
    // Resident04f2 tests the shared DWORD after any successful expedition.
    // A failed ordinary-only photography visit leaves it set,so a later
    // success also takes this branch. No other expedition clears it on entry.
    if (!memory.view.getUint32(0x97a8, true)) return false;
    memory.view.setUint32(0x97a8, 0, true);
    this.resultWait = null;
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
      if (this.campaign.day > 30) {
        this.beginEnding();
        return;
      }
      this.completeCampaignAction({ type: "map" });
      return;
    }
    this.campaign.day = u8(this.campaign.day + 1);
    if (this.finishScoredExpedition(expedition.memory)) return;
    const id = this.campaign.locations[this.campaign.location].treasure;
    const treasure = this.loot?.[id - 1];
    if (!treasure) throw Error("Missing original expedition reward");
    this.expeditionResult = {
      phase: "award",
      value: treasure.value,
      remaining: 40 * 7,
      skipRequested: false,
    };
    this.scene = "expedition-result";
    this.beginAwardPresentation(
      treasure.value,
      expedition === this.jungle ? "jungle" : "mountain",
    );
  }
  beginAwardPresentation(value, sourceScene = null) {
    this.resultWait = null;
    this.resultPresentation = new AwardPresentation({
      entries: this.departureEntries,
      clock: this.simulationClock,
      sourceScene,
      flushInput: () => this.flushResultInput(),
      commitReward: () => {
        this.money = u32(this.money + value);
      },
    });
  }
  collectAwardPresentation() {
    if (!this.resultPresentation?.complete) return;
    this.resultPresentation = null;
    if (this.audioEnabled) this.effects.push({ type: "sound", id: 0x49 });
    this.beginResultWait();
  }
  beginResultWait() {
    const count = { failure: 20, award: 40, atomic: 100 }[
      this.expeditionResult?.phase
    ];
    this.resultWait = new ResultInputWait({
      state: this.expeditionResult,
      count,
      pollInput: () => this.pollSystemInput(this.pendingResultSystemKeys),
      flushInput: () => this.flushResultInput(),
    });
    this.resultWait.begin();
  }
  flushResultInput() {
    this.pendingResultSystemKeys.clear();
    // The expedition has returned,so syncExpeditionKeyboard no longer selects
    // its memory. Resident19a5 still clears the same shared native key table.
    this.flightMemory?.bytes.fill(0, 0x276c, 0x27ec);
    this.flushExpeditionKeyboard();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  collectResultWait() {
    const wait = this.resultWait;
    if (!wait?.complete) return;
    this.resultWait = null;
    this.pendingResultSystemKeys.clear();
    // Resident C54..C67/DF4..E07 and Cave1a90..1ab2 request24 only for
    // a consumed Fire returning1 with audio enabled.
    if (wait.skipped && this.audioEnabled)
      this.effects.push({ type: "sound", id: 0x24 });
    this.finishExpeditionResult(true);
  }
  finishExpeditionResult(fromInputWait = false) {
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
        if (this.audioEnabled) this.effects.push({ type: "sound", id: 0x54 });
        this.beginResultWait();
        return;
      }
    }
    if (c.day > 30) {
      this.beginEnding();
      return;
    }
    // No synthetic sound0 between the original click and campaign dispatch.
    if (!fromInputWait) this.effects.push({ type: "stopAudio" });
    this.completeCampaignAction({ type: "map" });
  }
  finishRepairs() {
    this.resultWait = null;
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
      this.beginRepairWait();
      return;
    }
    this.arrive();
  }
  beginRepairWait() {
    const count = { repair: 60, wreckage: 100 }[this.repairs.phase];
    this.resultWait = new ResultInputWait({
      state: this.repairs,
      count,
      pollInput: () => this.pollSystemInput(this.pendingResultSystemKeys),
      flushInput: () => this.flushResultInput(),
    });
    this.resultWait.begin();
  }
  collectRepairWait() {
    const wait = this.resultWait;
    if (!wait?.complete) return;
    this.resultWait = null;
    this.pendingResultSystemKeys.clear();
    // Main08ff..0912/0af1..0b04: only a consumed Fire with enabled audio.
    if (wait.skipped && this.audioEnabled)
      this.effects.push({ type: "sound", id: 0x24 });
    this.finishRepairs();
  }
  arrive(target = this.departure?.target, flags = this.departure?.flags) {
    if (!Number.isInteger(target) || target < 1 || target > 34)
      throw Error("Missing expedition destination");
    this.campaign.location = target;
    if (this.campaign.day > 30) {
      this.beginEnding();
      return;
    }
    if (!this.expeditionResources)
      throw Error(
        `Untranslated expedition arrival: ${this.campaign.locations[target].name}.`,
      );
    this.briefing = new ExpeditionBriefing({
      flags,
      seed: this.seed,
      clues: this.expeditionResources.clues,
      pollInput: () => this.pollSystemInput(this.pendingBriefingSystemKeys),
      flushInput: () => this.flushBriefingInput(),
    });
    this.seed = this.campaign.seed = this.briefing.seed;
    this.scene = "expedition-briefing";
    this.briefing.begin();
  }
  flushBriefingInput() {
    this.pendingBriefingSystemKeys.clear();
    this.flushExpeditionKeyboard();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  startExpedition() {
    this.pendingBriefingSystemKeys.clear();
    this.beginExpeditionKeyboard(this.briefing.activity);
    this.campaign.rivalUnlockMask |= RIVAL_UNLOCK[this.briefing.activity] ?? 0;
    if (this.briefing.activity === "photography") {
      this.photography = new Photography(
        {
          ...this.expeditionResources,
          entries: this.expeditionResources.photographyEntries,
          clock: this.simulationClock,
          ...(this.expeditionInput === "keyboard"
            ? {
                readInput: () => this.readExpeditionKeyboard(),
                readDialogueFire: () =>
                  (this.readExpeditionKeyboard() & 0xc0) !== 0,
              }
            : {}),
          pollInput: () => this.pollPhotographySystemInput(),
          flushInput: (release) => this.flushPhotographyInput(release),
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
      this.syncExpeditionKeyboard();
      return;
    }
    if (this.briefing.activity === "jungle") {
      this.jungle = new Jungle(
        {
          ...this.expeditionResources,
          entries: this.expeditionResources.jungleEntries,
          clock: this.simulationClock,
          ...(this.expeditionInput === "keyboard"
            ? {
                readInput: () => this.readExpeditionKeyboard(),
              }
            : {}),
          pollInput: () => this.pollJungleSystemInput(),
          flushInput: (release) => this.flushJungleInput(release),
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
      this.syncExpeditionKeyboard();
      return;
    }
    if (this.briefing.activity === "mountain") {
      this.mountain = new Mountain(
        {
          ...this.expeditionResources,
          entries: this.expeditionResources.mountainEntries,
          clock: this.simulationClock,
          ...(this.expeditionInput === "keyboard"
            ? {
                readInput: () => this.readExpeditionKeyboard(),
              }
            : {}),
          pollInput: () => this.pollMountainSystemInput(),
          flushInput: () => this.flushMountainInput(),
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
      this.syncExpeditionKeyboard();
      return;
    }
    if (this.briefing.activity !== "cave")
      throw Error(
        `Untranslated ${this.briefing.activity} expedition gameplay.`,
      );
    this.cave = new Cave(
      {
        ...this.expeditionResources,
        hasAudioDevice: () => this.hasAudioDevice(),
        clock: this.simulationClock,
        variant: this.briefing.variant,
        difficulty: this.difficulty,
        seed: this.seed,
        money: this.money,
        audioEnabled: this.audioEnabled,
        audioScope: ++this.audioScope,
        ...(this.expeditionInput === "keyboard"
          ? {
              readInput: () => this.readExpeditionKeyboard(),
            }
          : {}),
        pollInput: () => this.pollCaveSystemInput(),
        flushInput: () => this.flushCaveInput(),
      },
      this.flightMemory,
    );
    this.cave.setControls(this.controls);
    this.scene = "cave";
    this.syncExpeditionKeyboard();
  }
  finishRivalClaim() {
    this.campaign.location = this.departure.target;
    if (this.campaign.day > 30) {
      this.beginEnding();
      return;
    }
    this.completeCampaignAction({ type: "map" });
  }
  activeRivalDialogue() {
    return this.scene === "rival-report"
      ? this.rivalReport
      : this.scene === "rival-claim"
        ? this.claim
        : null;
  }
  resumeVisitAudio() {
    const n = this.scene === "visit-notice" ? this.visitNotice : null;
    if (!this.systemOverlay && n?.waitingForAudio && n.statusKnown) {
      n.resumeAudioStatus();
      this.collectVisitNotice();
    }
  }
  collectVisitNotice() {
    const n = this.visitNotice;
    if (this.scene !== "visit-notice" || !n?.complete) return;
    this.pendingRivalSystemKeys.clear();
    if (this.audioEnabled) {
      if (n.skipped) this.effects.push({ type: "sound", id: 0x24 });
      if (n.reason === "rival") this.effects.push({ type: "sound", id: 0 });
    }
    this.visitNotice = null;
    this.completeCampaignAction({ type: "map" });
  }
  flushRivalInput() {
    this.pendingRivalSystemKeys.clear();
    this.flushExpeditionKeyboard();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  resumeRivalAudio() {
    const r = this.activeRivalDialogue();
    if (!this.systemOverlay && r?.waitingForAudio && r.statusKnown) {
      r.resumeAudioStatus();
      this.collectRivalDialogue();
    }
  }
  collectRivalDialogue() {
    const r = this.activeRivalDialogue();
    if (!r?.complete) return;
    this.pendingRivalSystemKeys.clear();
    if (r.skipped && this.audioEnabled)
      this.effects.push({ type: "sound", id: 0x24 });
    if (this.audioEnabled) this.effects.push({ type: "sound", id: 0x21 });
    this.campaign.rival.location = r.target; //126b0322,after all report controls.
    if (this.scene === "rival-report") {
      const action = this.pendingCampaignAction;
      this.rivalReport = null;
      this.pendingCampaignAction = null;
      this.finishCampaignAction(action);
    } else {
      this.claim = null;
      this.finishRivalClaim();
    }
  }
  collectEffects() {
    for (const event of this.bin.drainEvents()) {
      if (event.type === "return") {
        // Overlay9:0b07 flushes before returning; keys pressed during the
        // uninterruptible dive must not open a dialog in the office.
        this.pendingBinSystemKeys.clear();
        this.handleInput({ type: "controls", fire: false, direction: null });
        this.effects.push({ type: "flushControls" });
        if (event.won) {
          this.money = u32(this.money + 1000);
          this.rareCoinTaken = true;
        }
        this.completeCampaignAction({ type: "office" });
      }
      this.effects.push(event);
    }
  }
  drainEffects() {
    return this.effects.splice(0);
  }
  collectInvestments() {
    this.money = this.marketMemory.view.getUint32(0x8cc0, true);
    if (this.investments.complete) {
      //09f5 returns without a flush. A key made in its last neutral wait
      // survives to the office's first reader;an intervening rival report
      // instead flushes on entry. Do not replay it through the broker reader.
      const unreadKeys = [...this.pendingInvestmentSystemKeys];
      this.pendingInvestmentSystemKeys.clear();
      if (this.investments.wait?.skipped && this.audioEnabled)
        this.effects.push({ type: "sound", id: 0x24 });
      this.completeCampaignAction({ type: "office" });
      if (this.scene === "office" && this.officeMenu)
        for (const [scan, type] of unreadKeys)
          this.pendingOfficeSystemKeys.set(scan, type);
    }
  }
  flushInvestmentInput() {
    this.pendingInvestmentSystemKeys.clear();
    this.handleInput({ type: "controls", fire: false, direction: null });
    this.effects.push({ type: "flushControls" });
  }
  deposit() {
    const c = this.campaign;
    const accounts = depositAccounts({
      day: c.day,
      money: this.money,
      banked: c.banked,
      rivalMoney: c.rival.money,
      rivalBanked: c.rival.banked ?? 0,
    });
    this.money = accounts.money;
    c.banked = accounts.banked;
    c.rival.banked = accounts.rivalBanked;
  }
  beginEnding(alreadyDeposited = false) {
    const c = this.campaign;
    if (!c || c.day < 30) throw Error("Campaign ending before its deadline");
    this.startBank({ toEnding: true, alreadyDeposited });
  }
  startBank({ toEnding = false, alreadyDeposited = false } = {}) {
    const c = this.campaign;
    if (!alreadyDeposited) this.deposit();
    c.location = 0;
    this.rareCoinTaken = false;
    if (!this.bankResources) throw Error("Missing bank resources");
    this.bankToEnding = toEnding;
    this.bank = new BankScene({
      ...this.bankResources,
      banked: c.banked,
      rivalBanked: c.rival.banked ?? 0,
      seed: this.seed,
      audioEnabled: this.audioEnabled,
      pollInput: () => this.pollBankSystemInput(),
      flushInput: (release) => this.flushBankInput(release),
    });
    this.bank.setControls(this.controls);
    this.scene = "bank";
    this.collectBank();
  }
  collectBank() {
    this.effects.push(...this.bank.drainEvents());
    this.seed = this.campaign.seed = this.bank.seed;
    if (!this.bank.complete) return;
    const toEnding = this.bankToEnding;
    this.bank = null;
    if (!toEnding) {
      this.completeCampaignAction({ type: "map" });
      return;
    }
    const c = this.campaign;
    // Main0187 skips ordinary market cleanup past day30. An exact day30 bank
    // arrival performs cleanup before the winner comparison.
    if (c.day === 30) {
      this.completeCampaignAction({ type: "ending" });
      return;
    }
    this.showEnding();
  }
  showEnding({ presentationReady = false } = {}) {
    const c = this.campaign;
    this.ending = new CampaignEnding({
      day: c.day,
      banked: c.banked,
      rivalBanked: c.rival.banked ?? 0,
      audioEnabled: this.audioEnabled,
      presentationReady,
      pollInput: () => this.pollEndingSystemInput(),
      flushInput: (release) => this.flushEndingInput(release),
    });
    this.ending.setControls(this.controls);
    this.scene = "ending";
    if (this.audioEnabled) this.effects.push({ type: "sound", id: 1 });
    else this.effects.push({ type: "stopAudio" });
  }
  collectEnding() {
    for (const event of this.ending.drainEvents()) {
      if (event.type === "sound") this.effects.push(event);
      else if (event.type === "replay-return" && event.choice === 0) {
        // Main0ff8 enters difficulty directly; reset1007 follows its return.
        this.handleInput({ type: "restart", skipTitle: true });
      } else if (event.type === "replay-return" && event.choice === 1) {
        if (this.audioEnabled) this.effects.push({ type: "sound", id: 0 });
      } else throw Error("Unsupported ending effect");
    }
  }
  fail(error) {
    this.diagnostic = error instanceof Error ? error.message : String(error);
  }
  snapshot() {
    return {
      scene: this.scene,
      ...(this.usesExpeditionKeyboard
        ? {
            expeditionKeys: {
              mode: this.expeditionKeyboard.mode,
              reads: this.expeditionKeyReads,
              byte: this.lastExpeditionKeyByte,
              flags: [...this.expeditionKeyboard.bytes()],
            },
          }
        : {}),
      difficulty: this.difficulty,
      money: this.money,
      rareCoinTaken: this.rareCoinTaken,
      seed: this.seed,
      tick: this.tick,
      ...(this.opening ? { opening: this.opening.snapshot() } : {}),
      ...(this.difficultyMenu
        ? { difficultyMenu: this.difficultyMenu.snapshot() }
        : {}),
      ...(this.officeDeparture
        ? { officeDeparture: this.officeDeparture.snapshot() }
        : {}),
      ...(this.officeMenu ? { officeMenu: this.officeMenu.snapshot() } : {}),
      ...(this.pendingDestinationSystemKeys.size
        ? {
            pendingDestinationSystemKeys: [
              ...this.pendingDestinationSystemKeys,
            ].sort((a, b) => a[0] - b[0]),
          }
        : {}),
      ...(this.pendingOfficeSystemKeys.size
        ? {
            pendingOfficeSystemKeys: [...this.pendingOfficeSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      ...(this.openingResources
        ? { securityPending: this.securityPending }
        : {}),
      ...(this.security ? { security: this.security.snapshot() } : {}),
      ...(this.originalSecurity ? { originalSecurity: true } : {}),
      ...(this.pendingSecuritySystemKeys.size
        ? {
            pendingSecuritySystemKeys: [...this.pendingSecuritySystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      bin: this.bin?.snapshot() ?? null,
      ...(this.pendingBinSystemKeys.size
        ? {
            pendingBinSystemKeys: [...this.pendingBinSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      campaign: this.campaign?.snapshot() ?? null,
      departure: this.departure?.snapshot() ?? null,
      ...(this.scene === "departure" && this.departureScene
        ? { departureScene: this.departureScene.snapshot() }
        : {}),
      flight: this.flight
        ? {
            ...this.flight.snapshot(),
            // Read-only consumption boundary for independent input schedules.
            inputReads: this.flight.inputLog.length,
            lastInputCode: this.flight.inputLog.at(-1)?.code ?? null,
            ...(this.expeditionInput === "keyboard"
              ? {
                  returnInputReads: this.flight.returnInputLog.length,
                  lastReturnInputCode:
                    this.flight.returnInputLog.at(-1)?.code ?? null,
                }
              : {}),
          }
        : null,
      ...(this.pendingFlightSystemKeys.size
        ? {
            pendingFlightSystemKeys: [...this.pendingFlightSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      ...(this.pendingCaveSystemKeys.size
        ? {
            pendingCaveSystemKeys: [...this.pendingCaveSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      cave: this.cave?.snapshot() ?? null,
      mountain: this.mountain?.snapshot() ?? null,
      jungle: this.jungle?.snapshot() ?? null,
      ...(this.pendingJungleSystemKeys.size
        ? {
            pendingJungleSystemKeys: [...this.pendingJungleSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      photography: this.photography?.snapshot() ?? null,
      ...(this.pendingPhotographySystemKeys.size
        ? {
            pendingPhotographySystemKeys: [
              ...this.pendingPhotographySystemKeys,
            ].sort((a, b) => a[0] - b[0]),
          }
        : {}),
      investments: this.investments?.snapshot() ?? null,
      ending: this.ending?.snapshot() ?? null,
      bank: this.bank?.snapshot() ?? null,
      ...(this.pendingBankSystemKeys.size
        ? {
            pendingBankSystemKeys: [...this.pendingBankSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      ...(this.pendingEndingSystemKeys.size
        ? {
            pendingEndingSystemKeys: [...this.pendingEndingSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      rivalReport: this.rivalReport?.snapshot() ?? null,
      ...(this.scene === "rival-claim" ? { claim: this.claim.snapshot() } : {}),
      atomicTransport: this.atomicTransport?.snapshot() ?? null,
      ...(this.pendingMountainSystemKeys.size
        ? {
            pendingMountainSystemKeys: [...this.pendingMountainSystemKeys].sort(
              (a, b) => a[0] - b[0],
            ),
          }
        : {}),
      systemOverlay: this.systemOverlay?.snapshot() ?? null,
      exiting: this.exiting,
      pendingCampaignAction: this.pendingCampaignAction
        ? { ...this.pendingCampaignAction }
        : null,
      briefing: this.briefing?.snapshot() ?? null,
      repairs:
        this.scene === "crash-repairs"
          ? {
              ...this.repairs,
              ...(this.resultWait?.waitingForInputPoll
                ? { waitingForInputPoll: true }
                : {}),
            }
          : null,
      expeditionResult:
        this.scene === "expedition-result"
          ? {
              ...this.expeditionResult,
              ...(this.resultPresentation
                ? { presentation: this.resultPresentation.snapshot() }
                : {}),
              ...(this.resultWait?.waitingForInputPoll
                ? { waitingForInputPoll: true }
                : {}),
            }
          : null,
      visitNotice:
        this.scene === "visit-notice" ? this.visitNotice.snapshot() : null,
      diagnostic: this.diagnostic,
    };
  }
}
