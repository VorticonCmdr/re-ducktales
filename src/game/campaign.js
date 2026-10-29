import { OrdinaryKeyboard } from "./ordinary-keyboard.js";
import { MapDeadline } from "./map-deadline.js";
import { DestinationWaits } from "./destination-waits.js";
import { nextRandom, u16 } from "./integer.js";
import { advanceMapPointer, MAP_DIRECTION_CODES } from "./map-pointer.js";

export const OFFICE = 35;
export function parseLoot(entries) {
  if (entries.length !== 37) throw Error("Expected 37 LOOT.ARC records");
  return entries.map((entry, asset) => {
    const lines = new TextDecoder("ascii")
      .decode(entry.data)
      .replace(/\x1a.*$/s, "")
      .split(/\r?\n/);
    if (!/^\d+$/.test(lines[0]) || !lines[1])
      throw Error(`Invalid loot ${asset}`);
    return {
      asset,
      value: (Number(lines[0]) << 16) >> 16,
      name: lines[1],
      description: lines.slice(2, 4),
    };
  });
}
export function parseLocations(entries) {
  if (entries.length !== 35) throw Error("Expected 35 LOC.ARC records");
  return entries.map((entry, asset) => {
    const lines = new TextDecoder("ascii")
      .decode(entry.data)
      .replace(/\x1a.*$/s, "")
      .split(/\r?\n/);
    if (!/^\d+ \d+ \d+ \d+$/.test(lines[0]) || !lines[1])
      throw Error(`Invalid location ${asset}`);
    const [x, y, flags, treasure] = lines[0].split(" ").map(Number);
    return {
      asset,
      x,
      y,
      flags,
      treasure,
      name: lines[1],
      description: lines.slice(2).filter(Boolean),
    };
  });
}
// Main 115a:00d7–02e7: two RNG draws establish the resource permutation.
export function orderLocations(locations, seed) {
  seed = nextRandom(seed);
  let candidate = seed % 30;
  seed = nextRandom(seed);
  const stride = seed % 5;
  const order = [0],
    used = new Set(order);
  while (order.length < 35) {
    while (used.has(candidate))
      candidate = candidate + 1 >= 35 ? 1 : candidate + 1;
    order.push(candidate);
    used.add(candidate);
    candidate = (candidate + stride) % 35;
  }
  return { locations: order.map((asset) => locations[asset]), seed };
}
// Main 115a:0314 (resident image18b4..1a30). Reserve all fixed IDs,
// including locations not processed yet. Only a zero ID consumes an RNG draw.
export function assignLoot(locations, seed) {
  if (locations.length !== 35)
    throw Error("Loot assignment requires 35 locations");
  const result = locations.map((l) => ({ ...l }));
  if (
    !result.every(
      (l) =>
        Number.isInteger(l.treasure) && l.treasure >= 0 && l.treasure <= 37,
    )
  )
    throw Error("Invalid location treasure ID");
  let draws = 0,
    atomicLocation = null;
  for (let i = 1; i < 35; i++) {
    let id = result[i].treasure;
    if (id === 0) {
      seed = nextRandom(seed);
      draws++;
      id = (seed % 37) + 1;
      let attempts = 0;
      while (result.slice(1).some((l) => l.treasure === id)) {
        // The assembly compares candidate+1 with37 before incrementing.
        // A rejected36 wraps to1; only the initial RNG draw can choose37.
        id = id + 1 < 37 ? id + 1 : 1;
        if (++attempts > 37) throw Error("No available original treasure ID");
      }
      result[i].treasure = id;
    }
    if (id === 9) atomicLocation = i;
  }
  return { locations: result, seed: u16(seed), draws, atomicLocation };
}
export function travelDays(locations, from, to) {
  if (from === to) return 0;
  const a = from === OFFICE ? { x: 56, y: 64 } : locations[from];
  const b = to === OFFICE ? { x: 56, y: 64 } : locations[to];
  if (!a || !b) throw Error(`Invalid campaign route ${from} -> ${to}`);
  const dx = Math.abs(a.x - b.x),
    dy = Math.abs(a.y - b.y);
  const distance =
    Math.min(dx * dx, (272 - dx) ** 2) + Math.min(dy * dy, (140 - dy) ** 2);
  return Math.min(3, Math.trunc(distance / 6606) + 1);
}
export class Campaign {
  constructor(locations, seed) {
    const ordered = orderLocations(locations, u16(seed));
    const assigned = assignLoot(ordered.locations, ordered.seed);
    this.locations = assigned.locations.map((l) => ({
      ...l,
      rivalCollected: false,
      playerCollected: false,
    }));
    this.rival = { day: 1, money: 0, location: OFFICE };
    this.rivalUnlockMask = 0;
    this.seed = assigned.seed;
    this.atomicLocation = assigned.atomicLocation;
    this.atomicAvailable = false;
    this.aircraft = "launchpad";
    this.day = 1;
    this.location = OFFICE;
    this.banked = 0;
    this.pointerMotion = { acceleration: 0, dx: 0, dy: 0, firstPollLatch: 0 };
    this.openMap();
  }
  openMap() {
    const here =
      this.location === OFFICE
        ? { x: 46, y: 139 }
        : this.locations[this.location];
    this.cursor = { x: here.x, y: here.y };
    this.selected = this.nearest();
    this.info = false;
    this.choice = 0;
    this.direction = null;
    this.mapKeyboard = new OrdinaryKeyboard(0);
    this.mapDeadline = new MapDeadline();
    this.mapPolls = 0;
    this.lastMapInput = null;
    this.mapReadTrace = null;
    this.destinationWaits = null;
  }
  nearest() {
    const { x, y } = this.cursor;
    if (x >= 22 && x <= 70 && y >= 115 && y <= 163) return OFFICE;
    let selected = 0,
      best = Infinity;
    this.locations.forEach((l, i) => {
      const d = (l.x - x) ** 2 + (l.y - y) ** 2;
      if (d < best) {
        best = d;
        selected = i;
      }
    });
    return selected;
  }
  point(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y))
      throw Error("Invalid map pointer");
    this.cursor = {
      x: Math.max(32, Math.min(285, Math.trunc(x))),
      y: Math.max(28, Math.min(151, Math.trunc(y))),
    };
    this.selected = this.nearest();
  }
  mapKey(scanCode, pressed) {
    this.mapKeyboard.event(scanCode, pressed);
  }
  flushMapKeys() {
    this.mapKeyboard.flush();
    this.direction = null;
  }
  enterDestination(clock) {
    this.info = true;
    this.choice = 0;
    this.direction = null;
    // Original1757 sets mode1;18b1 flushes the triggering held Fire.
    this.mapKeyboard.mode = 1;
    this.mapKeyboard.flush();
    this.destinationReadTrace = null;
    this.destinationWaits = new DestinationWaits(clock, this.atomicAvailable);
  }
  mapInputState() {
    return {
      cursor: { ...this.cursor },
      pointerMotion: { ...this.pointerMotion },
      polls: this.mapPolls,
      lastInput: this.lastMapInput,
      mode: this.mapKeyboard.mode,
      flags: [...this.mapKeyboard.bytes()],
      deadline: this.mapDeadline.deadline,
      period: this.mapDeadline.period,
      read: this.mapReadTrace ? structuredClone(this.mapReadTrace) : null,
      ...(this.info && this.destinationReadTrace
        ? { destinationRead: structuredClone(this.destinationReadTrace) }
        : {}),
    };
  }
  advanceTick(clock) {
    if (!Number.isInteger(clock) || clock < 0 || clock > 0xffffffff)
      throw Error("Map requires an explicit unsigned driver clock");
    if (this.info || !this.mapDeadline.poll(() => clock)) return null;
    this.mapKeyboard.mode = 0;
    this.mapReadTrace = {
      clock,
      beforeFlags: [...this.mapKeyboard.bytes()],
      readerMode: 0,
    };
    let code = this.mapKeyboard.poll();
    this.mapReadTrace.readerFlags = [...this.mapKeyboard.bytes()];
    // Retain the explicit injected direction provider for routine/joystick
    // callers. Browser keyboard events use raw slots and never set direction.
    if (this.direction !== null && !(code & 63)) {
      const direction = MAP_DIRECTION_CODES[this.direction];
      if (direction === undefined)
        throw Error(`Unsupported map direction ${this.direction}`);
      code = (code & 0xc0) | direction;
    }
    this.lastMapInput = code;
    this.mapPolls++;
    const next = advanceMapPointer(
      { ...this.cursor, ...this.pointerMotion },
      code,
    );
    if (next.fire) {
      this.mapReadTrace.endFlags = [...this.mapKeyboard.bytes()];
      this.mapReadTrace.endMode = 0;
      this.mapReadTrace.returnCode = 1;
      return { fire: true };
    } // Original returns1 before flush/restore.
    this.pointerMotion = {
      acceleration: next.acceleration,
      dx: next.dx,
      dy: next.dy,
      firstPollLatch: next.firstPollLatch,
    };
    this.point(next.x, next.y);
    this.mapKeyboard.flush();
    this.mapKeyboard.mode = 1;
    this.mapReadTrace.endFlags = [...this.mapKeyboard.bytes()];
    this.mapReadTrace.endMode = 1;
    this.mapReadTrace.returnCode = 0;
    return { fire: false };
  }

  snapshot() {
    return {
      day: this.day,
      location: this.location,
      banked: this.banked,
      rival: { ...this.rival },
      rivalUnlockMask: this.rivalUnlockMask,
      rivalCollected: this.locations.flatMap((l, i) =>
        l.rivalCollected ? [i] : [],
      ),
      playerCollected: this.locations.flatMap((l, i) =>
        l.playerCollected ? [i] : [],
      ),
      atomicAvailable: this.atomicAvailable,
      aircraft: this.aircraft,
      cursor: { ...this.cursor },
      pointerMotion: { ...this.pointerMotion },
      selected: this.selected,
      asset:
        this.selected === OFFICE ? null : this.locations[this.selected].asset,
      info: this.info,
      ...(this.destinationWaits
        ? { destination: this.destinationWaits.snapshot() }
        : {}),
      choice: this.choice,
      travelDays: travelDays(this.locations, this.location, this.selected),
    };
  }
}
